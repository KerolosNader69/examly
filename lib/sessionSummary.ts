/**
 * Final result summary of a student session, stored in question_results (client-safe:
 * no Node or Supabase imports; used by /api/exam/submit, insights and the dashboard).
 *
 * The live database has no ai_score_breakdown column. The final breakdown that
 * /api/exam/submit computes is stored inside student_sessions.question_results under
 * a reserved key (question keys are UUIDs, so it can't collide). It is written once,
 * by the same conditional update that completes the session.
 */

export const RESULT_SUMMARY_KEY = '_summary';

/** question_results with the final summary added (per-question entries kept as they are). */
export function withResultSummary(questionResults: unknown, summary: Record<string, unknown>): Record<string, unknown> {
  const base = questionResults && typeof questionResults === 'object' && !Array.isArray(questionResults) ? questionResults : {};
  return { ...(base as Record<string, unknown>), [RESULT_SUMMARY_KEY]: summary };
}

/** The final summary of a session row, or null (in-progress / older rows have none). */
export function readResultSummary(row: { question_results?: unknown } | null | undefined): Record<string, unknown> | null {
  const qr = row?.question_results;
  if (!qr || typeof qr !== 'object' || Array.isArray(qr)) return null;
  const s = (qr as Record<string, unknown>)[RESULT_SUMMARY_KEY];
  return s && typeof s === 'object' && !Array.isArray(s) ? (s as Record<string, unknown>) : null;
}

/** Tab-switch count for display: the column (migration 006), else the summary, else 0. */
export function sessionTabSwitchCount(row: { tab_switch_count?: unknown; question_results?: unknown } | null | undefined): number {
  const col = row?.tab_switch_count;
  if (typeof col === 'number' && Number.isFinite(col)) return col;
  const fromSummary = readResultSummary(row)?.tab_switch_count;
  return typeof fromSummary === 'number' && Number.isFinite(fromSummary) ? fromSummary : 0;
}
