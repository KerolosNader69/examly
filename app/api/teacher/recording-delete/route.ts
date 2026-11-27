import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeacherFromRequest } from '@/lib/serverAuth';
import { isUuid } from '@/lib/examPublic';
import { deleteSessionRecordings } from '@/lib/recordingDeletion';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };
const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: noStore });

/**
 * POST /api/teacher/recording-delete   Body: { sessionId }
 *
 * Teacher-only "Delete this student's recording now". Deletes every recording file of
 * the session through the Storage API and marks the row (recording_deleted_reason =
 * 'teacher'); transcript and scores are kept. Same ownership check as
 * /api/teacher/recording-url: unknown session and "not your exam" both return 404.
 * Not allowed while the exam is still in progress. Repeating the call is harmless.
 */
export async function POST(request: Request) {
  const teacher = await getTeacherFromRequest(request);
  if (!teacher) return reply(401, { error: 'Unauthorized' });

  const body = await request.json().catch(() => null);
  const sessionId = body && typeof body === 'object' ? (body as { sessionId?: unknown }).sessionId : null;
  if (!isUuid(sessionId)) return reply(404, { error: 'Not found' });

  try {
    const { data: session } = await supabaseAdmin
      .from('student_sessions')
      .select('id, status, recording_url, question_results, recording_deleted_at, recording_deleted_reason, exams(teacher_id)')
      .eq('id', sessionId)
      .maybeSingle();

    const exam = session?.exams as { teacher_id?: string } | { teacher_id?: string }[] | null | undefined;
    const ownerId = Array.isArray(exam) ? exam[0]?.teacher_id : exam?.teacher_id;
    if (!session || !ownerId || ownerId !== teacher.teacherId) return reply(404, { error: 'Not found' });

    if (session.recording_deleted_at) {
      return reply(200, {
        success: true,
        alreadyDeleted: true,
        recordingDeletedAt: session.recording_deleted_at,
        recordingDeletedReason: session.recording_deleted_reason,
      });
    }
    if (session.status === 'in_progress') return reply(409, { error: 'The student is still taking this exam.' });

    const outcome = await deleteSessionRecordings(session, 'teacher', { dryRun: false });
    if (!outcome.ok) return reply(500, { error: 'The recording could not be deleted. Please try again.' });

    const { data: after } = await supabaseAdmin
      .from('student_sessions')
      .select('recording_deleted_at, recording_deleted_reason')
      .eq('id', session.id)
      .maybeSingle();
    console.info('[recording-delete] teacher deletion done', JSON.stringify({ files: outcome.files }));
    return reply(200, {
      success: true,
      recordingDeletedAt: after?.recording_deleted_at ?? new Date().toISOString(),
      recordingDeletedReason: after?.recording_deleted_reason ?? 'teacher',
    });
  } catch (err) {
    console.error('API /teacher/recording-delete error:', err instanceof Error ? err.message : 'unknown');
    return reply(500, { error: 'The recording could not be deleted. Please try again.' });
  }
}
