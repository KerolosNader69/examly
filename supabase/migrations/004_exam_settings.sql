-- ==============================================================================
-- EXAMLY MIGRATION 004: EXAM SETTINGS (language, subject, per-question time limits,
-- wrong-language policy) + tab-switch termination flag.
-- Run in the Supabase SQL editor of the Examly project.
--
-- PURELY ADDITIVE and IDEMPOTENT (safe to run more than once). Nothing is dropped.
-- The currently deployed code ignores these columns, so run this BEFORE deploying
-- the code that uses them (that code selects these columns and fails without them).
-- ==============================================================================

BEGIN;

-- 1) exams.language: BCP-47-style code passed to Deepgram as `language=` (nova-3).
--    Allowed values are validated by the app (lib/examLanguage.ts); the CHECK only
--    keeps the shape sane so a bad value can't reach the STT URL.
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_language_format_chk') THEN
        ALTER TABLE public.exams
            ADD CONSTRAINT exams_language_format_chk CHECK (language ~ '^[a-z]{2,3}(-[A-Z]{2})?$');
    END IF;
END $$;

-- 2) exams.subject (free text from the builder; NULL for older exams).
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS subject TEXT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_subject_len_chk') THEN
        ALTER TABLE public.exams
            ADD CONSTRAINT exams_subject_len_chk CHECK (subject IS NULL OR char_length(subject) <= 100);
    END IF;
END $$;

-- 3) exams.wrong_language_policy: what happens when the grader reports that a spoken
--    answer is not in the exam language.
--      review   (default) -> question goes to pending_review, no automatic penalty
--      penalize           -> question scored 0
--      ignore             -> graded normally
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS wrong_language_policy TEXT NOT NULL DEFAULT 'review';
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_wrong_language_policy_chk') THEN
        ALTER TABLE public.exams
            ADD CONSTRAINT exams_wrong_language_policy_chk CHECK (wrong_language_policy IN ('review', 'penalize', 'ignore'));
    END IF;
END $$;

-- 4) questions.time_limit_seconds (30..600, default 60). On FIRST creation only, existing
--    essay questions get 600 s (the new essay default); before this, every question ran
--    60 s because the limit was never stored. Re-running does not touch rows again.
DO $$
DECLARE
    added boolean := NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'time_limit_seconds');
BEGIN
    ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS time_limit_seconds INT NOT NULL DEFAULT 60;
    IF added THEN
        UPDATE public.questions q
           SET time_limit_seconds = 600
          FROM public.exam_models m
          JOIN public.exams e ON e.id = m.exam_id
         WHERE q.exam_model_id = m.id
           AND e.exam_type = 'essay';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_time_limit_range_chk') THEN
        ALTER TABLE public.questions
            ADD CONSTRAINT questions_time_limit_range_chk CHECK (time_limit_seconds BETWEEN 30 AND 600);
    END IF;
END $$;

-- 5) student_sessions.ended_by_tab_switch: the exam was ended by the tab-switch rule
--    (answers given so far are kept and scored; the teacher sees the flag in review).
ALTER TABLE public.student_sessions ADD COLUMN IF NOT EXISTS ended_by_tab_switch BOOLEAN NOT NULL DEFAULT false;

COMMIT;

-- ==============================================================================
-- VERIFY (read-only)
-- ==============================================================================
-- SELECT table_name, column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND ((table_name = 'exams' AND column_name IN ('language', 'subject', 'wrong_language_policy'))
--      OR (table_name = 'questions' AND column_name = 'time_limit_seconds')
--      OR (table_name = 'student_sessions' AND column_name = 'ended_by_tab_switch'))
--  ORDER BY table_name, column_name;
-- -- EXPECTED: 5 rows.
-- SELECT conname FROM pg_constraint
--  WHERE conname IN ('exams_language_format_chk', 'exams_subject_len_chk',
--                    'exams_wrong_language_policy_chk', 'questions_time_limit_range_chk');
-- -- EXPECTED: 4 rows.

-- ==============================================================================
-- ROLLBACK (manual)
-- ==============================================================================
-- BEGIN;
-- ALTER TABLE public.student_sessions DROP COLUMN IF EXISTS ended_by_tab_switch;
-- ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_time_limit_range_chk;
-- ALTER TABLE public.questions DROP COLUMN IF EXISTS time_limit_seconds;
-- ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_wrong_language_policy_chk;
-- ALTER TABLE public.exams DROP COLUMN IF EXISTS wrong_language_policy;
-- ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_subject_len_chk;
-- ALTER TABLE public.exams DROP COLUMN IF EXISTS subject;
-- ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_language_format_chk;
-- ALTER TABLE public.exams DROP COLUMN IF EXISTS language;
-- COMMIT;
