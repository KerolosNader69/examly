import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server in .env.local.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { examId } = body;

    if (!examId) {
      return NextResponse.json(
        { error: 'Missing required parameter: examId' },
        { status: 400 }
      );
    }

    // 1. Fetch target exam
    const { data: exam, error: examError } = await supabaseAdmin
      .from('exams')
      .select('id, title, teacher_id, status, ai_insights_summary')
      .eq('id', examId)
      .single();

    if (examError || !exam) {
      return NextResponse.json(
        { error: `Exam with ID "${examId}" was not found.` },
        { status: 404 }
      );
    }

    // 2. Fetch exam models and questions
    const { data: models } = await supabaseAdmin
      .from('exam_models')
      .select('id, label, questions(id, question_text, model_answer_text)')
      .eq('exam_id', exam.id);

    const questionsList: any[] = [];
    (models || []).forEach((m) => {
      (m.questions || []).forEach((q: any) => {
        questionsList.push({
          modelLabel: m.label,
          questionText: q.question_text,
          modelAnswer: q.model_answer_text,
        });
      });
    });

    // 3. Fetch student sessions for this exam
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('student_sessions')
      .select('id, student_name, student_code, ai_score, transcript, status')
      .eq('exam_id', exam.id);

    if (sessionsError) {
      console.error('Error querying student_sessions for insights:', sessionsError.message);
    }

    const allSubmissions = sessions || [];
    const scoredSessions = allSubmissions.filter((s) => s.ai_score != null);

    if (allSubmissions.length === 0) {
      const fallbackInsights = {
        summaryText: 'No student submissions have been recorded for this exam yet.',
        weakestQuestion: null,
        studentsNeedingFollowUp: [],
        comparisonNote: null,
      };

      await supabaseAdmin
        .from('exams')
        .update({ ai_insights_summary: fallbackInsights })
        .eq('id', exam.id);

      return NextResponse.json({ success: true, insights: fallbackInsights });
    }

    if (scoredSessions.length === 0) {
      const pendingInsights = {
        summaryText: `${allSubmissions.length} student submission(s) recorded. Evaluation is pending or requires manual teacher review.`,
        weakestQuestion: null,
        studentsNeedingFollowUp: [],
        comparisonNote: null,
      };

      await supabaseAdmin
        .from('exams')
        .update({ ai_insights_summary: pendingInsights })
        .eq('id', exam.id);

      return NextResponse.json({ success: true, insights: pendingInsights });
    }

    // 4. Fetch previous completed exam by same teacher for comparison
    const { data: prevExams } = await supabaseAdmin
      .from('exams')
      .select('id, title, ai_insights_summary')
      .eq('teacher_id', exam.teacher_id)
      .neq('id', exam.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    const prevExam = prevExams && prevExams.length > 0 ? prevExams[0] : null;

    // 5. Aggregate data for Gemini AI
    const classScores = scoredSessions.map((s: any) => Number(s.ai_score || 0));
    const avgClassScore = Math.round(
      classScores.reduce((a: number, b: number) => a + b, 0) / Math.max(1, classScores.length)
    );

    const promptData = {
      examTitle: exam.title,
      totalSubmissions: scoredSessions.length,
      averageScore: avgClassScore,
      questions: questionsList,
      submissions: scoredSessions.map((s: any) => ({
        studentName: s.student_name,
        score: s.ai_score,
        breakdown: (s as any).ai_score_breakdown,
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const responseText = response.text || '';
    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith('```json')) {
      cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let insightsResult;
    try {
      insightsResult = JSON.parse(cleanJsonStr);
    } catch {
      insightsResult = {
        summaryText: `Class average score is ${avgClassScore}%. ${scoredSessions.length} students completed the assessment.`,
        weakestQuestion: {
          questionText: questionsList[0]?.questionText || 'Oral Question 1',
          issueDescription: 'Students experienced varied difficulty across open-ended responses.',
        },
        studentsNeedingFollowUp: scoredSessions
          .filter((s: any) => (s.ai_score || 0) < 70)
          .map((s: any) => ({ name: s.student_name, score: s.ai_score })),
        comparisonNote: null,
      };
    }

    // 6. Save structured JSON into exams.ai_insights_summary column
    const { error: saveError } = await supabaseAdmin
      .from('exams')
      .update({ ai_insights_summary: insightsResult })
      .eq('id', exam.id);

    if (saveError) {
      console.error('Error saving ai_insights_summary to exams table:', saveError);
    }

    return NextResponse.json({
      success: true,
      insights: insightsResult,
    });
  } catch (err: any) {
    console.error('API /exam/generate-insights error:', err);
    return NextResponse.json(
      { error: err.message || 'An error occurred during AI insights generation.' },
      { status: 500 }
    );
  }
}
