import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Increase body size limit for video recording uploads (base64 encoded)
export const maxDuration = 60; // Allow up to 60s for large video uploads
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sessionId,
      transcript,
      audioBase64,
      recordingUrl,
      aiScore,
      aiScoreBreakdown,
      mimeType,
      tabSwitchCount,
      flaggedReason,
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: sessionId' },
        { status: 400 }
      );
    }

    let finalRecordingUrl = recordingUrl || null;

    // 1. If raw audio base64 is supplied, upload to Supabase Storage "exam-recordings" bucket
    if (audioBase64) {
      try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const ext = mimeType?.includes('webm') ? 'webm' : 'wav';
        const filePath = `recordings/${sessionId}-${Date.now()}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('exam-recordings')
          .upload(filePath, audioBuffer, {
            contentType: mimeType || 'audio/wav',
            upsert: true,
          });

        if (uploadError) {
          console.error('Error uploading student audio recording:', uploadError);
        } else if (uploadData) {
          const { data: publicUrlData } = supabaseAdmin.storage
            .from('exam-recordings')
            .getPublicUrl(filePath);

          finalRecordingUrl = publicUrlData?.publicUrl || null;
        }
      } catch (uploadErr) {
        console.error('Audio upload processing exception:', uploadErr);
      }
    }

    // Auto-calculate score and breakdown if not provided
    let calculatedAiScore: number | null = aiScore != null ? aiScore : null;
    let calculatedAiBreakdown: Record<string, any> | null = aiScoreBreakdown != null ? aiScoreBreakdown : null;

    if (calculatedAiScore == null && sessionId) {
      try {
        const { data: sess } = await supabaseAdmin
          .from('student_sessions')
          .select('id, exam_id, exam_model_id')
          .eq('id', sessionId)
          .single();

        if (sess) {
          const { data: examData } = await supabaseAdmin
            .from('exams')
            .select('id, exam_type')
            .eq('id', sess.exam_id)
            .single();

          const { data: modelData } = await supabaseAdmin
            .from('exam_models')
            .select('id, questions(id, question_text, model_answer_text, order_index)')
            .eq('id', sess.exam_model_id)
            .single();

          const questions = ((modelData as any)?.questions || []).sort(
            (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
          );

          const mcqItemsInput: any[] = Array.isArray(body.mcqItems) ? body.mcqItems : [];

          if (examData?.exam_type === 'mcq' && questions.length > 0) {
            let totalCorrectCount = 0;
            const questionScores: any[] = [];

            questions.forEach((q: any, idx: number) => {
              let correctOptText = '';
              let correctOptLetter = 'A';
              let opts: string[] = [];
              let correctIdx = 0;
              let explanationText = '';

              if (q.model_answer_text && typeof q.model_answer_text === 'string') {
                if (q.model_answer_text.trim().startsWith('{')) {
                  try {
                    const parsed = JSON.parse(q.model_answer_text);
                    opts = parsed.options || [];
                    correctIdx = parsed.correctOptionIndex ?? 0;
                    explanationText = parsed.explanation || '';
                  } catch {}
                }
              }
              if (!opts || opts.length === 0) {
                opts = ['Option A', 'Option B', 'Option C', 'Option D'];
              }

              correctOptText = opts[correctIdx] || '';
              correctOptLetter = String.fromCharCode(65 + correctIdx);

              // Match student's submission item
              const clientItem = mcqItemsInput.find((item: any) => item.questionIndex === idx || item.questionId === q.id);

              let studentSelIdx: number | null = null;
              let studentSelLetter = 'None';
              let studentSelText = 'No option selected';

              if (clientItem) {
                studentSelIdx = clientItem.selectedOptionIndex ?? null;
                studentSelLetter = clientItem.selectedOptionLetter || (studentSelIdx !== null ? String.fromCharCode(65 + studentSelIdx) : 'None');
                studentSelText = clientItem.selectedOptionText || (studentSelIdx !== null ? opts[studentSelIdx] || '' : 'No option selected');
              } else {
                // Fallback: parse from transcript text
                const submittedText = transcript || '';
                const lines = submittedText.split('\n\n');
                const targetLine = lines.find((l: string) => l.toLowerCase().includes(`question ${idx + 1}`)) || '';
                const lineLower = targetLine.toLowerCase();

                opts.forEach((optText: string, oIdx: number) => {
                  const letter = String.fromCharCode(65 + oIdx).toLowerCase();
                  if (
                    (optText && lineLower.includes(optText.toLowerCase())) ||
                    lineLower.includes(`option ${letter}`) ||
                    lineLower.includes(`: ${letter}`)
                  ) {
                    studentSelIdx = oIdx;
                    studentSelLetter = String.fromCharCode(65 + oIdx);
                    studentSelText = optText;
                  }
                });
              }

              const isCorrect = studentSelIdx !== null && studentSelIdx === correctIdx;
              if (isCorrect) totalCorrectCount += 1;

              questionScores.push({
                questionIndex: idx,
                questionId: q.id,
                questionText: q.question_text,
                selectedOptionIndex: studentSelIdx,
                selectedOptionLetter: studentSelLetter,
                selectedOptionText: studentSelText,
                correctOptionIndex: correctIdx,
                correctOptionLetter: correctOptLetter,
                correctOptionText: correctOptText,
                isCorrect,
                score: isCorrect ? 100 : 0,
                options: opts,
                explanation: explanationText,
              });
            });

            calculatedAiScore = Math.round((totalCorrectCount / questions.length) * 100);
            calculatedAiBreakdown = {
              totalCorrect: totalCorrectCount,
              totalQuestions: questions.length,
              scorePercentage: calculatedAiScore,
              questionScores,
            };
          }
          // For audio/video/audio_video exams: if no AI score was provided by the client,
          // the session is flagged as needing manual review — NEVER assign a fake score.
          // The client-side flow is responsible for calling /api/exam/transcribe and
          // /api/exam/evaluate per question and passing the real score here.
        }
      } catch (evalErr) {
        console.error('Error auto-calculating score on submit:', evalErr);
      }
    }

    // Determine appropriate status based on whether AI evaluation succeeded
    let finalStatus = 'completed';

    // If we still have no AI score and it's NOT an MCQ (which auto-scores), flag for manual review
    if (calculatedAiScore == null && sessionId) {
      try {
        const { data: sessCheck } = await supabaseAdmin
          .from('student_sessions')
          .select('exam_id')
          .eq('id', sessionId)
          .single();
        if (sessCheck) {
          const { data: examCheck } = await supabaseAdmin
            .from('exams')
            .select('exam_type')
            .eq('id', sessCheck.exam_id)
            .single();
          if (examCheck && examCheck.exam_type !== 'mcq' && examCheck.exam_type !== 'essay') {
            // Audio/video/audio_video exam submitted without a real AI score
            finalStatus = 'evaluation_failed';
            if (!calculatedAiBreakdown) {
              calculatedAiBreakdown = {};
            }
            (calculatedAiBreakdown as Record<string, any>).evaluation_error =
              'AI evaluation was not performed. This session requires manual teacher review.';
          }
        }
      } catch (checkErr) {
        console.error('Error checking exam type for status:', checkErr);
      }
    }

    // Build update object
    const updatePayload: Record<string, any> = {
      completed_at: new Date().toISOString(),
      recording_url: finalRecordingUrl,
      status: finalStatus,
    };

    // For MCQ exams, store structured JSON breakdown in transcript so full per-question details are preserved
    if (calculatedAiBreakdown && (calculatedAiBreakdown.questionScores || calculatedAiBreakdown.totalCorrect != null)) {
      updatePayload.transcript = JSON.stringify(calculatedAiBreakdown);
    } else {
      updatePayload.transcript = transcript || 'Response submitted.';
    }

    if (calculatedAiScore != null) {
      updatePayload.ai_score = calculatedAiScore;
    }

    const breakdownObj = typeof calculatedAiBreakdown === 'object' && calculatedAiBreakdown ? { ...calculatedAiBreakdown } : {};
    if (tabSwitchCount != null) breakdownObj.tab_switch_count = tabSwitchCount;
    if (flaggedReason != null) breakdownObj.flagged_reason = flaggedReason;
    updatePayload.ai_score_breakdown = breakdownObj;

    if (tabSwitchCount != null) {
      updatePayload.tab_switch_count = tabSwitchCount;
    }

    if (flaggedReason != null) {
      updatePayload.flagged_reason = flaggedReason;
    }

    // 2. Update student_sessions row using service_role
    let { data: sessionData, error: updateError } = await supabaseAdmin
      .from('student_sessions')
      .update(updatePayload)
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Initial submission update error (retrying without optional columns):', updateError.message);
      delete updatePayload.tab_switch_count;
      delete updatePayload.flagged_reason;
      delete updatePayload.ai_score_breakdown;

      const fallbackRes = await supabaseAdmin
        .from('student_sessions')
        .update(updatePayload)
        .eq('id', sessionId)
        .select()
        .single();

      sessionData = fallbackRes.data;
      updateError = fallbackRes.error;
    }

    if (updateError || !sessionData) {
      console.error('Error updating student session submission:', updateError);
      return NextResponse.json(
        { error: `Failed to update student session: ${updateError?.message || 'Session not found'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: sessionData.id,
      recordingUrl: sessionData.recording_url,
      aiScore: sessionData.ai_score,
      aiScoreBreakdown: sessionData.ai_score_breakdown,
      completedAt: sessionData.completed_at,
      status: sessionData.status,
    });
  } catch (err: any) {
    console.error('API /exam/submit error:', err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
