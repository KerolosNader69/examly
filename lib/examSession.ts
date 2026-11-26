/**
 * Pure, server-side helpers for session-bound grading (no Supabase imports, so they
 * are unit-testable: tests/unit/examSession.test.ts).
 *
 *  - Session tokens: random 32-byte secret returned once by /api/exam/join; only its
 *    SHA-256 hex digest is stored. Verification compares digests in constant time.
 *  - Session state: whether a session may still be used for transcribe/evaluate/submit.
 *  - Final result: the score is computed ONLY from server-stored per-question results
 *    and the database answer key. Client-supplied scores/breakdowns/transcripts are
 *    never inputs; the only student inputs are MCQ choices and essay text.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Explicit `.ts` path so the same import works for Next and for Node's test runner
// (tsconfig: allowImportingTsExtensions).
import { isStudentVisibleStatus } from './examPublic.ts';

/**
 * MCQ answer key from questions.model_answer_text JSON
 * ({ options, correctOptionIndex, explanation }). Falls back to four placeholder
 * options and index 0 when the value isn't MCQ JSON (the defaults /submit always used).
 */
export function parseMcqKey(raw: unknown): { options: string[]; correctIndex: number; explanation: string } {
  const text = typeof raw === 'string' ? raw : '';
  let options: string[] = [];
  let correctIndex = 0;
  let explanation = '';
  if (text.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as { options?: unknown; correctOptionIndex?: unknown; explanation?: unknown };
      if (Array.isArray(parsed.options)) options = parsed.options.map((o) => String(o ?? ''));
      if (Number.isInteger(parsed.correctOptionIndex)) correctIndex = parsed.correctOptionIndex as number;
      if (typeof parsed.explanation === 'string') explanation = parsed.explanation;
    } catch {
      // fall through to defaults
    }
  }
  if (options.length === 0) options = ['Option A', 'Option B', 'Option C', 'Option D'];
  if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;
  return { options, correctIndex, explanation };
}

// ─── Session tokens ─────────────────────────────────────────────────────────

const TOKEN_BYTES = 32;
const TOKEN_RE = /^[A-Za-z0-9_-]{40,128}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** New random token (base64url, 43 chars) and the hash to store. */
export function generateSessionToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, hash: hashSessionToken(token) };
}

/** Constant-time check of a presented token against the stored SHA-256 hex digest. */
export function verifySessionToken(token: unknown, storedHash: unknown): boolean {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return false;
  if (typeof storedHash !== 'string' || !HASH_RE.test(storedHash)) return false;
  const presented = Buffer.from(hashSessionToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}

// ─── Session state ──────────────────────────────────────────────────────────

/** A session can be used for at most this long after it starts. */
export const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;
/** Grace period after the exam's end_time for students already mid-exam. */
export const EXAM_END_GRACE_MS = 15 * 60 * 1000;

export type SessionDenyReason = 'completed' | 'not_in_progress' | 'expired' | 'exam_closed';

export interface SessionStateInput {
  status: string | null;
  started_at: string | null;
}

export interface ExamStateInput {
  status: string | null;
  end_time: string | null;
}

export type SessionStateResult = { ok: true } | { ok: false; reason: SessionDenyReason; httpStatus: number };

const FINISHED_STATUSES = new Set(['completed', 'pending_review', 'evaluation_failed']);

/**
 * Whether a session may still record answers. `allowExpired` lets /submit finalise a
 * session that ran over time (recording what was answered) instead of leaving it open.
 */
export function checkSessionState(
  session: SessionStateInput,
  exam: ExamStateInput | null,
  { now = Date.now(), allowExpired = false }: { now?: number; allowExpired?: boolean } = {}
): SessionStateResult {
  if (session.status && FINISHED_STATUSES.has(session.status)) {
    return { ok: false, reason: 'completed', httpStatus: 409 };
  }
  if (session.status !== 'in_progress') {
    return { ok: false, reason: 'not_in_progress', httpStatus: 409 };
  }
  if (allowExpired) return { ok: true };

  const started = session.started_at ? Date.parse(session.started_at) : NaN;
  if (!Number.isFinite(started) || now - started > SESSION_MAX_AGE_MS) {
    return { ok: false, reason: 'expired', httpStatus: 403 };
  }
  if (!exam || !isStudentVisibleStatus(exam.status)) {
    return { ok: false, reason: 'exam_closed', httpStatus: 403 };
  }
  const end = exam.end_time ? Date.parse(exam.end_time) : NaN;
  if (Number.isFinite(end) && now > end + EXAM_END_GRACE_MS) {
    return { ok: false, reason: 'exam_closed', httpStatus: 403 };
  }
  return { ok: true };
}

// ─── Stored per-question results ────────────────────────────────────────────

export type QuestionResultStatus = 'transcribed' | 'graded' | 'no_speech' | 'pending_review';

export interface StoredQuestionResult {
  transcript?: string;
  transcriptionStatus?: 'ok' | 'failed';
  status?: QuestionResultStatus;
  score?: number | null;
  breakdown?: Record<string, number | null> | null;
  feedback?: string;
}

/** Results that can no longer change (no re-recording or re-grading). */
export function isFinalQuestionResult(r: StoredQuestionResult | null | undefined): boolean {
  return r?.status === 'graded' || r?.status === 'no_speech' || r?.status === 'pending_review';
}

/** Clamps an AI-reported score to an integer 0..100, or null if not a finite number. */
export function clampScore(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Tab-switch count from the client: a plain integer clamped to 0..1000. */
export function clampTabSwitchCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1000, Math.max(0, Math.trunc(n)));
}

