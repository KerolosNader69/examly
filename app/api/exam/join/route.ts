import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { examId, studentName, studentCode } = body;

    if (!examId || !studentName) {
      return NextResponse.json(
        { error: 'Missing required parameters: examId and studentName are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch exam from Supabase
    const { data: exam, error: examError } = await supabaseAdmin
      .from('exams')
      .select('id, title, exam_type, status')
      .eq('id', examId)
      .single();

    if (examError || !exam) {
      return NextResponse.json(
        { error: `Exam with ID "${examId}" was not found.` },
        { status: 404 }
      );
    }

    if (exam.status !== 'published' && exam.status !== 'active') {
      return NextResponse.json(
        { error: 'This exam is currently not open or active for student submissions.' },
        { status: 400 }
      );
    }

    // 2. Fetch exam_models and questions for this exam
    const { data: models, error: modelsError } = await supabaseAdmin
      .from('exam_models')
      .select('id, label, questions(id, question_text, model_answer_text, order_index)')
      .eq('exam_id', exam.id)
      .order('label', { ascending: true });

    if (modelsError || !models || models.length === 0) {
      return NextResponse.json(
        { error: 'No question models have been created for this exam yet.' },
        { status: 400 }
      );
    }

    // 3. Count existing student_sessions for round-robin model assignment (A, B, C, A, B, C...)
    const { count: sessionCount, error: countError } = await supabaseAdmin
      .from('student_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('exam_id', exam.id);

    const currentCount = sessionCount || 0;
    const modelIndex = currentCount % models.length;
    const assignedModel = models[modelIndex];

    // Sort questions by order_index
    const sortedQuestions = (assignedModel.questions || []).sort(
      (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );

    // 4. Insert new row into student_sessions using service_role
    const codeToUse = studentCode || `STU-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('student_sessions')
      .insert([
        {
          exam_id: exam.id,
          exam_model_id: assignedModel.id,
          student_name: studentName,
          student_code: codeToUse,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (sessionError || !sessionData) {
      console.error('Error creating student session:', sessionError);
      return NextResponse.json(
        { error: `Failed to create student session: ${sessionError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: sessionData.id,
      exam: {
        id: exam.id,
        title: exam.title,
        type: exam.exam_type,
      },
      assignedModel: {
        id: assignedModel.id,
        label: assignedModel.label,
      },
      questions: sortedQuestions.map((q: any) => ({
        id: q.id,
        text: q.question_text,
        modelAnswer: q.model_answer_text,
        timeLimit: 60,
      })),
    });
  } catch (err: any) {
    console.error('API /exam/join error:', err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
