/**
 * Why a submission is pending_review, as a short code + teacher-facing label.
 * Pure and client-safe. Written to student_sessions.review_reason by /api/exam/submit
 * (migration 007); the dashboard falls back to deriving it from the stored summary for
 * rows submitted before that column existed. Tests: tests/unit/privacy.test.ts.
 */
import { DEFINITIVE_REASONS, type LanguageSignalReason } from './languageCheck.ts';

export const REVIEW_REASONS = [
  'wrong_language',
  'unclear_audio',
  'transcription_unavailable',
  'grading_unavailable',
  'grading_incomplete',
  'answer_key_invalid',
  'essay_manual',
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

const LABELS: Record<ReviewReason, string> = {
  wrong_language: 'Different language than expected',
  unclear_audio: 'Unclear audio',
  transcription_unavailable: 'Transcription unavailable',
  grading_unavailable: 'AI grading unavailable',
  grading_incomplete: 'Grading did not finish',
  answer_key_invalid: 'Answer key needs fixing',
  essay_manual: 'Essay: graded by teacher',
};

export function isReviewReason(value: unknown): value is ReviewReason {
  return typeof value === 'string' && (REVIEW_REASONS as readonly string[]).includes(value);
}

export function reviewReasonLabel(code: unknown): string | null {
  return isReviewReason(code) ? LABELS[code] : null;
}

/** Most specific first: when several questions are pending, the label shows the first match. */
const PRIORITY: readonly ReviewReason[] = [
  'wrong_language',
  'unclear_audio',
  'transcription_unavailable',
  'grading_unavailable',
  'grading_incomplete',
];

type SummaryQuestion = {
  status?: unknown;
  failureReason?: unknown;
  reviewReason?: unknown;
  languageReasons?: unknown;
};

function questionReason(q: SummaryQuestion): ReviewReason | null {
  if (q.status !== 'pending_review') return null;
  if (typeof q.failureReason === 'string' && q.failureReason) return 'transcription_unavailable';
  if (q.reviewReason === 'grading_unavailable') return 'grading_unavailable';
  if (q.reviewReason === 'wrong_language') {
    const reasons = Array.isArray(q.languageReasons) ? (q.languageReasons as LanguageSignalReason[]) : [];
    // Another script / detected language / grader says "other language" -> wrong language.
    // Only low-confidence or incoherent-transcript signals -> the audio was unclear.
    return reasons.length === 0 || reasons.some((r) => DEFINITIVE_REASONS.has(r)) ? 'wrong_language' : 'unclear_audio';
  }
  return 'grading_incomplete';
}

/**
 * Reason for a pending_review submission from the final summary that /api/exam/submit
 * stores (lib/examSession.ts computeFinalResult breakdown). null = no specific reason.
 */
export function reviewReasonFromSummary(examType: unknown, summary: Record<string, unknown> | null | undefined): ReviewReason | null {
  const type = typeof examType === 'string' && examType ? examType : 'audio';
  if (type === 'essay') return 'essay_manual';
  if (!summary) return null;
  if (type === 'mcq') return typeof summary.invalidKeys === 'number' && summary.invalidKeys > 0 ? 'answer_key_invalid' : null;
  const questions = Array.isArray(summary.questions) ? (summary.questions as SummaryQuestion[]) : [];
  const found = new Set(questions.map(questionReason).filter((r): r is ReviewReason => r !== null));
  return PRIORITY.find((r) => found.has(r)) ?? (summary.pending_review === true ? 'grading_incomplete' : null);
}

/** Label for a session row: the stored column if valid, else derived from the summary. */
export function sessionReviewReason(
  row: { status?: unknown; review_reason?: unknown },
  examType: unknown,
  summary: Record<string, unknown> | null | undefined
): ReviewReason | null {
  if (row.status !== 'pending_review' && row.status !== 'evaluation_failed') return null;
  if (isReviewReason(row.review_reason)) return row.review_reason;
  return reviewReasonFromSummary(examType, summary);
}