const ALLOWED_FLAG_REASONS = new Set(['multiple_tab_switches']);
export function sanitizeFlaggedReason(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && ALLOWED_FLAG_REASONS.has(value) ? value : 'flagged';
}

// ─── Final result ───────────────────────────────────────────────────────────

export interface ScoringQuestion {
  id: string;
  question_text: string;
  model_answer_text: string | null;
  order_index: number | null;
}

export interface FinalResultInput {
  examType: string | null;
  questions: ScoringQuestion[];
  /** student_sessions.question_results (server-written only). */
  questionResults: Record<string, StoredQuestionResult> | null;
  /** Student MCQ choices from /submit. Only `selectedOptionIndex` is trusted, after validation. */
  mcqSelections?: unknown;
  /** Student essay answers from /submit. */
  essayAnswers?: unknown;
}

export interface FinalResult {
  status: 'completed' | 'pending_review';
  aiScore: number | null;
  breakdown: Record<string, unknown>;
  transcript: string;
}

export const MAX_ESSAY_ANSWER_CHARS = 20_000;
const MEDIA_TYPES = new Set(['audio', 'video', 'audio_video']);

function sortQuestions(qs: ScoringQuestion[]): ScoringQuestion[] {
  return [...qs].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object') : [];
}

function pickByQuestion(items: Record<string, unknown>[], q: ScoringQuestion, idx: number) {
  return items.find((it) => it.questionId === q.id) ?? items.find((it) => it.questionId === undefined && it.questionIndex === idx);
}

const letter = (i: number) => String.fromCharCode(65 + i);

function scoreMcq(questions: ScoringQuestion[], selections: unknown): FinalResult {
  const items = asArray(selections);
  let correct = 0;
  const questionScores = questions.map((q, idx) => {
    const { options, correctIndex, explanation } = parseMcqKey(q.model_answer_text);
    const raw = pickByQuestion(items, q, idx)?.selectedOptionIndex;
    const selected = Number.isInteger(raw) && (raw as number) >= 0 && (raw as number) < options.length ? (raw as number) : null;
    const isCorrect = selected !== null && selected === correctIndex;
    if (isCorrect) correct += 1;
    return {
      questionIndex: idx,
      questionId: q.id,
      questionText: q.question_text,
      selectedOptionIndex: selected,
      selectedOptionLetter: selected === null ? 'None' : letter(selected),
      selectedOptionText: selected === null ? 'No option selected' : options[selected],
      correctOptionIndex: correctIndex,
      correctOptionLetter: letter(correctIndex),
      correctOptionText: options[correctIndex] || '',
      isCorrect,
      score: isCorrect ? 100 : 0,
      options,
      explanation,
    };
  });

  if (questions.length === 0) {
    return { status: 'pending_review', aiScore: null, breakdown: { totalCorrect: 0, totalQuestions: 0, questionScores: [] }, transcript: '' };
  }
  const aiScore = Math.round((correct / questions.length) * 100);
  const breakdown = { totalCorrect: correct, totalQuestions: questions.length, scorePercentage: aiScore, questionScores };
  // As before, MCQ transcripts hold the structured breakdown (the review UI reads it).
  return { status: 'completed', aiScore, breakdown, transcript: JSON.stringify(breakdown) };
}

