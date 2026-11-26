-- ==============================================================================
-- EXAMLY MIGRATION 005: exam-recordings bucket MIME allow-list
-- Run in the Supabase SQL editor of the Examly project. Idempotent.
--
-- Safari/iOS records audio as audio/mp4 (AAC). It was missing from the allow-list,
-- so per-answer uploads from Safari were rejected. This sets the full list:
-- previous list + audio/mp4, audio/aac, audio/x-m4a.
--
-- Storage compares the upload's Content-Type with this list, so the app sends the
-- BASE type only ("audio/webm", never "audio/webm;codecs=opus").
-- ==============================================================================

BEGIN;

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
           'audio/wav', 'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/ogg',
           'audio/mp4', 'audio/aac', 'audio/x-m4a',
           'video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska'
       ]::text[]
 WHERE id = 'exam-recordings';

-- file_size_limit stays 50 MB. Video questions are capped at 300 s in code
-- (lib/examPublic.ts), so a 1 Mbps video answer is ~40 MB and fits.

COMMIT;

-- VERIFY (read-only)
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'exam-recordings';
-- EXPECTED: public = false, 12 MIME types including audio/mp4, audio/aac, audio/x-m4a.

-- ROLLBACK (manual): restore the previous list
-- UPDATE storage.buckets
--    SET allowed_mime_types = ARRAY['audio/wav','audio/webm','audio/mp3','audio/mpeg','audio/ogg',
--                                   'video/webm','video/mp4','video/quicktime','video/x-matroska']::text[]
--  WHERE id = 'exam-recordings';
