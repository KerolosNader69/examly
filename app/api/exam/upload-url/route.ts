import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authorizeStudentSession, recordQuestionResult } from '@/lib/examSessionServer';
import { isFinalQuestionResult } from '@/lib/examSession';
import { baseMimeType, recordingObjectPath } from '@/lib/mediaCapture';
import { getRateLimiter, tooManyRequests } from '@/lib/rateLimit';
import { getTrustedClientIp } from '@/lib/clientIp';

export const dynamic = 'force-dynamic';

const BUCKET = 'exam-recordings';
const MEDIA_TYPES = new Set(['audio', 'video', 'audio_video']);
const ALLOWED_MIME = /^(audio|video)\/(webm|ogg|mp4)$/;

const perQuestion = getRateLimiter({ name: 'exam-upload-question', max: 5, windowMs: 4 * 60 * 60 * 1000 });
const perIp = getRateLimiter({ name: 'exam-upload-ip', max: 300, windowMs: 10 * 60 * 1000 });

const noStore = { 'Cache-Control': 'no-store' };
const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status, headers: noStore });

/**
 * POST /api/exam/upload-url
 * Body: { sessionId, token, questionId, mimeType }
 *
 * Returns a one-time signed upload URL so the browser uploads ONE answer's recording
 * (video or audio) straight to the private bucket, bypassing the ~4.5 MB serverless
 * body limit. The object path is fixed by the server (recordings/<session>/<question>-<ts>.<ext>)
 * and stored in question_results so the teacher can play each answer separately.
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
  if (!MEDIA_TYPES.has(exam.exam_type || 'audio')) return fail(400, 'This exam has no recordings.');
  if (isFinalQuestionResult(session.question_results[question!.id])) return fail(409, 'This question has already been answered.');

  const mime = baseMimeType(typeof body.mimeType === 'string' ? body.mimeType : '', '');
  if (!ALLOWED_MIME.test(mime)) return fail(400, 'Unsupported recording format.');

  const qRl = await perQuestion.limit(`${session.id}:${question!.id}`);
  if (!qRl.allowed) {
    const r = tooManyRequests(qRl.retryAfterSeconds, 'Too many uploads for this question.');
    return NextResponse.json(r.body, r.init);
  }

  const path = recordingObjectPath(session.id, question!.id, mime);
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) {
    console.error('createSignedUploadUrl failed:', error?.message);
    return fail(500, 'Could not prepare the upload.');
  }

  const saved = await recordQuestionResult(session.id, question!.id, { recordingPath: path, recordingMimeType: mime });
  if (!saved) return fail(409, 'This exam session is no longer active.');

  return NextResponse.json({ success: true, path: data.path || path, token: data.token }, { headers: noStore });
}