function scoreEssay(questions: ScoringQuestion[], essayAnswers: unknown): FinalResult {
  const items = asArray(essayAnswers);
  const answers = questions.map((q, idx) => {
    const raw = pickByQuestion(items, q, idx)?.text;
    const text = typeof raw === 'string' ? raw.slice(0, MAX_ESSAY_ANSWER_CHARS).trim() : '';
    return { questionId: q.id, questionText: q.question_text, answer: text };
  });
  const transcript = answers
    .map((a, idx) => `Question ${idx + 1} (${a.questionText}): ${a.answer || 'No written response'}`)
    .join('\n\n');
  // Essays are not auto-graded: no fake score, the teacher reviews them.
  return { status: 'pending_review', aiScore: null, breakdown: { pending_review: true, essayAnswers: answers }, transcript };
}

function scoreMedia(questions: ScoringQuestion[], stored: Record<string, StoredQuestionResult>): FinalResult {
  let anyPending = false;
  const perQuestion = questions.map((q, idx) => {
    const r = stored[q.id];
    let status: QuestionResultStatus | 'not_answered';
    let score: number | null;
    if (r?.status === 'graded' && clampScore(r.score) !== null) {
      status = 'graded';
      score = clampScore(r.score);
    } else if (r?.status === 'no_speech') {
      status = 'no_speech';
      score = 0;
    } else if (r?.status === 'pending_review' || r?.transcriptionStatus === 'failed' || r?.status === 'transcribed') {
      // Our side failed (AI/STT unavailable) or grading never finished: teacher reviews.
      status = 'pending_review';
      score = null;
      anyPending = true;
    } else {
      // Never answered (skipped / exam ended early) counts as zero, so skipping
      // weak questions can't raise the average.
      status = 'not_answered';
      score = 0;
    }
    return {
      questionId: q.id,
      label: `Question ${idx + 1} Score`,
      question: q.question_text,
      status,
      score,
      feedback: typeof r?.feedback === 'string' ? r.feedback : '',
      breakdown: r?.breakdown ?? null,
      transcript: typeof r?.transcript === 'string' ? r.transcript : '',
    };
  });

  const avg = (key: string) => {
    const vals = perQuestion
      .map((p) => (p.breakdown && typeof p.breakdown[key] === 'number' ? (p.breakdown[key] as number) : null))
      .filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  };

  const breakdown: Record<string, unknown> = {
    contentScore: avg('contentScore'),
    fluencyScore: avg('fluencyScore'),
    vocabularyScore: avg('vocabularyScore'),
    grammarScore: avg('grammarScore'),
    // `questions` (not `questionScores`): the review UI treats questionScores as MCQ data.
    questions: perQuestion.map((p) => {
      const rest: Partial<typeof p> = { ...p };
      delete rest.transcript; // transcripts go in the transcript column, not the breakdown
      return rest;
    }),
  };

  const transcript = perQuestion
    .map((p, idx) => `Question ${idx + 1} (${p.question}): ${p.transcript || (p.status === 'not_answered' ? 'No response' : 'No speech detected')}`)
    .join('\n\n');

  if (questions.length === 0 || anyPending) {
    if (anyPending) breakdown.pending_review = true;
    return { status: 'pending_review', aiScore: null, breakdown, transcript };
  }
  const total = perQuestion.reduce((s, p) => s + (p.score ?? 0), 0);
  return { status: 'completed', aiScore: Math.round(total / questions.length), breakdown, transcript };
}

/** Final score/status for a session, from server-stored data only. */
export function computeFinalResult(input: FinalResultInput): FinalResult {
  const questions = sortQuestions(input.questions);
  const type = input.examType || 'audio';
  if (type === 'mcq') return scoreMcq(questions, input.mcqSelections);
  if (type === 'essay') return scoreEssay(questions, input.essayAnswers);
  if (MEDIA_TYPES.has(type)) return scoreMedia(questions, input.questionResults ?? {});
  // Unknown type: never invent a score.
  return { status: 'pending_review', aiScore: null, breakdown: { pending_review: true }, transcript: '' };
}
