import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { readResultSummary } from '@/lib/sessionSummary';
import { GoogleGenAI } from '@google/genai';
import { getTeacherFromRequest } from '@/lib/serverAuth';
import { isUuid } from '@/lib/examPublic';
import { geminiModels, stripJsonFence } from '@/lib/gemini';
import { getRateLimiter, tooManyRequests } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const insightsLimiter = getRateLimiter({ name: 'generate-insights-teacher', max: 20, windowMs: 60 * 60 * 1000 });

/**
 * POST /api/exam/generate-insights
 * Body: { examId, regenerate?: boolean }
 *
 * Teacher-only (Bearer token) and only for the teacher's OWN exam.
 * Insights are generated ONCE per exam (exams.ai_insights_generated_at). Later calls
 * return the stored insights without calling Gemini unless `regenerate: true`.
 * Placeholder summaries (no submissions / nothing scored yet) are stored but don't
 * set the generated flag, so real insights are produced once results exist.
 */
export async function POST(request: Request) {
  const teacher = await getTeacherFromRequest(request);
  if (!teacher) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const examId = body?.examId;
    const regenerate = body?.regenerate === true;
    if (!isUuid(examId)) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 });

    // 1. Exam must belong to the caller (same 404 for "missing" and "not yours").
    const { data: exam } = await supabaseAdmin
      .from('exams')
      .select('id, title, teacher_id, status, ai_insights_summary, ai_insights_generated_at')
      .eq('id', examId)
      .maybeSingle();
    if (!exam || exam.teacher_id !== teacher.teacherId) {
      return NextResponse.json({ error: 'Exam not found.' }, { status: 404 });
    }

    // 2. Generate once: return what we have unless the teacher explicitly regenerates.
    if (exam.ai_insights_generated_at && exam.ai_insights_summary && !regenerate) {
      return NextResponse.json({ success: true, insights: exam.ai_insights_summary, cached: true, generatedAt: exam.ai_insights_generated_at });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'AI insights are not available right now.' }, { status: 503 });

    // 3. Exam models and questions
    const { data: models } = await supabaseAdmin
      .from('exam_models')
      .select('id, label, questions(id, question_text, model_answer_text)')
      .eq('exam_id', exam.id);

    const questionsList: { modelLabel: string; questionText: string; modelAnswer: string | null }[] = [];
    (models || []).forEach((m) => {
      (m.questions || []).forEach((q) => {
        questionsList.push({ modelLabel: m.label, questionText: q.question_text, modelAnswer: q.model_answer_text });
      });
    });

    // 4. Student sessions for this exam
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('student_sessions')
      .select('id, student_name, student_code, ai_score, teacher_override_score, question_results, transcript, status')
      .eq('exam_id', exam.id);
    if (sessionsError) console.error('Error querying student_sessions for insights:', sessionsError.message);

    const allSubmissions = sessions || [];
    const effectiveScore = (s: { teacher_override_score: number | null; ai_score: number | null }) =>
      s.teacher_override_score ?? s.ai_score;
    const scoredSessions = allSubmissions.filter((s) => effectiveScore(s) != null);

    const storePlaceholder = async (insights: Record<string, unknown>) => {
      await supabaseAdmin.from('exams').update({ ai_insights_summary: insights }).eq('id', exam.id);
      return NextResponse.json({ success: true, insights, cached: false });
    };

    if (allSubmissions.length === 0) {
      return storePlaceholder({
        summaryText: 'No student submissions have been recorded for this exam yet.',
        weakestQuestion: null,
        studentsNeedingFollowUp: [],
        comparisonNote: null,
      });
    }
    if (scoredSessions.length === 0) {
      return storePlaceholder({
        summaryText: `${allSubmissions.length} student submission(s) recorded. Evaluation is pending or requires manual teacher review.`,
        weakestQuestion: null,
        studentsNeedingFollowUp: [],
        comparisonNote: null,
      });
    }

    const rl = await insightsLimiter.limit(teacher.teacherId);
    if (!rl.allowed) {
      const r = tooManyRequests(rl.retryAfterSeconds, 'Too many insight requests. Please try again later.');
      return NextResponse.json(r.body, r.init);
    }

    // 5. Previous completed exam by the same teacher, for comparison
    const { data: prevExams } = await supabaseAdmin
      .from('exams')
      .select('id, title, ai_insights_summary')
      .eq('teacher_id', exam.teacher_id)
      .neq('id', exam.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);
    const prevExam = prevExams && prevExams.length > 0 ? prevExams[0] : null;

    // 6. Aggregate class data for Gemini
    const classScores = scoredSessions.map((s) => Number(effectiveScore(s) || 0));
    const avgClassScore = Math.round(classScores.reduce((a, b) => a + b, 0) / Math.max(1, classScores.length));

    const promptData = {
      examTitle: exam.title,
      totalSubmissions: scoredSessions.length,
      averageScore: avgClassScore,
      questions: questionsList,
      submissions: scoredSessions.map((s) => ({
        studentName: s.student_name,
        score: effectiveScore(s),
        // Final summary only (per-question entries hold recording paths etc.).
        breakdown: readResultSummary(s),
        transcript: s.transcript,
      })),
      previousExamTitle: prevExam?.title || null,
    };

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert educational analytics AI for an oral assessment platform.
Analyze the following aggregated class performance data for the exam titled "${exam.title}".

[CLASS DATA]
${JSON.stringify(promptData, null, 2)}

Provide a comprehensive class-level analysis. Respond ONLY in valid JSON format with no markdown wrappers or extra commentary:
{
  "summaryText": "<2-3 sentence overall class performance summary including average score and general mastery level>",
  "weakestQuestion": {
    "questionText": "<exact text of the question where students struggled most or demonstrated key misconceptions>",
    "issueDescription": "<detailed explanation of the core misconception pattern or difficulty students encountered>"
  },
  "studentsNeedingFollowUp": [
    {
      "name": "<student name who scored below 70>",
      "score": <student numeric score>
    }
  ],
  "comparisonNote": "<1-2 sentence comparison note comparing performance to previous exam if previousExamTitle is present, or null>"
}`;

    let responseText = '';
    for (const model of geminiModels()) {
      try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        responseText = response.text || '';
        if (responseText) break;
      } catch (err) {
        console.warn(`Gemini ${model} insights call failed:`, err instanceof Error ? err.name : 'UnknownError');
      }
    }

    let insightsResult;
    try {
      insightsResult = JSON.parse(stripJsonFence(responseText));
    } catch {
      insightsResult = {
        summaryText: `Class average score is ${avgClassScore}%. ${scoredSessions.length} students completed the assessment.`,
        weakestQuestion: {
          questionText: questionsList[0]?.questionText || 'Oral Question 1',
          issueDescription: 'Students experienced varied difficulty across open-ended responses.',
        },
        studentsNeedingFollowUp: scoredSessions
          .filter((s) => (effectiveScore(s) || 0) < 70)
          .map((s) => ({ name: s.student_name, score: effectiveScore(s) })),
        comparisonNote: null,
      };
    }

    // 7. Store once, with the generated-at flag
    const generatedAt = new Date().toISOString();
    const { error: saveError } = await supabaseAdmin
      .from('exams')
      .update({ ai_insights_summary: insightsResult, ai_insights_generated_at: generatedAt })
      .eq('id', exam.id);
    if (saveError) console.error('Error saving ai_insights_summary:', saveError.message);

    return NextResponse.json({ success: true, insights: insightsResult, cached: false, generatedAt });
  } catch (err) {
    console.error('API /exam/generate-insights error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'An error occurred during AI insights generation.' }, { status: 500 });
  }
}
