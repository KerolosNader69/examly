import { supabaseAdmin } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/examPublic';
import {
  checkSessionState,
  verifySessionToken,
  type SessionDenyReason,
  type StoredQuestionResult,
} from '@/lib/examSession';

/**
 * Server-only: authenticates a student request by sessionId + session token and loads
 * what the grading routes need. Used by /api/exam/transcribe, /evaluate and /submit.
 */

export interface AuthorizedSession {
  session: {
    id: string;
    exam_id: string;
    exam_model_id: string | null;
    status: string;
    started_at: string;
    question_results: Record<string, StoredQuestionResult>;
  };
  exam: { id: string; exam_type: string | null; status: string; end_time: string | null };
  question?: { id: string; question_text: string; model_answer_text: string | null; order_index: number | null; time_limit_seconds: number | null };
}

export type AuthorizeResult =
  | { ok: true; ctx: AuthorizedSession }
  | { ok: false; httpStatus: number; error: string; reason?: SessionDenyReason | 'unauthorized' | 'question' };

const DENY_MESSAGES: Record<SessionDenyReason, string> = {
  completed: 'This exam has already been submitted.',
  not_in_progress: 'This exam session is not active.',
  expired: 'This exam session has expired.',
  exam_closed: 'This exam is closed.',
};

export async function authorizeStudentSession(params: {
  sessionId: unknown;
  token: unknown;
  questionId?: unknown;
  allowExpired?: boolean;
}): Promise<AuthorizeResult> {
  // Same response for malformed ids, unknown sessions and wrong tokens.
  const unauthorized: AuthorizeResult = { ok: false, httpStatus: 401, error: 'Invalid or missing exam session.', reason: 'unauthorized' };
  if (!isUuid(params.sessionId) || typeof params.token !== 'string') return unauthorized;

  const { data: session } = await supabaseAdmin
    .from('student_sessions')
    .select('id, exam_id, exam_model_id, status, started_at, session_token_hash, question_results')
    .eq('id', params.sessionId)
    .maybeSingle();

  if (!session || !verifySessionToken(params.token, session.session_token_hash)) return unauthorized;

  const { data: exam } = await supabaseAdmin
    .from('exams')
    .select('id, exam_type, status, end_time')
    .eq('id', session.exam_id)
    .maybeSingle();

  const state = checkSessionState(session, exam ?? null, { allowExpired: params.allowExpired });
  if (!state.ok) return { ok: false, httpStatus: state.httpStatus, error: DENY_MESSAGES[state.reason], reason: state.reason };
  if (!exam) return { ok: false, httpStatus: 403, error: DENY_MESSAGES.exam_closed, reason: 'exam_closed' };

  const ctx: AuthorizedSession = {
    session: {
      id: session.id,
      exam_id: session.exam_id,
      exam_model_id: session.exam_model_id,
      status: session.status,
      started_at: session.started_at,
      question_results: (session.question_results as Record<string, StoredQuestionResult> | null) ?? {},
    },
    exam,
  };

  if (params.questionId !== undefined) {
    // The question must belong to THIS session's assigned variant.
    if (!isUuid(params.questionId) || !session.exam_model_id) {
      return { ok: false, httpStatus: 400, error: 'Unknown question for this session.', reason: 'question' };
    }
    const { data: question } = await supabaseAdmin
      .from('questions')
      .select('id, question_text, model_answer_text, order_index, time_limit_seconds')
      .eq('id', params.questionId)
      .eq('exam_model_id', session.exam_model_id)
      .maybeSingle();
    if (!question) return { ok: false, httpStatus: 400, error: 'Unknown question for this session.', reason: 'question' };
    ctx.question = question;
  }

  return { ok: true, ctx };
}

/**
 * Atomically merges one question's result (SQL function from migration 003). Only
 * succeeds while the session is still in progress. Returns the merged entry or null.
 */
export async function recordQuestionResult(
  sessionId: string,
  questionId: string,
  patch: StoredQuestionResult & { updatedAt?: string }
): Promise<StoredQuestionResult | null> {
  const { data, error } = await supabaseAdmin.rpc('record_question_result', {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_patch: { ...patch, updatedAt: new Date().toISOString() },
  });
  if (error) {
    console.error('record_question_result failed:', error.message);
    return null;
  }
  return (data as StoredQuestionResult | null) ?? null;
}
