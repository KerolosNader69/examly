import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserFromRequest } from '@/lib/serverAuth';
import { isUuid, recordingPathFromStored } from '@/lib/examPublic';
import { isRecordingPathFor } from '@/lib/mediaCapture';

export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 60 minutes
const noStore = { 'Cache-Control': 'no-store' };

/**
 * GET /api/teacher/recording-url?sessionId=<student session uuid>[&questionId=<question uuid>]
 *
 * With questionId: the recording of that one answer (question_results[questionId].recordingPath,
 * uploaded per question). Without: the legacy combined recording (recording_url).
 *
 * Teacher-only. Verifies the caller's Supabase access token, checks that the
 * session belongs to an exam the caller owns, then returns a 60-minute signed URL
 * for the recording in the private "exam-recordings" bucket.
 * Unknown session and "not your exam" both return 404 so ids can't be probed.
 */
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  }

  const params = new URL(request.url).searchParams;
  const sessionId = params.get('sessionId');
  const questionId = params.get('questionId');
  if (!isUuid(sessionId) || (questionId !== null && !isUuid(questionId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore });
  }

  try {
    const { data: session } = await supabaseAdmin
      .from('student_sessions')
      .select('id, recording_url, question_results, exams(teacher_id)')
      .eq('id', sessionId)
      .maybeSingle();

    const exam = session?.exams as { teacher_id?: string } | { teacher_id?: string }[] | null | undefined;
    const ownerId = Array.isArray(exam) ? exam[0]?.teacher_id : exam?.teacher_id;

    if (!session || !ownerId || ownerId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore });
    }

    let path: string | null;
    if (questionId) {
      const stored = (session.question_results as Record<string, { recordingPath?: unknown }> | null)?.[questionId]?.recordingPath;
      path = isRecordingPathFor(stored, session.id, questionId) ? stored : null;
    } else {
      path = recordingPathFromStored(session.recording_url);
    }
    if (!path) {
      return NextResponse.json({ error: 'No recording for this submission' }, { status: 404, headers: noStore });
    }

    const { data: signed, error } = await supabaseAdmin.storage
      .from('exam-recordings')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !signed?.signedUrl) {
      console.error('Error creating signed recording URL:', error?.message);
      return NextResponse.json({ error: 'Recording unavailable' }, { status: 404, headers: noStore });
    }

    return NextResponse.json(
      { url: signed.signedUrl, path, expiresIn: SIGNED_URL_TTL_SECONDS },
      { headers: noStore }
    );
  } catch (err) {
    console.error('API /teacher/recording-url error:', err);
    return NextResponse.json({ error: 'Recording unavailable' }, { status: 500, headers: noStore });
  }
}
