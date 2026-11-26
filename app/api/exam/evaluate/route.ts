import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { modelAnswerForGrading } from '@/lib/examPublic';
import { authorizeStudentSession, recordQuestionResult } from '@/lib/examSessionServer';
import { clampScore, isFinalQuestionResult } from '@/lib/examSession';
import { geminiModels, stripJsonFence } from '@/lib/gemini';
import { getRateLimiter, tooManyRequests } from '@/lib/rateLimit';
import { getTrustedClientIp } from '@/lib/clientIp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const perQuestion = getRateLimiter({ name: 'exam-evaluate-question', max: 3, windowMs: 4 * 60 * 60 * 1000 });
const perIp = getRateLimiter({ name: 'exam-evaluate-ip', max: 300, windowMs: 10 * 60 * 1000 });

const noStore = { 'Cache-Control': 'no-store' };
const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status, headers: noStore });
/** Generic client response: never the score, feedback, raw model output or model answer. */
const respond = (status: 'graded' | 'no_speech' | 'pending_review') =>
  NextResponse.json({ success: true, status }, { headers: noStore });

/** Grading prompt (text unchanged from before Phase 2B). */
function buildGradingPrompt(questionText: string, modelAnswer: string, transcript: string): string {
  const prompt = `You are evaluating a student's spoken answer against a teacher's model answer for an oral assessment.

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
  return prompt;
}

/**
 * POST /api/exam/evaluate
 * Body: { sessionId, token, questionId }
 *
 * Grades the transcript the SERVER stored for this question (from /transcribe)
 * against the model answer loaded from the database. Requires a valid in-progress
 * session + token, and the question must belong to the session's variant.
 * Stores { status, score, breakdown, feedback } in question_results and returns
 * only { success, status }. A question is graded once; no re-rolls.
 * If Gemini is unavailable or replies unusably, the question becomes
 * "pending_review" with no score (the teacher grades it). No fake fallback scores.
 */
export async function POST(request: Request) {
  const ipRl = await perIp.limit(getTrustedClientIp(request));
  if (!ipRl.allowed) {
    const r = tooManyRequests(ipRl.retryAfterSeconds);
    return NextResponse.json(r.body, r.init);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail(400, 'Invalid request.');

  const auth = await authorizeStudentSession({ sessionId: body.sessionId, token: body.token, questionId: body.questionId });
  if (!auth.ok) return fail(auth.httpStatus, auth.error);
  const { session, question } = auth.ctx;
  const q = question!;
  const stored = session.question_results[q.id];

  // Already decided: return the same status, don't call the AI again.
  if (isFinalQuestionResult(stored)) return respond(stored!.status as 'graded' | 'no_speech' | 'pending_review');

  if (!stored || (stored.transcriptionStatus !== 'ok' && stored.transcriptionStatus !== 'failed')) {
    return fail(409, 'Please record your answer first.');
  }

  const qRl = await perQuestion.limit(`${session.id}:${q.id}`);
  if (!qRl.allowed) {
    const r = tooManyRequests(qRl.retryAfterSeconds, 'Too many attempts for this question.');
    return NextResponse.json(r.body, r.init);
  }

  const markPending = async () => {
    await recordQuestionResult(session.id, q.id, { status: 'pending_review', score: null });
    return respond('pending_review');
  };

  // Transcription failed on our side: the teacher reviews the recording.
  if (stored.transcriptionStatus === 'failed') return markPending();

  const transcript = (stored.transcript || '').trim();
  if (transcript.length <= 2) {
    await recordQuestionResult(session.id, q.id, { status: 'no_speech', score: 0, feedback: 'No speech detected in recording.' });
    return respond('no_speech');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not configured; question marked for teacher review.');
    return markPending();
  }

  const prompt = buildGradingPrompt(q.question_text, modelAnswerForGrading(q.model_answer_text), transcript);
  const ai = new GoogleGenAI({ apiKey });

  let responseText = '';
  for (const model of geminiModels()) {
    try {
      const response = await ai.models.generateContent({ model, contents: prompt });
      responseText = response.text || '';
      if (responseText) break;
    } catch (err) {
      console.warn(`Gemini ${model} evaluation failed:`, err instanceof Error ? err.name : 'UnknownError');
    }
  }
  if (!responseText) return markPending();

  let parsed: { score?: unknown; feedback?: unknown; breakdown?: Record<string, unknown> };
  try {
    parsed = JSON.parse(stripJsonFence(responseText));
  } catch {
    return markPending();
  }

  const score = clampScore(parsed.score);
  if (score === null) return markPending();
  const b = parsed.breakdown && typeof parsed.breakdown === 'object' ? parsed.breakdown : {};
  const breakdown = {
    contentScore: clampScore(b.contentScore),
    fluencyScore: clampScore(b.fluencyScore),
    vocabularyScore: clampScore(b.vocabularyScore),
    grammarScore: clampScore(b.grammarScore),
  };
  const feedback = typeof parsed.feedback === 'string' ? parsed.feedback.slice(0, 2000) : '';

  // Feedback is stored for the TEACHER only (it can paraphrase the model answer).
  const saved = await recordQuestionResult(session.id, q.id, { status: 'graded', score, breakdown, feedback });
  if (!saved) return fail(409, 'This exam session is no longer active.');
  return respond('graded');
}
