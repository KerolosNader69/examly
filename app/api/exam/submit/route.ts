import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authorizeStudentSession } from '@/lib/examSessionServer';
import { clampTabSwitchCount, computeFinalResult, endedByTabSwitch, sanitizeFlaggedReason } from '@/lib/examSession';
import { baseMimeType } from '@/lib/mediaCapture';
import { withResultSummary } from '@/lib/sessionSummary';
import { reviewReasonFromSummary } from '@/lib/reviewReason';

// Allow time for large combined video uploads
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Combined recording cap (decoded). */
const MAX_RECORDING_BYTES = 60 * 1024 * 1024;
const MAX_BODY_BYTES = Math.ceil((MAX_RECORDING_BYTES * 4) / 3) + 512 * 1024;
const MEDIA_TYPES = new Set(['audio', 'video', 'audio_video']);
const RECORDING_MIME = /^(audio|video)\/(webm|ogg|wav|x-wav|mp4)$/;

const noStore = { 'Cache-Control': 'no-store' };

/**
 * POST /api/exam/submit
 * Body: { sessionId, token, mcqItems?, essayAnswers?, audioBase64?, mimeType?,
 *         tabSwitchCount?, flaggedReason?, endedByTabSwitch? }
 *
 * Tab-switch termination sends the answers given so far plus endedByTabSwitch: they
 * are scored like a normal submit and the session is flagged (ended_by_tab_switch).
 *
 * - Requires the session token. Any client-supplied aiScore / aiScoreBreakdown /
 *   transcript is ignored: the result is computed on the server from the stored
 *   per-question results (audio/video), the database answer key (MCQ), or the
 *   student's essay text (essays are "pending_review", never auto-scored).
 * - The session is completed in ONE conditional update (... WHERE status =
 *   'in_progress'), so parallel or repeated submits can't both win; a second
 *   submit gets 409 and changes nothing.
 * - The final breakdown (plus tab_switch_count / flaggedReason) is stored in
 *   question_results._summary (lib/sessionSummary.ts): the live schema has no
 *   ai_score_breakdown or flagged_reason column. tab_switch_count is its own column
 *   (migration 006) so teachers can see and sort by it.
 * - Responds without score or breakdown (MCQ breakdowns contain the answer key).
 */
export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Submission is too large.' }, { status: 413, headers: noStore });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Submission is too large.' }, { status: 413, headers: noStore });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: noStore });
  }

  try {
    // Expired-but-open sessions may still be finalised with what was answered.
    const auth = await authorizeStudentSession({ sessionId: body.sessionId, token: body.token, allowExpired: true });
    if (!auth.ok) {
      const alreadySubmitted = auth.reason === 'completed';
      return NextResponse.json(
        { error: alreadySubmitted ? 'This exam has already been submitted.' : auth.error, alreadySubmitted },
        { status: auth.httpStatus, headers: noStore }
      );
    }
    const { session, exam } = auth.ctx;

    // 1. Questions of THIS session's variant, with the answer key (server-side only).
    const { data: questions } = session.exam_model_id
      ? await supabaseAdmin
          .from('questions')
          .select('id, question_text, model_answer_text, order_index')
          .eq('exam_model_id', session.exam_model_id)
      : { data: [] };

    // 2. Final result from server data only.
    const result = computeFinalResult({
      examType: exam.exam_type,
      questions: questions || [],
      questionResults: session.question_results,
      mcqSelections: body.mcqItems,
      essayAnswers: body.essayAnswers,
    });

    const tabSwitchCount = clampTabSwitchCount(body.tabSwitchCount);
    const flaggedReason = sanitizeFlaggedReason(body.flaggedReason);
    const breakdown: Record<string, unknown> = { ...result.breakdown };
    if (tabSwitchCount !== null) breakdown.tab_switch_count = tabSwitchCount;
    if (flaggedReason) breakdown.flaggedReason = flaggedReason;
    const terminated = endedByTabSwitch(body.endedByTabSwitch, body.flaggedReason);
    if (terminated) breakdown.ended_by_tab_switch = true;

    // 3. Optional combined recording for media exams -> private bucket path.
    let recordingPath: string | null = null;
    if (MEDIA_TYPES.has(exam.exam_type || 'audio') && session.consent_at && typeof body.audioBase64 === 'string' && body.audioBase64.length > 0) {
      const buffer = Buffer.from(body.audioBase64, 'base64');
      // Base type only: the bucket's allowed_mime_types has no codec parameters.
      const requestedMime = baseMimeType(typeof body.mimeType === 'string' ? body.mimeType : '', '');
      const mimeType = RECORDING_MIME.test(requestedMime) ? requestedMime : 'audio/webm';
      if (buffer.length > 0 && buffer.length <= MAX_RECORDING_BYTES) {
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const filePath = `recordings/${session.id}-${Date.now()}.${ext}`;
        const { data: uploaded, error: uploadError } = await supabaseAdmin.storage
          .from('exam-recordings')
          .upload(filePath, buffer, { contentType: mimeType, upsert: false });
        if (uploadError) console.error('Error uploading student recording:', uploadError.message);
        else recordingPath = uploaded?.path || filePath;
      } else if (buffer.length > MAX_RECORDING_BYTES) {
        console.warn('Combined recording exceeded size cap; not stored.');
      }
    }

    // 4. Atomic completion: only the first submit while in_progress wins.
    const updatePayload: Record<string, unknown> = {
      completed_at: new Date().toISOString(),
      status: result.status,
      ai_score: result.aiScore,
      // Per-question entries stay as read at authorization; the summary is added under
      // a reserved key. The status guard below means only an in-progress row is written.
      question_results: withResultSummary(session.question_results, breakdown),
      transcript: result.transcript || 'Response submitted.',
      recording_url: recordingPath,
      // Short code the teacher sees next to "Pending review" (migration 007).
      review_reason: result.status === 'pending_review' ? reviewReasonFromSummary(exam.exam_type, breakdown) : null,
    };
    if (tabSwitchCount !== null) updatePayload.tab_switch_count = tabSwitchCount;
    if (terminated) updatePayload.ended_by_tab_switch = true;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('student_sessions')
      .update(updatePayload)
      .eq('id', session.id)
      .eq('status', 'in_progress')
      .select('id, status, completed_at')
      .maybeSingle();

    if (updateError || !updated) {
      // Lost the race (or DB error): don't leave an orphaned upload behind.
      if (recordingPath) await supabaseAdmin.storage.from('exam-recordings').remove([recordingPath]);
      if (updateError) {
        console.error('Error completing student session:', updateError.message);
        return NextResponse.json({ error: 'Failed to submit the exam.' }, { status: 500, headers: noStore });
      }
      return NextResponse.json(
        { error: 'This exam has already been submitted.', alreadySubmitted: true },
        { status: 409, headers: noStore }
      );
    }

    return NextResponse.json(
      { success: true, sessionId: updated.id, status: updated.status, completedAt: updated.completed_at },
      { headers: noStore }
    );
  } catch (err) {
    console.error('API /exam/submit error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500, headers: noStore });
  }
}
