import { NextResponse } from 'next/server';
import { authorizeStudentSession, recordQuestionResult } from '@/lib/examSessionServer';
import { isFinalQuestionResult } from '@/lib/examSession';
import { getRateLimiter, tooManyRequests } from '@/lib/rateLimit';
import { getTrustedClientIp } from '@/lib/clientIp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Decoded audio/video per answer (a 3-minute 720p webm clip fits comfortably). */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
/** Request body cap: base64 of MAX_AUDIO_BYTES plus JSON overhead. */
const MAX_BODY_BYTES = Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 64 * 1024;
/** Longest accepted answer (question limit is max 180 s, plus slack). */
const MAX_ANSWER_SECONDS = 200;
const LANGUAGE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
const ALLOWED_MIME = /^(audio|video)\/(webm|ogg|wav|x-wav|mp4|mpeg|mp3)(;.*)?$/;

const perQuestion = getRateLimiter({ name: 'exam-transcribe-question', max: 3, windowMs: 4 * 60 * 60 * 1000 });
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
  const { session, question } = auth.ctx;
  const questionId = question!.id;

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
      fetch(`https://api.deepgram.com/v1/listen?model=${model}&smart_format=true&punctuate=true&language=${encodeURIComponent(language)}`, {
        method: 'POST',
        headers: { Authorization: `Token ${apiKey}`, 'Content-Type': mimeType },
        body: new Uint8Array(audioBuffer),
      });

    let res = await call('nova-3');
    if (!res.ok && res.status !== 401 && res.status !== 403) {
      console.warn(`Deepgram nova-3 returned ${res.status}, retrying with nova-2`);
      res = await call('nova-2');
    }
    if (!res.ok) {
      console.error('Deepgram API HTTP error:', res.status);
      await recordQuestionResult(session.id, questionId, { transcriptionStatus: 'failed', transcript: '' });
      return NextResponse.json({ success: false, transcript: '', status: 'pending_review' });
    }

    const result = await res.json();
    const duration = Number(result?.metadata?.duration);
    if (Number.isFinite(duration) && duration > MAX_ANSWER_SECONDS) {
      return fail(413, 'Recording is longer than the allowed answer time.');
    }

    const transcript: string = String(result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').slice(0, 20_000);
    const saved = await recordQuestionResult(session.id, questionId, {
      transcript,
      transcriptionStatus: 'ok',
      status: 'transcribed',
    });
    if (!saved) return fail(409, 'This exam session is no longer active.');

    return NextResponse.json({ success: true, transcript });
  } catch (err) {
    console.error('API /exam/transcribe error:', err instanceof Error ? err.message : err);
    await recordQuestionResult(session.id, questionId, { transcriptionStatus: 'failed', transcript: '' });
    return NextResponse.json({ success: false, transcript: '', status: 'pending_review' });
  }
}
