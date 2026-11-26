-- ==============================================================================
-- EXAMLY MIGRATION 002: CLOSE DATA-EXPOSURE HOLES
-- Target: Supabase project chvismkgfrpgnsbwupye (run in the SQL editor).
--
-- Safe to run once. Wrapped in a single transaction: if any statement fails,
-- nothing is applied. Every statement is idempotent (IF EXISTS / guarded), so an
-- accidental second run is harmless.
--
-- SELF-CHECKING: section f) re-verifies the result inside the same transaction
-- and RAISES (rolling everything back) if any hole is still open, e.g. a grant
-- made by another role that this REVOKE could not remove, or a storage policy
-- that still exposes exam-recordings. Then nothing has changed; read the error,
-- fix the cause, re-run.
--
-- Runs AFTER 003-006 (already applied); it touches none of their objects.
--
-- DEPLOY THE APP CODE FIRST (or at the same time). After this migration the
-- student exam page can no longer read `exams` with the anon key; the new
-- /api/exam/info route (service role) must already be live.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- a) Remove public (anon + authenticated) read access to exam content
-- ------------------------------------------------------------------------------
-- These three SELECT policies applied to the `public` role, so any visitor could
-- read every published exam row (including ai_insights_summary with student
-- names and scores), every exam model, and every question including
-- model_answer_text (which also stores the MCQ correctOptionIndex).
--
-- Teachers keep full access to THEIR OWN data through the existing policies,
-- which are NOT touched here:
--   exams        "Teachers can manage own exams"                 FOR ALL  (auth.uid() = teacher_id)
--   exam_models  "Teachers can manage exam models of own exams"  FOR ALL  (exam.teacher_id = auth.uid())
--   questions    "Teachers can manage questions of own exams"    FOR ALL  (exam.teacher_id = auth.uid())
-- Students get exam data only through server routes that use the service role
-- (/api/exam/info returns safe fields only; /api/exam/join returns questions
-- without model answers or correct options).

DROP POLICY IF EXISTS "Students can view questions for published/active exams only" ON public.questions;
DROP POLICY IF EXISTS "Students can view exam models of accessible active exams"    ON public.exam_models;
DROP POLICY IF EXISTS "Public/Students can view active exams"                        ON public.exams;

-- ------------------------------------------------------------------------------
-- b) teachers: no self-service plan/status changes, no browser-side inserts
-- ------------------------------------------------------------------------------
-- Before: "Teachers can update own profile" had no WITH CHECK, and `authenticated`
-- could UPDATE every column (including plan and status), so a teacher could set
-- plan = 'pro'. "Teachers can insert own profile" let a teacher create their own
-- row with any plan/status.
--
-- Revoke all write privileges first (table-level REVOKE also removes column-level
-- grants in Postgres; the explicit column list makes that unambiguous), then
-- grant UPDATE back on only the columns the dashboard Settings page edits:
--   name, subdomain, logo_url   (app/dashboard/settings/page.tsx)
-- Deliberately NOT editable by teachers: id, email, plan, status, created_at,
-- brand_color. (email is used by the audit_logs SELECT policy to match a
-- teacher's own log rows, so letting a teacher change it would let them read
-- other actors' logs; brand_color has no editing UI.)

--
-- How the REVOKE really removes the capability (Postgres semantics):
--   * REVOKE UPDATE (plan, status) alone is NOT enough while a table-level UPDATE
--     grant exists: a table-level UPDATE covers every column.
--   * A table-level REVOKE UPDATE also removes every column-level UPDATE grant on
--     that table (documented in REVOKE), so the first statement clears both kinds.
--     The explicit column list is belt and braces.
--   * Roles also inherit grants made to PUBLIC, so PUBLIC is revoked as well.
--   * REVOKE only removes grants made BY the role running it (postgres). A grant
--     made by another role (e.g. supabase_admin) survives with only a WARNING.
--     Section f) checks the effective privilege with has_column_privilege(),
--     which counts table-level, column-level, PUBLIC and inherited grants from
--     any grantor, and aborts if plan/status/email/... are still updatable.

