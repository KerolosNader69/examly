-- ==============================================================================
-- EXAMLY MIGRATION 007: RECORDING CONSENT, RECORDING RETENTION, REVIEW REASON
-- Run in the Supabase SQL editor of the Examly project. NOT APPLIED YET.
--
-- PURELY ADDITIVE and IDEMPOTENT (safe to run more than once). Nothing is dropped,
-- no existing row is changed (all new columns are NULL for existing rows).
--
-- ORDER: the code that ships with this migration READS and WRITES these columns
-- (/api/exam/join, /upload-url, /transcribe, /submit, the retention cron, the teacher
-- review pages). PostgREST rejects a query naming an unknown column, so deploying that
-- code BEFORE this migration breaks joining and submitting exams. Run this first (or
-- in the same minute as the deploy). The currently deployed code ignores these columns.
-- ==============================================================================

BEGIN;

-- 1) Recording consent, per submission. Set by /api/exam/join when the student ticks
--    "I understand and agree". /upload-url and /transcribe refuse recordings for a
--    session whose consent_at is NULL.
ALTER TABLE public.student_sessions ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE public.student_sessions ADD COLUMN IF NOT EXISTS consent_version TEXT;

-- 2) Recording retention. When a session's recording files are deleted from Storage
--    (daily cron after 90 days, or the teacher's "Delete recording now" button), the
--    row keeps its transcript/scores and records when and why the files went.
ALTER TABLE public.student_sessions ADD COLUMN IF NOT EXISTS recording_deleted_at TIMESTAMPTZ;
ALTER TABLE public.student_sessions ADD COLUMN IF NOT EXISTS recording_deleted_reason TEXT;

-- 3) Why a submission is pending_review (short code, e.g. 'unclear_audio',
--    'wrong_language', 'grading_unavailable'); written by /api/exam/submit.
ALTER TABLE public.student_sessions ADD COLUMN IF NOT EXISTS review_reason TEXT;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_sessions_consent_version_len_chk') THEN
        ALTER TABLE public.student_sessions
            ADD CONSTRAINT student_sessions_consent_version_len_chk
            CHECK (consent_version IS NULL OR char_length(consent_version) <= 32);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_sessions_recording_deleted_reason_chk') THEN
        ALTER TABLE public.student_sessions
            ADD CONSTRAINT student_sessions_recording_deleted_reason_chk
            CHECK (recording_deleted_reason IS NULL OR recording_deleted_reason IN ('retention', 'teacher'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_sessions_review_reason_fmt_chk') THEN
        ALTER TABLE public.student_sessions
            ADD CONSTRAINT student_sessions_review_reason_fmt_chk
            CHECK (review_reason IS NULL OR review_reason ~ '^[a-z_]{1,40}$');
    END IF;
END $$;

-- 4) The retention job looks for consented sessions whose recordings are not deleted yet.
CREATE INDEX IF NOT EXISTS idx_student_sessions_recording_retention
    ON public.student_sessions (started_at)
    WHERE recording_deleted_at IS NULL AND consent_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- VERIFY (read-only)
-- ==============================================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'student_sessions'
--    AND column_name IN ('consent_at', 'consent_version', 'recording_deleted_at',
--                        'recording_deleted_reason', 'review_reason')
--  ORDER BY column_name;
-- -- EXPECTED: 5 rows, all nullable.
-- SELECT count(*) FILTER (WHERE consent_at IS NOT NULL) AS with_consent,
--        count(*) FILTER (WHERE recording_deleted_at IS NOT NULL) AS deleted
--   FROM public.student_sessions;
-- -- EXPECTED right after the migration: 0 and 0 (existing rows untouched).

-- ==============================================================================
-- ROLLBACK (manual; deploy code that no longer uses these columns first)
-- ==============================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS public.idx_student_sessions_recording_retention;
-- ALTER TABLE public.student_sessions DROP CONSTRAINT IF EXISTS student_sessions_review_reason_fmt_chk;
-- ALTER TABLE public.student_sessions DROP CONSTRAINT IF EXISTS student_sessions_recording_deleted_reason_chk;
-- ALTER TABLE public.student_sessions DROP CONSTRAINT IF EXISTS student_sessions_consent_version_len_chk;
-- ALTER TABLE public.student_sessions DROP COLUMN IF EXISTS review_reason;
-- ALTER TABLE public.student_sessions DROP COLUMN IF EXISTS recording_deleted_reason;
-- ALTER TABLE public.student_sessions DROP COLUMN IF EXISTS recording_deleted_at;
-- ALTER TABLE public.student_sessions DROP COLUMN IF EXISTS consent_version;
-- ALTER TABLE public.student_sessions DROP COLUMN IF EXISTS consent_at;
-- COMMIT;
