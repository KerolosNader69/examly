-- ==============================================================================
-- EXAMLY MIGRATION 002: CLOSE DATA-EXPOSURE HOLES
-- Target: Supabase project chvismkgfrpgnsbwupye (run in the SQL editor).
--
-- Safe to run once. Wrapped in a single transaction: if any statement fails,
-- nothing is applied. Every statement is idempotent (IF EXISTS / guarded), so an
-- accidental second run is harmless.
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

REVOKE INSERT, UPDATE ON public.teachers FROM anon, authenticated;
REVOKE UPDATE (id, name, email, subdomain, logo_url, brand_color, plan, status, created_at)
    ON public.teachers FROM anon, authenticated;
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
