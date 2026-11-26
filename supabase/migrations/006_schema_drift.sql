-- ==============================================================================
-- EXAMLY MIGRATION 006: SCHEMA DRIFT (live DB vs. 001_initial_schema.sql)
-- Run in the Supabase SQL editor of the Examly project.
--
-- The live student_sessions table never got three columns from 001:
--   tab_switch_count, ai_score_breakdown, flagged_reason.
-- /api/exam/submit wrote all three, so PostgREST rejected the whole update
-- (PGRST204 "Could not find the 'ai_score_breakdown' column ... in the schema cache")
-- and every submit returned 500.
--
-- Resolution:
--   tab_switch_count    -> ADDED here (teachers see it in Results).
--   ai_score_breakdown  -> NOT added. The final breakdown is stored in
--                          question_results._summary (lib/sessionSummary.ts).
--   flagged_reason      -> NOT added. Stored in question_results._summary;
--                          ended_by_tab_switch (migration 004) is the queryable flag.
--
-- PURELY ADDITIVE and IDEMPOTENT. Existing rows get tab_switch_count = 0.
-- RUN THIS BEFORE DEPLOYING the code that writes tab_switch_count.
-- ==============================================================================

BEGIN;

ALTER TABLE public.student_sessions
    ADD COLUMN IF NOT EXISTS tab_switch_count INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_sessions_tab_switch_count_range_chk') THEN
        ALTER TABLE public.student_sessions
            ADD CONSTRAINT student_sessions_tab_switch_count_range_chk CHECK (tab_switch_count BETWEEN 0 AND 1000);
    END IF;
END $$;

-- Make PostgREST see the new column immediately (otherwise it can take a moment).
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- VERIFY (read-only)
-- ==============================================================================
-- SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'student_sessions' AND column_name = 'tab_switch_count';
-- -- EXPECTED: 1 row, integer, default 0, NOT NULL.

-- ==============================================================================
-- ROLLBACK (manual; deploy code that no longer writes tab_switch_count first)
-- ==============================================================================
-- BEGIN;
-- ALTER TABLE public.student_sessions DROP CONSTRAINT IF EXISTS student_sessions_tab_switch_count_range_chk;
-- ALTER TABLE public.student_sessions DROP COLUMN IF EXISTS tab_switch_count;
-- COMMIT;
