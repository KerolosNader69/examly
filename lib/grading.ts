/**
 * AI grading of one spoken answer (used by /api/exam/evaluate). Pure: the Gemini call
 * is injected, so prompt structure, response parsing and the fail-safe behaviour are
 * unit-tested with a mock (tests/unit/grading.test.ts).
 *
 * Safety properties:
 *  - The model is asked for structured JSON (responseMimeType + responseJsonSchema)
 *    at temperature 0, so replies are deterministic-ish and machine-checkable.
 *  - The reply is parsed STRICTLY: exactly one JSON object whose `score` is a number
 *    in 0..100. Anything else (prose, two objects, a string score, out-of-range
 *    values, a reply that echoes the student's injected JSON) is rejected and the
 *    question goes to the teacher as pending_review. No fallback or invented score.
 *  - Only the MODEL's reply is ever parsed. JSON or markdown inside the student's
 *    transcript is just prompt text; it can't become the grader's output.
 */

import { clampScore } from './examSession.ts';
import { stripJsonFence } from './gemini.ts';

/**
 * Grading prompt. TEXT UNCHANGED from the previous inline version in the evaluate
 * route (changing its wording changes grading meaning; see the audit proposals).
 */
export function buildGradingPrompt(questionText: string, modelAnswer: string, transcript: string): string {
  return `You are evaluating a student's spoken answer against a teacher's model answer for an oral assessment.

Grade based strictly on CONCEPTUAL/SEMANTIC correctness, not literal wording match. The student does not need to use the same words, sentence structure, or order as the model answer — they only need to convey the same core meaning, facts, and key concepts.

Grading Philosophy & Guidelines:
- Examples of what should score HIGH despite different wording:
  * Model answer: "Paris is the capital of France" / Student says: "France's capital city is Paris" -> should score as fully correct, same meaning, different word order.
  * Model answer uses formal vocabulary, student uses simpler/casual synonyms that convey the same fact -> should still score high.
- Examples of what should score LOW regardless of good wording:
  * Fluent, grammatically perfect response that doesn't contain the actual required facts/concepts from the model answer.
  * Answer that sounds related or uses identical keywords but misses or contradicts the key concept.

The contentScore specifically must reflect concept/meaning accuracy — NOT text similarity. fluencyScore, vocabularyScore, and grammarScore can separately reward language quality, but contentScore must be independent of phrasing style.

[QUESTION PROMPT]
${questionText}

[MODEL ANSWER / CRITERIA]
${modelAnswer || 'Comprehensive and clear response addressing all aspects of the prompt.'}

[STUDENT TRANSCRIPT / RESPONSE]
${transcript}

Analyze the student response for content accuracy, fluency, vocabulary, and grammar based on these principles.
Respond ONLY in valid JSON format with no markdown wrappers or extra commentary:
{
  "score": <integer overall score from 0 to 100>,
  "feedback": "<concise 2-3 sentence feedback for student and teacher explaining the evaluation>",
  "breakdown": {
    "contentScore": <integer 0-100 based strictly on conceptual correctness>,
    "fluencyScore": <integer 0-100 based on delivery/fluency>,
    "vocabularyScore": <integer 0-100 based on vocabulary choice>,
    "grammarScore": <integer 0-100 based on grammatical correctness>
  }
}`;
}

const score0to100 = { type: 'integer', minimum: 0, maximum: 100 } as const;

/** JSON Schema passed to Gemini as `responseJsonSchema` (structured output). */
export const GRADING_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    score: score0to100,
    feedback: { type: 'string' },
    breakdown: {
      type: 'object',
      properties: {
        contentScore: score0to100,
        fluencyScore: score0to100,
        vocabularyScore: score0to100,
        grammarScore: score0to100,
      },
      required: ['contentScore', 'fluencyScore', 'vocabularyScore', 'grammarScore'],
    },
  },
  required: ['score', 'feedback', 'breakdown'],
} as const;

/** Fixed generation settings for grading (low variance). */
export const GRADING_GENERATION_CONFIG = {
  temperature: 0,
  responseMimeType: 'application/json',
  responseJsonSchema: GRADING_RESPONSE_SCHEMA,
} as const;

export interface GradeResult {
  score: number;
  feedback: string;
  breakdown: { contentScore: number | null; fluencyScore: number | null; vocabularyScore: number | null; grammarScore: number | null };
}

const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

/** Strict parse of the model's reply. null = unusable -> caller marks pending_review. */
export function parseGradingResponse(text: unknown): GradeResult | null {
  if (typeof text !== 'string' || !text.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const o = parsed as { score?: unknown; feedback?: unknown; breakdown?: unknown };
  if (!isScore(o.score)) return null;
  if (o.feedback !== undefined && typeof o.feedback !== 'string') return null;
  const b = o.breakdown && typeof o.breakdown === 'object' && !Array.isArray(o.breakdown) ? (o.breakdown as Record<string, unknown>) : {};
  const sub = (k: string) => (isScore(b[k]) ? clampScore(b[k]) : null);
  return {
    score: clampScore(o.score) as number,
    feedback: typeof o.feedback === 'string' ? o.feedback.slice(0, 2000) : '',
    breakdown: {
      contentScore: sub('contentScore'),
      fluencyScore: sub('fluencyScore'),
      vocabularyScore: sub('vocabularyScore'),
      grammarScore: sub('grammarScore'),
    },
  };
}

export type GenerateFn = (args: { model: string; contents: string; config: typeof GRADING_GENERATION_CONFIG }) => Promise<{ text?: string | null }>;

export type GradeOutcome = { status: 'graded'; result: GradeResult } | { status: 'pending_review'; reason: 'ai_unavailable' | 'unparseable' };

/**
 * Tries each model in order; the first non-empty reply is parsed strictly. A reply
 * that doesn't parse goes to pending_review (we don't re-roll on another model to
 * fish for a parseable/higher score).
 */
export async function gradeTranscript(params: {
  generate: GenerateFn;
  models: string[];
  questionText: string;
  modelAnswer: string;
  transcript: string;
}): Promise<GradeOutcome> {
  const contents = buildGradingPrompt(params.questionText, params.modelAnswer, params.transcript);
  let text = '';
  for (const model of params.models) {
    try {
      const res = await params.generate({ model, contents, config: GRADING_GENERATION_CONFIG });
      text = res?.text || '';
      if (text) break;
    } catch (err) {
      console.warn(`Gemini ${model} evaluation failed:`, err instanceof Error ? err.name : 'UnknownError');
    }
  }
  if (!text) return { status: 'pending_review', reason: 'ai_unavailable' };
  const result = parseGradingResponse(text);
  return result ? { status: 'graded', result } : { status: 'pending_review', reason: 'unparseable' };
}