REVOKE INSERT, UPDATE ON public.teachers FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, name, email, subdomain, logo_url, brand_color, plan, status, created_at)
    ON public.teachers FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name, subdomain, logo_url) ON public.teachers TO authenticated;

DROP POLICY IF EXISTS "Teachers can update own profile" ON public.teachers;
CREATE POLICY "Teachers can update own profile"
    ON public.teachers FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Teacher rows are created only server-side (service role) by
-- /api/auth/provision-teacher and the OAuth callback, which always set
-- plan = 'free' and status = 'active'.
DROP POLICY IF EXISTS "Teachers can insert own profile" ON public.teachers;

-- ------------------------------------------------------------------------------
-- c) audit_logs: no client writes
-- ------------------------------------------------------------------------------
-- The INSERT policy's check `auth.role() IS NOT NULL` is true for anon too, so
-- anyone could write fake audit entries. All app writes already go through
-- server routes with the service role (which bypasses RLS), so no INSERT
-- policy is needed. The teacher SELECT policy on audit_logs is unchanged.

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

-- ------------------------------------------------------------------------------
-- d) Storage: exam recordings are private
-- ------------------------------------------------------------------------------
-- The bucket was public, so anyone with (or guessing) a URL could download a
-- student's recording. With public = false and NO storage.objects policies,
-- only the service role can read/write; teachers get short-lived signed URLs
-- from /api/teacher/recording-url after an ownership check.

UPDATE storage.buckets SET public = false WHERE id = 'exam-recordings';

-- ------------------------------------------------------------------------------
-- e) Data fix: stored recording URLs -> storage paths (one-off, idempotent)
-- ------------------------------------------------------------------------------
-- student_sessions.recording_url used to hold a full public URL. The app now
-- stores the object path (e.g. 'recordings/<session>-<ts>.webm') and signs it on
-- demand. Convert existing rows (2 demo recordings). Rows already holding a path
-- don't match the WHERE clause, so re-running changes nothing. (The app also
-- tolerates the old URL form, so this is cleanup rather than a hard requirement.)

UPDATE public.student_sessions
SET recording_url = regexp_replace(
        recording_url,
        '^https?://[^/]+/storage/v1/object/public/exam-recordings/',
        ''
    )
WHERE recording_url ~ '^https?://[^/]+/storage/v1/object/public/exam-recordings/';

-- ------------------------------------------------------------------------------
-- f) Self-check (still inside the transaction): RAISE => everything rolls back
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    bad text;
    r   text;
