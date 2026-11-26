import { NextResponse } from 'next/server';
import { authorizeStudentSession, recordQuestionResult } from '@/lib/examSessionServer';
import { isFinalQuestionResult } from '@/lib/examSession';
import { getRateLimiter, tooManyRequests } from '@/lib/rateLimit';
import { getTrustedClientIp } from '@/lib/clientIp';
import { questionTimeLimit } from '@/lib/examPublic';
import { ANSWER_DURATION_GRACE_SECONDS, MAX_TRANSCRIBE_ATTEMPTS, MAX_TRANSCRIBE_AUDIO_BYTES } from '@/lib/mediaCapture';
import { deepgramListenUrl, deepgramModelsFor, parseDeepgramResult } from '@/lib/deepgram';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Decoded AUDIO per answer. The browser sends an audio-only 32 kbps track here (video
 * goes to storage via /api/exam/upload-url). 3 MB keeps base64 + JSON under Vercel's
 * ~4.5 MB request-body limit; the old 25 MB cap could never be reached in production.
 */
const MAX_AUDIO_BYTES = MAX_TRANSCRIBE_AUDIO_BYTES;
/** Request body cap: base64 of MAX_AUDIO_BYTES plus JSON overhead. */
const MAX_BODY_BYTES = Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 64 * 1024;
const DEEPGRAM_TIMEOUT_MS = 40_000;
const LANGUAGE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
const ALLOWED_MIME = /^(audio|video)\/(webm|ogg|wav|x-wav|mp4|mpeg|mp3)(;.*)?$/;

const perQuestion = getRateLimiter({ name: 'exam-transcribe-question', max: MAX_TRANSCRIBE_ATTEMPTS, windowMs: 4 * 60 * 60 * 1000 });
const perIp = getRateLimiter({ name: 'exam-transcribe-ip', max: 300, windowMs: 10 * 60 * 1000 });

const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * POST /api/exam/transcribe
 * Body (JSON): { sessionId, token, questionId, audioBase64, mimeType?, language? }
 *
 * Requires a valid in-progress session + token; the question must belong to the
 * session's variant. The transcript is stored server-side in question_results (it is
 * what /evaluate grades). Returns only { success, transcript }.
 */
export async function POST(request: Request) {
  const ipRl = await perIp.limit(getTrustedClientIp(request));
  if (!ipRl.allowed) {
    const r = tooManyRequests(ipRl.retryAfterSeconds);
    return NextResponse.json(r.body, r.init);
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) return fail(413, 'Recording is too large.');

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, 'Recording is too large.');
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'Invalid request.');
  }

  const auth = await authorizeStudentSession({ sessionId: body.sessionId, token: body.token, questionId: body.questionId });
  if (!auth.ok) return fail(auth.httpStatus, auth.error);
  const { session, exam, question } = auth.ctx;
  const questionId = question!.id;
  // Longest accepted answer: THIS question's own limit plus slack for stop/upload latency.
  const maxAnswerSeconds = questionTimeLimit(question!.time_limit_seconds, exam.exam_type) + ANSWER_DURATION_GRACE_SECONDS;

  // A graded/finished question can't be re-recorded.
  if (isFinalQuestionResult(session.question_results[questionId])) {
    return fail(409, 'This question has already been answered.');
  }

  const qRl = await perQuestion.limit(`${session.id}:${questionId}`);
  if (!qRl.allowed) {
    const r = tooManyRequests(qRl.retryAfterSeconds, 'Too many attempts for this question.');
    return NextResponse.json(r.body, r.init);
  }

  if (typeof body.audioBase64 !== 'string' || body.audioBase64.length === 0) return fail(400, 'No recording received.');
  const audioBuffer = Buffer.from(body.audioBase64, 'base64');
  if (audioBuffer.length === 0) return fail(400, 'No recording received.');
  if (audioBuffer.length > MAX_AUDIO_BYTES) return fail(413, 'Recording is too large.');

  const mimeType = typeof body.mimeType === 'string' && ALLOWED_MIME.test(body.mimeType) ? body.mimeType : 'audio/webm';
  const language = typeof body.language === 'string' && LANGUAGE_RE.test(body.language) ? body.language : 'en';

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    // Our side is unavailable: the teacher reviews the recording; no fake transcript.
    console.warn('DEEPGRAM_API_KEY is not configured; question marked for review.');
    await recordQuestionResult(session.id, questionId, { transcriptionStatus: 'failed', transcript: '' });
    return NextResponse.json({ success: false, transcript: '', status: 'pending_review' });
  }

  try {
    const call = (model: string) =>
      fetch(deepgramListenUrl(model, language), {
        method: 'POST',
        headers: { Authorization: `Token ${apiKey}`, 'Content-Type': mimeType },
        body: new Uint8Array(audioBuffer),
        signal: AbortSignal.timeout(DEEPGRAM_TIMEOUT_MS),
      });

    // nova-2 has no Arabic: only fall back to it for languages it supports.
    const [primary, fallback] = deepgramModelsFor(language);
    let res = await call(primary);
    if (!res.ok && fallback && res.status !== 401 && res.status !== 403 && res.status !== 400) {
      console.warn(`Deepgram ${primary} returned ${res.status}, retrying with ${fallback}`);
      res = await call(fallback);
    }
    if (!res.ok) {
      console.error('Deepgram API HTTP error:', res.status);
      await recordQuestionResult(session.id, questionId, { transcriptionStatus: 'failed', transcript: '' });
      return NextResponse.json({ success: false, transcript: '', status: 'pending_review' });
    }

    const result = parseDeepgramResult(await res.json());
    if (result.duration !== null && result.duration > maxAnswerSeconds) {
      return fail(413, 'Recording is longer than the allowed answer time.');
    }

    const saved = await recordQuestionResult(session.id, questionId, {
      transcript: result.transcript,
      confidence: result.confidence,
      transcriptionStatus: 'ok',
      status: 'transcribed',
    });
    if (!saved) return fail(409, 'This exam session is no longer active.');

    // An empty transcript is NOT graded here: the browser asks the student to re-record
    // (within the attempt limit) or to continue, which then records "no speech" = 0.
    return NextResponse.json({ success: true, transcript: result.transcript, noSpeech: result.transcript.trim().length < 3 });
  } catch (err) {
    // Includes Deepgram timeouts (AbortSignal): the teacher reviews; no fake transcript.
    console.error('API /exam/transcribe error:', err instanceof Error ? err.name : err);
    await recordQuestionResult(session.id, questionId, { transcriptionStatus: 'failed', transcript: '' });
    return NextResponse.json({ success: false, transcript: '', status: 'pending_review' });
  }
}
