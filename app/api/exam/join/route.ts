import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { answeredQuestionIds, checkJoinWindow, isUuid, toStudentQuestions } from '@/lib/examPublic';
import { EXAM_END_GRACE_MS, SESSION_MAX_AGE_MS, generateSessionToken, verifySessionToken } from '@/lib/examSession';
import { getRateLimiter, tooManyRequests } from '@/lib/rateLimit';
import { getTrustedClientIp } from '@/lib/clientIp';

export const dynamic = 'force-dynamic';

// Generous per-IP limit: a whole class can join from one school NAT address.
const joinLimiter = getRateLimiter({ name: 'exam-join-ip', max: 60, windowMs: 10 * 60 * 1000 });

const MAX_NAME_CHARS = 100;
const MAX_CODE_CHARS = 64;

/**
 * POST /api/exam/join
 * Body: { examId, studentName, studentCode?, resume?: { sessionId, token } }
 *
 * Starts a session and returns { sessionId, sessionToken, questions } where the token
 * is a random secret the browser must present to /transcribe, /evaluate and /submit.
 * Only its SHA-256 hash is stored.
 *
 * Rejoin policy (in-progress session with the same name):
 *   - with the matching token ({ resume }) -> resume THAT session, same variant's
 *     questions, no new token;
 *   - without it -> 409. Issuing a new token to anyone who types the same name would
 *     let them hijack another student's session, so we reject instead.
 *   - sessions older than SESSION_MAX_AGE_MS are abandoned and don't block the name.
 */
export async function POST(request: Request) {
  const rl = await joinLimiter.limit(getTrustedClientIp(request));
  if (!rl.allowed) {
    const r = tooManyRequests(rl.retryAfterSeconds);
    return NextResponse.json(r.body, r.init);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const examId = body?.examId;
    const studentName = typeof body?.studentName === 'string' ? body.studentName.trim().slice(0, MAX_NAME_CHARS) : '';
    const studentCode = typeof body?.studentCode === 'string' ? body.studentCode.trim().slice(0, MAX_CODE_CHARS) : '';

    if (!isUuid(examId) || !studentName) {
      return NextResponse.json({ error: 'A valid exam link and your full name are required.' }, { status: 400 });
    }

    // 1. Exam must exist, be open, and not be past its end time.
    const { data: exam } = await supabaseAdmin
      .from('exams')
      .select('id, title, exam_type, status, start_time, end_time')
      .eq('id', examId)
      .maybeSingle();

    if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 });
    const joinWindow = checkJoinWindow(exam, Date.now(), EXAM_END_GRACE_MS);
    if (!joinWindow.ok) {
      if (joinWindow.reason === 'not_started') {
        return NextResponse.json(
          { error: 'This exam has not started yet.', code: 'not_started', opensAt: joinWindow.opensAt },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'This exam is currently not open for submissions.', code: joinWindow.reason }, { status: 403 });
    }

    // 2. Variants and their questions (server-side; answers never leave the server).
    const { data: models, error: modelsError } = await supabaseAdmin
      .from('exam_models')
      .select('id, label, questions(id, question_text, model_answer_text, order_index)')
      .eq('exam_id', exam.id)
      .order('label', { ascending: true });

    if (modelsError || !models || models.length === 0) {
      return NextResponse.json({ error: 'No question models have been created for this exam yet.' }, { status: 400 });
    }

    const examPayload = { id: exam.id, title: exam.title, type: exam.exam_type };

    // 3. Existing, still-fresh in-progress session for this name?
    const freshSince = new Date(Date.now() - SESSION_MAX_AGE_MS).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('student_sessions')
      .select('id, exam_model_id, session_token_hash, question_results')
      .eq('exam_id', exam.id)
      .eq('student_name', studentName)
      .eq('status', 'in_progress')
      .gte('started_at', freshSince)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const resume = body?.resume;
      const canResume =
        resume && resume.sessionId === existing.id && verifySessionToken(resume.token, existing.session_token_hash);
      if (!canResume) {
        return NextResponse.json(
          {
            error:
              'An exam with this name is already in progress. If this is you, continue in the browser tab where you started. Otherwise, enter your full name exactly as your teacher expects (for example, add your last name).',
            code: 'session_in_progress',
          },
          { status: 409 }
        );
      }
      // Rejoin-bug fix: return the questions of THIS session's assigned variant.
      const model = models.find((m) => m.id === existing.exam_model_id);
      if (!model) return NextResponse.json({ error: 'Exam session could not be resumed.' }, { status: 409 });
      return NextResponse.json({
        success: true,
        resumed: true,
        sessionId: existing.id,
        exam: examPayload,
        assignedModel: { id: model.id, label: model.label },
        questions: toStudentQuestions(model.questions || []),
        // Lets the browser continue at the first unanswered question after a refresh.
        answeredQuestionIds: answeredQuestionIds(existing.question_results),
      });
    }

    // 4. New session: round-robin across variants that have the full question set.
    const { count: sessionCount } = await supabaseAdmin
      .from('student_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('exam_id', exam.id);

    const maxQuestionCount = Math.max(...models.map((m) => m.questions?.length || 0));
    const validModels = models.filter((m) => m.questions && m.questions.length === maxQuestionCount && maxQuestionCount > 0);
    const modelsToUse = validModels.length > 0 ? validModels : models;
    const assignedModel = modelsToUse[(sessionCount || 0) % modelsToUse.length];
    if (!assignedModel.questions || assignedModel.questions.length === 0) {
      // Previously this started a session with zero questions and crashed the exam room.
      return NextResponse.json({ error: 'This exam has no questions yet. Please contact your teacher.' }, { status: 400 });
    }

    const { token, hash } = generateSessionToken();
    const codeToUse = studentCode || `STU-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data: created, error: insertError } = await supabaseAdmin
      .from('student_sessions')
      .insert([
        {
          exam_id: exam.id,
          exam_model_id: assignedModel.id,
          student_name: studentName,
          student_code: codeToUse,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          session_token_hash: hash,
        },
      ])
      .select('id')
      .single();

    if (insertError || !created) {
      console.error('Error creating student session:', insertError?.message);
      return NextResponse.json({ error: 'Failed to start the exam session.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      resumed: false,
      sessionId: created.id,
      sessionToken: token,
      exam: examPayload,
      assignedModel: { id: assignedModel.id, label: assignedModel.label },
      // Text, order, time limit and MCQ option texts only (no answers/explanations/correct index).
      questions: toStudentQuestions(assignedModel.questions || []),
    });
  } catch (err) {
    console.error('API /exam/join error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