BEGIN
    -- exam content: no policy that anon or every role (public) gets for reading,
    -- other than the three teacher-owned ALL policies (auth.uid()-scoped).
    SELECT string_agg(tablename || ': ' || policyname, ', ') INTO bad
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('questions', 'exam_models', 'exams')
       AND cmd IN ('SELECT', 'ALL')
       AND roles && ARRAY['public', 'anon']::name[]
       AND policyname NOT IN ('Teachers can manage own exams',
                              'Teachers can manage exam models of own exams',
                              'Teachers can manage questions of own exams');
    IF bad IS NOT NULL THEN RAISE EXCEPTION '002 self-check: public read policies remain: %', bad; END IF;

    -- teachers: effective UPDATE only on name/subdomain/logo_url for authenticated,
    -- nothing for anon; no INSERT for either (any grantor, PUBLIC and inheritance).
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        SELECT string_agg(col, ', ') INTO bad
          FROM unnest(ARRAY['id', 'name', 'email', 'subdomain', 'logo_url', 'brand_color', 'plan', 'status', 'created_at']) AS col
         WHERE has_column_privilege(r, 'public.teachers', col, 'UPDATE')
           AND NOT (r = 'authenticated' AND col IN ('name', 'subdomain', 'logo_url'));
        IF bad IS NOT NULL THEN
            RAISE EXCEPTION '002 self-check: % can still UPDATE teachers(%). A grant from another grantor? See information_schema.column_privileges.', r, bad;
        END IF;
        IF has_table_privilege(r, 'public.teachers', 'INSERT') THEN
            RAISE EXCEPTION '002 self-check: % can still INSERT into teachers', r;
        END IF;
    END LOOP;
    IF NOT has_column_privilege('authenticated', 'public.teachers', 'name', 'UPDATE') THEN
        RAISE EXCEPTION '002 self-check: authenticated lost UPDATE(name) (Settings page would break)';
    END IF;

    -- teachers policies: no INSERT policy; UPDATE policy has WITH CHECK.
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teachers' AND cmd IN ('INSERT', 'ALL')) THEN
        RAISE EXCEPTION '002 self-check: teachers still has an INSERT/ALL policy';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teachers'
                    AND policyname = 'Teachers can update own profile' AND with_check IS NOT NULL) THEN
        RAISE EXCEPTION '002 self-check: teachers UPDATE policy without WITH CHECK';
    END IF;

    -- audit_logs: no client write policy.
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_logs' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')) THEN
        RAISE EXCEPTION '002 self-check: audit_logs still has a write policy';
    END IF;

    -- storage: bucket exists and is private, and no storage.objects policy mentions
    -- it (with public = false a SELECT policy would still expose recordings through
    -- the authenticated download endpoint). This migration does not drop storage
    -- policies itself: live has none, and on Supabase storage.objects is owned by
    -- supabase_storage_admin, so a DROP from the SQL editor may not be permitted.
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'exam-recordings' AND public = false) THEN
        RAISE EXCEPTION '002 self-check: bucket exam-recordings missing or still public';
    END IF;
    SELECT string_agg(policyname, ', ') INTO bad
      FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%exam-recordings%';
    IF bad IS NOT NULL THEN
        RAISE EXCEPTION '002 self-check: storage.objects policies still expose exam-recordings: % (drop them in Storage > Policies, then re-run)', bad;
    END IF;

    RAISE NOTICE '002 self-check passed';
END $$;

COMMIT;

-- ==============================================================================
-- ROLLBACK (manual, only if you must revert; restores the previous, INSECURE state)
-- ==============================================================================
-- BEGIN;
-- CREATE POLICY "Public/Students can view active exams" ON public.exams FOR SELECT
--     USING (status IN ('published', 'active') OR auth.uid() = teacher_id);
-- CREATE POLICY "Students can view exam models of accessible active exams" ON public.exam_models FOR SELECT
--     USING (EXISTS (SELECT 1 FROM public.exams WHERE exams.id = exam_models.exam_id
--                    AND exams.status IN ('published', 'active')));
-- CREATE POLICY "Students can view questions for published/active exams only" ON public.questions FOR SELECT
--     USING (EXISTS (SELECT 1 FROM public.exam_models JOIN public.exams ON exam_models.exam_id = exams.id
--                    WHERE exam_models.id = questions.exam_model_id AND exams.status IN ('published', 'active')));
-- GRANT INSERT, UPDATE ON public.teachers TO authenticated;
-- DROP POLICY IF EXISTS "Teachers can update own profile" ON public.teachers;
-- CREATE POLICY "Teachers can update own profile" ON public.teachers FOR UPDATE USING (auth.uid() = id);
-- CREATE POLICY "Teachers can insert own profile" ON public.teachers FOR INSERT WITH CHECK (auth.uid() = id);
-- CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT
--     WITH CHECK (auth.role() IS NOT NULL);
-- UPDATE storage.buckets SET public = true WHERE id = 'exam-recordings';
-- -- recording_url paths can stay as paths: the app signs both paths and old URLs.
-- COMMIT;
