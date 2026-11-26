import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isStudentVisibleStatus, isUuid, toPublicExamInfo } from '@/lib/examPublic';

export const dynamic = 'force-dynamic';

const NOT_FOUND = () =>
  NextResponse.json({ found: false, error: 'Exam not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

/**
 * GET /api/exam/info?id=<exam uuid>
 *
 * Student-facing exam lookup (service role; the anon key can no longer read exams).
 * Returns ONLY: id, title, type, start/end time, status, and the teacher's display
 * branding (name, logo, brand color). Never insights, teacher email, or questions.
 * Draft/closed exams and malformed ids all return the same 404.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NOT_FOUND();

  try {
    const { data: exam, error } = await supabaseAdmin
      .from('exams')
      .select('id, title, exam_type, subject, start_time, end_time, status, teacher_id')
      .eq('id', id)
      .maybeSingle();

    if (error || !exam || !isStudentVisibleStatus(exam.status)) return NOT_FOUND();

    const [{ data: teacher }, { data: settings }] = await Promise.all([
      supabaseAdmin.from('teachers').select('name, logo_url, brand_color').eq('id', exam.teacher_id).maybeSingle(),
      supabaseAdmin
        .from('teacher_settings')
        .select('display_name, logo_url, primary_color')
        .eq('teacher_id', exam.teacher_id)
        .maybeSingle(),
    ]);

    return NextResponse.json(
      { found: true, exam: toPublicExamInfo(exam, teacher ?? null, settings ?? null) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('API /exam/info error:', err);
    return NextResponse.json({ found: false, error: 'Could not load exam' }, { status: 500 });
  }
}
