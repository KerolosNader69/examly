-- ==============================================================================
-- EXAMLY MIGRATION 003: SESSION-BOUND GRADING
-- Target: Supabase project chvismkgfrpgnsbwupye (run in the SQL editor).
--
-- PURELY ADDITIVE: new nullable/defaulted columns and one new function. It does
-- not change or drop anything, and the currently deployed code ignores these
-- columns, so it is safe to run BEFORE deploying the Phase 2B code (and the new
-- code requires it, so run it first). Idempotent: safe to run more than once.
-- ==============================================================================

BEGIN;

-- 1) Per-session secret. /api/exam/join returns a random 32-byte token to the
--    student and stores ONLY its SHA-256 hex digest here; transcribe/evaluate/
--    submit require the token and compare hashes in constant time.
ALTER TABLE public.student_sessions
    ADD COLUMN IF NOT EXISTS session_token_hash TEXT;

-- 2) Server-owned per-question results, keyed by question id:
--    { "<question uuid>": { "transcript": "...", "transcriptionStatus": "ok|failed",
--       "status": "transcribed|graded|no_speech|pending_review", "score": 0-100,
--       "breakdown": {...}, "feedback": "...", "updatedAt": "..." } }
--    Written only by the server (service role). The existing ai_score_breakdown
--    column was previously client-supplied and is now just the final summary
--    computed by /api/exam/submit, so results are kept in a separate column.
ALTER TABLE public.student_sessions
    ADD COLUMN IF NOT EXISTS question_results JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Insights are generated once per exam; teachers can regenerate explicitly.
ALTER TABLE public.exams
    ADD COLUMN IF NOT EXISTS ai_insights_generated_at TIMESTAMPTZ;

-- 4) Atomic merge of one question's result into question_results, only while the
--    session is still in progress (so a submitted session can't be altered).
--    Returns the merged entry, or NULL if no in-progress session matched.
CREATE OR REPLACE FUNCTION public.record_question_result(
    p_session_id  uuid,
    p_question_id uuid,
    p_patch       jsonb
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    UPDATE public.student_sessions
       SET question_results = jsonb_set(
               coalesce(question_results, '{}'::jsonb),
               ARRAY[p_question_id::text],
               coalesce(question_results -> p_question_id::text, '{}'::jsonb) || p_patch,
               true
           )
     WHERE id = p_session_id
       AND status = 'in_progress'
    RETURNING question_results -> p_question_id::text;
$$;

-- Only the server (service role) may call it; never the browser.
REVOKE ALL ON FUNCTION public.record_question_result(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_question_result(uuid, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_question_result(uuid, uuid, jsonb) TO service_role;

COMMIT;

-- ==============================================================================
-- VERIFY (read-only)
-- ==============================================================================
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND ((table_name = 'student_sessions' AND column_name IN ('session_token_hash', 'question_results'))
--      OR (table_name = 'exams' AND column_name = 'ai_insights_generated_at'));
-- -- EXPECTED: 3 rows.
-- SELECT has_function_privilege('anon', 'public.record_question_result(uuid, uuid, jsonb)', 'EXECUTE') AS anon_exec,          -- false
--        has_function_privilege('authenticated', 'public.record_question_result(uuid, uuid, jsonb)', 'EXECUTE') AS auth_exec, -- false
--        has_function_privilege('service_role', 'public.record_question_result(uuid, uuid, jsonb)', 'EXECUTE') AS svc_exec;   -- true

-- ==============================================================================
-- ROLLBACK (manual)
-- ==============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.record_question_result(uuid, uuid, jsonb);
-- ALTER TABLE public.exams DROP COLUMN IF EXISTS ai_insights_generated_at;
-- ALTER TABLE public.student_sessions DROP COLUMN IF EXISTS question_results;
-- ALTER TABLE public.student_sessions DROP COLUMN IF EXISTS session_token_hash;
-- COMMIT;
