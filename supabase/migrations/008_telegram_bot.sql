-- ==============================================================================
-- EXAMLY MIGRATION 008: TELEGRAM BOT (Pro teachers create MCQ exams from a PDF)
-- Run in the Supabase SQL editor of the Examly project. NOT applied automatically.
--
-- PURELY ADDITIVE and IDEMPOTENT (safe to run more than once):
--   * four NEW tables, all service-role only (RLS on, no policies, grants revoked);
--   * one NEW private storage bucket for PDFs while they are being read.
-- No existing table, column, policy or bucket is changed. The deployed code does not
-- use any of this until TELEGRAM_BOT_ENABLED=true, so it can be run before or after
-- the code is deployed (the bot only needs it once the flag is on).
--
-- Numbered 008: 007_privacy_retention.sql comes first. Independent of 007 (run in any order).
--
-- Scheduling reuses the existing exams.status + exams.start_time: a "scheduled" exam
-- is status 'published' with start_time in the future, and /api/exam/join already
-- refuses new sessions before start_time (lib/examPublic.ts checkJoinWindow).
-- ==============================================================================

BEGIN;

-- 1) Which Telegram chat belongs to which teacher. One chat per teacher, one teacher per chat.
CREATE TABLE IF NOT EXISTS public.telegram_links (
    teacher_id UUID PRIMARY KEY REFERENCES public.teachers(id) ON DELETE CASCADE,
    chat_id    BIGINT NOT NULL UNIQUE,
    linked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) One-time link codes shown in the dashboard. Only a SHA-256 hash of the code is
--    stored; codes expire after 10 minutes and can be used once.
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
    code_hash  TEXT PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_teacher_id ON public.telegram_link_codes(teacher_id);

-- 3) Conversation state per chat (state machine + draft exam). Treated as expired by the
--    app after 24 hours without activity.
CREATE TABLE IF NOT EXISTS public.telegram_sessions (
    chat_id    BIGINT PRIMARY KEY,
    state      TEXT NOT NULL DEFAULT 'idle',
    draft_json JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'telegram_sessions_state_len_chk') THEN
        ALTER TABLE public.telegram_sessions
            ADD CONSTRAINT telegram_sessions_state_len_chk CHECK (char_length(state) <= 32);
    END IF;
END $$;

-- 4) Telegram update_ids already accepted (webhook retries are processed once).
CREATE TABLE IF NOT EXISTS public.telegram_updates (
    update_id   BIGINT PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telegram_updates_received_at ON public.telegram_updates(received_at);

-- Service role only: browsers (anon / authenticated) can neither read nor write these.
ALTER TABLE public.telegram_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_updates    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_links      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.telegram_link_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.telegram_sessions   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.telegram_updates    FROM PUBLIC, anon, authenticated;

-- 5) Private bucket for PDFs while they are read (the app deletes each file right after).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('telegram-pdfs', 'telegram-pdfs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ------------------------------------------------------------------------------
-- Verification (run after COMMIT; every row should say true):
-- SELECT 'tables' AS check, count(*) = 4 AS ok FROM information_schema.tables
--  WHERE table_schema = 'public' AND table_name IN ('telegram_links','telegram_link_codes','telegram_sessions','telegram_updates')
-- UNION ALL
-- SELECT 'rls', bool_and(relrowsecurity) FROM pg_class
--  WHERE relname IN ('telegram_links','telegram_link_codes','telegram_sessions','telegram_updates')
-- UNION ALL
-- SELECT 'bucket private', NOT public FROM storage.buckets WHERE id = 'telegram-pdfs';
--
-- Optional housekeeping (not required; the app ignores stale rows):
-- DELETE FROM public.telegram_updates    WHERE received_at < NOW() - INTERVAL '7 days';
-- DELETE FROM public.telegram_link_codes WHERE expires_at  < NOW() - INTERVAL '1 day';
-- DELETE FROM public.telegram_sessions   WHERE updated_at  < NOW() - INTERVAL '1 day';
--
-- ROLLBACK (only if the bot is turned off and unused; drops bot data only):
-- DROP TABLE IF EXISTS public.telegram_updates, public.telegram_sessions,
--                      public.telegram_link_codes, public.telegram_links;
-- DELETE FROM storage.objects WHERE bucket_id = 'telegram-pdfs';
-- DELETE FROM storage.buckets WHERE id = 'telegram-pdfs';
-- ------------------------------------------------------------------------------
