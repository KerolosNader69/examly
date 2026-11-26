import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeacherFromRequest } from '@/lib/serverAuth';
import { isUuid, toPublicExamInfo } from '@/lib/examPublic';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * GET /api/teacher/exam-preview?id=<exam uuid>
 *
 * Lets a teacher see the student landing view of their OWN exam in any status
 * (including drafts, which /api/exam/info hides). Requires the teacher's Bearer
 * token; other teachers' exams return the same 404 as unknown ids. Returns the
 * same safe fields as /api/exam/info (no insights, no questions).
 */
export async function GET(request: Request) {
  const teacher = await getTeacherFromRequest(request);
  if (!teacher) return NextResponse.json({ found: false, error: 'Unauthorized' }, { status: 401, headers: noStore });

  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ found: false, error: 'Exam not found' }, { status: 404, headers: noStore });

  const { data: exam } = await supabaseAdmin
    .from('exams')
    .select('id, title, exam_type, start_time, end_time, status, teacher_id')
    .eq('id', id)
    .maybeSingle();
  if (!exam || exam.teacher_id !== teacher.teacherId) {
    return NextResponse.json({ found: false, error: 'Exam not found' }, { status: 404, headers: noStore });
  }

  const [{ data: t }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('teachers').select('name, logo_url, brand_color').eq('id', exam.teacher_id).maybeSingle(),
    supabaseAdmin.from('teacher_settings').select('display_name, logo_url, primary_color').eq('teacher_id', exam.teacher_id).maybeSingle(),
  ]);

  return NextResponse.json(
    { found: true, preview: true, exam: toPublicExamInfo(exam, t ?? null, settings ?? null) },
    { headers: noStore }
  );
}
