-- ==============================================================================
-- VERIFICATION FOR MIGRATION 002 (read-only SELECTs; safe to run any time)
-- Run in the Supabase SQL editor for project chvismkgfrpgnsbwupye after 002.
-- Each query states the EXPECTED result.
-- ==============================================================================

-- 1) No SELECT policy on questions / exam_models / exams applies to anon or the
--    public role. EXPECTED: 0 rows.
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('questions', 'exam_models', 'exams')
  AND cmd IN ('SELECT', 'ALL')
  AND (roles && ARRAY['public', 'anon']::name[]);

-- 1b) For reference: the policies that remain on those tables.
--     EXPECTED: only the three "Teachers can manage ..." policies (cmd = ALL).
SELECT tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('questions', 'exam_models', 'exams')
ORDER BY tablename, policyname;

-- 1c) Effective privileges as seen by anon: even with SELECT grants, RLS with no
--     matching policy returns nothing. EXPECTED: rls_enabled = true for all 3.
SELECT relname AS table, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('questions', 'exam_models', 'exams', 'teachers', 'audit_logs', 'student_sessions', 'teacher_settings')
ORDER BY relname;

-- 2) The recordings bucket is private. EXPECTED: one row, public = false.
SELECT id, name, public FROM storage.buckets WHERE id = 'exam-recordings';

-- 2b) No storage policies were added for that bucket. EXPECTED: 0 rows.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%exam-recordings%';

-- 3) `authenticated` / `anon` cannot change plan or status, and cannot INSERT.
--    EXPECTED: every *_update / *_insert column below is false, except
--    authenticated UPDATE on name, subdomain, logo_url = true.
SELECT
  col,
  has_column_privilege('authenticated', 'public.teachers', col, 'UPDATE') AS authenticated_update,
  has_column_privilege('anon',          'public.teachers', col, 'UPDATE') AS anon_update
FROM unnest(ARRAY['id', 'name', 'email', 'subdomain', 'logo_url', 'brand_color', 'plan', 'status', 'created_at']) AS col;

SELECT
  has_table_privilege('authenticated', 'public.teachers', 'INSERT') AS authenticated_insert,  -- EXPECTED false
  has_table_privilege('anon',          'public.teachers', 'INSERT') AS anon_insert,           -- EXPECTED false
  has_table_privilege('authenticated', 'public.teachers', 'UPDATE') AS authenticated_table_update; -- EXPECTED false (column-level only)

-- 3b) teachers policies. EXPECTED: no INSERT policy; the UPDATE policy has
--     with_check = (auth.uid() = id).
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'teachers'
ORDER BY cmd, policyname;

-- 4) audit_logs has no INSERT (or ALL) policy. EXPECTED: 0 rows.
SELECT policyname, roles, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_logs' AND cmd IN ('INSERT', 'ALL');

-- 5) Stored recordings are paths, not public URLs. EXPECTED: 0 rows.
SELECT id, recording_url
FROM public.student_sessions
WHERE recording_url ILIKE 'http%';
