import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { modelAnswerForGrading } from '@/lib/examPublic';
import { authorizeStudentSession, recordQuestionResult } from '@/lib/examSessionServer';
import { isFinalQuestionResult } from '@/lib/examSession';
import { geminiModels } from '@/lib/gemini';
import { GRADING_LIMITS, gradeTranscript, questionPatchFromGrade } from '@/lib/grading';
import { normalizeExamLanguage } from '@/lib/examLanguage';
import { assessTranscriptLanguage, mergeReasons } from '@/lib/languageCheck';
import { getRateLimiter, tooManyRequests } from '@/lib/rateLimit';
import { getTrustedClientIp } from '@/lib/clientIp';

export const dynamic = 'force-dynamic';
// Gemini grading is bounded by GRADING_LIMITS (2 attempts x 15 s, 35 s total budget);
// the extra headroom covers auth, rate limiting and the database write so a slow AI
// ends as pending_review instead of a platform timeout. Keep these in step.
export const maxDuration = 45;

const perQuestion = getRateLimiter({ name: 'exam-evaluate-question', max: 3, windowMs: 4 * 60 * 60 * 1000 });
const perIp = getRateLimiter({ name: 'exam-evaluate-ip', max: 300, windowMs: 10 * 60 * 1000 });

const noStore = { 'Cache-Control': 'no-store' };
const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status, headers: noStore });
/** Generic client response: never the score, feedback, raw model output or model answer. */
const respond = (status: 'graded' | 'no_speech' | 'pending_review') =>
  NextResponse.json({ success: true, status }, { headers: noStore });

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
  const { session, exam, question } = auth.ctx;
  const q = question!;
  const language = normalizeExamLanguage(exam.language);
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

  // grading_unavailable: the AI grader could not be reached or gave no usable answer
  // (shown to the teacher as "AI grading unavailable").
  const markPending = async (reviewReason?: 'grading_unavailable') => {
    await recordQuestionResult(session.id, q.id, { status: 'pending_review', score: null, ...(reviewReason ? { reviewReason } : {}) });
    return respond('pending_review');
  };

  // Transcription failed on our side: the teacher reviews the recording (failureReason is stored).
  if (stored.transcriptionStatus === 'failed') return markPending();

  const transcript = (stored.transcript || '').trim();
  if (transcript.length <= 2) {
    await recordQuestionResult(session.id, q.id, { status: 'no_speech', score: 0, feedback: 'No speech detected in recording.' });
    return respond('no_speech');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not configured; question marked for teacher review.');
    return markPending('grading_unavailable');
  }

  const ai = new GoogleGenAI({ apiKey });
  const outcome = await gradeTranscript({
    // No SDK retries (gradeTranscript owns the retry/timeout policy); abortSignal ends a hung attempt.
    generate: ({ model, contents, config, abortSignal }) =>
      ai.models.generateContent({ model, contents, config: { ...config, abortSignal, httpOptions: { timeout: GRADING_LIMITS.attemptTimeoutMs } } }),
    models: geminiModels(),
    questionText: q.question_text,
    modelAnswer: modelAnswerForGrading(q.model_answer_text),
    transcript,
    language,
  });
  if (outcome.status !== 'graded') return markPending('grading_unavailable');

  // STT-side language signals: those stored by /transcribe (incl. word confidences) plus a
  // re-check of the stored transcript + confidence (covers answers transcribed before
  // /transcribe stored them).
  const sttReasons = mergeReasons(
    stored.sttLanguageReasons,
    assessTranscriptLanguage({ transcript, language, confidence: stored.confidence ?? null })
  );

  // Applies exams.wrong_language_policy (review / penalize / ignore) to the grader's
  // verdict OR the STT signals. Feedback is stored for the TEACHER only.
  const patch = questionPatchFromGrade(outcome.result, exam.wrong_language_policy, language, sttReasons);
  const saved = await recordQuestionResult(session.id, q.id, patch);
  if (!saved) return fail(409, 'This exam session is no longer active.');
  return respond(patch.status === 'pending_review' ? 'pending_review' : 'graded');
}
