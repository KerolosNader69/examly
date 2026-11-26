-- ==============================================================================
-- VERIFICATION FOR MIGRATION 002 (read-only SELECTs; safe to run any time)
-- Run in the Supabase SQL editor of the Examly project right after 002.
-- Every query states its EXPECTED result for the live policy names (2026-11-26).
-- Run them one by one (the editor shows only the last result of a batch).
-- Any deviation: stop, do not continue the rollout, see supabase/DEPLOY_RUNBOOK.md.
-- ==============================================================================

-- 1) Exam content: no read policy for anon / every role except the three
--    teacher-owned ALL policies (they are TO public but scoped by auth.uid()).
--    EXPECTED: 0 rows.
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('questions', 'exam_models', 'exams')
  AND cmd IN ('SELECT', 'ALL')
  AND roles && ARRAY['public', 'anon']::name[]
  AND policyname NOT IN ('Teachers can manage own exams',
                         'Teachers can manage exam models of own exams',
                         'Teachers can manage questions of own exams');

-- 2) Full policy list after 002. EXPECTED: exactly these 11 rows
--    (roles {public} unless noted):
--    audit_logs       | Teachers can view own audit logs               | SELECT
--    exam_models      | Teachers can manage exam models of own exams   | ALL
--    exams            | Teachers can manage own exams                  | ALL
--    questions        | Teachers can manage questions of own exams     | ALL
--    student_sessions | Service role can create student sessions       | INSERT
--    student_sessions | Service role can update student sessions       | UPDATE
--    student_sessions | Service role can view student sessions         | SELECT
--    student_sessions | Teachers can view/manage sessions of own exams | ALL
--    teacher_settings | Teachers can access own settings               | ALL
--    teachers         | Teachers can update own profile                | UPDATE  roles {authenticated}, with_check (auth.uid() = id)
--    teachers         | Teachers can view own profile                  | SELECT
--    GONE: "Public/Students can view active exams", "Students can view exam models of
--    accessible active exams", "Students can view questions for published/active exams
--    only", "Teachers can insert own profile", "Authenticated users can insert audit logs".
SELECT tablename, policyname, cmd, roles, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) RLS still enabled. EXPECTED: 7 rows, rls_enabled = true on every row.
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('questions', 'exam_models', 'exams', 'teachers', 'audit_logs', 'student_sessions', 'teacher_settings')
ORDER BY relname;

-- 4) Recordings bucket is private; size limit and MIME list (005) unchanged.
--    EXPECTED: 1 row: public = false, file_size_limit = 52428800, 12 MIME types.
SELECT id, public, file_size_limit, cardinality(allowed_mime_types) AS mime_types
FROM storage.buckets WHERE id = 'exam-recordings';

-- 5) No storage policy mentions the bucket (service role only + signed URLs).
--    EXPECTED: 0 rows.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%exam-recordings%';

-- 6) Effective teachers UPDATE rights (counts table-level, column-level, PUBLIC and
--    inherited grants from any grantor). EXPECTED: 9 rows; authenticated_update = true
--    ONLY for name, subdomain, logo_url; every other cell false (plan/status false!).
SELECT col,
       has_column_privilege('authenticated', 'public.teachers', col, 'UPDATE') AS authenticated_update,
       has_column_privilege('anon',          'public.teachers', col, 'UPDATE') AS anon_update
FROM unnest(ARRAY['id', 'name', 'email', 'subdomain', 'logo_url', 'brand_color', 'plan', 'status', 'created_at']) AS col;

-- 7) No INSERT / table-wide UPDATE on teachers for the API roles.
--    EXPECTED: 1 row, all four false.
SELECT has_table_privilege('authenticated', 'public.teachers', 'INSERT') AS authenticated_insert,
       has_table_privilege('anon',          'public.teachers', 'INSERT') AS anon_insert,
       has_table_privilege('authenticated', 'public.teachers', 'UPDATE') AS authenticated_table_update,
       has_table_privilege('anon',          'public.teachers', 'UPDATE') AS anon_table_update;

-- 8) Who granted what (diagnose 6/7 if they fail). EXPECTED: exactly 3 rows:
--    grantee authenticated, privilege UPDATE, columns logo_url, name, subdomain.
SELECT grantor, grantee, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'teachers'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
  AND privilege_type IN ('UPDATE', 'INSERT')
ORDER BY grantee, column_name;

-- 9) audit_logs has no write policy. EXPECTED: 0 rows.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_logs' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');

-- 10) Stored recordings are paths, not public URLs. EXPECTED: 0 rows.
SELECT id, recording_url
FROM public.student_sessions
WHERE recording_url ILIKE 'http%';

-- 11) 003-006 objects untouched. EXPECTED: 1 row: rpc_service = true, rpc_anon = false,
--     rpc_auth = false, constraints = 5.
SELECT has_function_privilege('service_role',  'public.record_question_result(uuid, uuid, jsonb)', 'EXECUTE') AS rpc_service,
       has_function_privilege('anon',          'public.record_question_result(uuid, uuid, jsonb)', 'EXECUTE') AS rpc_anon,
       has_function_privilege('authenticated', 'public.record_question_result(uuid, uuid, jsonb)', 'EXECUTE') AS rpc_auth,
       (SELECT count(*) FROM pg_constraint
         WHERE conname IN ('exams_language_format_chk', 'exams_subject_len_chk', 'exams_wrong_language_policy_chk',
                           'questions_time_limit_range_chk', 'student_sessions_tab_switch_count_range_chk')) AS constraints;
