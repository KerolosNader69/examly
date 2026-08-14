import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

    // Build update object
    const updatePayload: Record<string, any> = {
      completed_at: new Date().toISOString(),
      transcript: transcript || 'Audio response recorded and submitted.',
      recording_url: finalRecordingUrl,
      status: 'completed',
    };

    if (aiScore != null) {
      updatePayload.ai_score = aiScore;
    }

    if (aiScoreBreakdown != null) {
      updatePayload.ai_score_breakdown = aiScoreBreakdown;
    }

    if (tabSwitchCount != null) {
      updatePayload.tab_switch_count = tabSwitchCount;
    }

    if (flaggedReason != null) {
      updatePayload.flagged_reason = flaggedReason;
    }

    // Embed security metadata in ai_score_breakdown JSONB object as guaranteed fallback
    const breakdownObj = typeof aiScoreBreakdown === 'object' && aiScoreBreakdown ? { ...aiScoreBreakdown } : {};
    if (tabSwitchCount != null) breakdownObj.tab_switch_count = tabSwitchCount;
    if (flaggedReason != null) breakdownObj.flagged_reason = flaggedReason;
    updatePayload.ai_score_breakdown = breakdownObj;

    // 2. Update student_sessions row using service_role
    let { data: sessionData, error: updateError } = await supabaseAdmin
      .from('student_sessions')
      .update(updatePayload)
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Initial submission update error (retrying basic update):', updateError.message);
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
