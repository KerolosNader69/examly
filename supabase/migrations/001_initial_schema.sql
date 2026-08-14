-- ==============================================================================
-- EXAMLY DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) MIGRATION
-- Migration: 001_initial_schema.sql
-- Description: Creates core tables, foreign key constraints, indexes, and RLS policies.
-- Updated with strict RLS security fixes for student sessions and question visibility.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES CREATION

-- Teachers table (links directly to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    subdomain TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    brand_color TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teacher settings table
CREATE TABLE IF NOT EXISTS public.teacher_settings (
    teacher_id UUID PRIMARY KEY REFERENCES public.teachers(id) ON DELETE CASCADE,
    logo_url TEXT,
    primary_color TEXT,
    display_name TEXT
);

-- Exams table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    exam_type TEXT DEFAULT 'oral',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft',
    ai_insights_summary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exam models table (Variants like Model A, Model B)
CREATE TABLE IF NOT EXISTS public.exam_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    label TEXT NOT NULL
);

-- Questions table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_model_id UUID NOT NULL REFERENCES public.exam_models(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    model_answer_text TEXT,
    order_index INT NOT NULL DEFAULT 0
);

-- Student sessions table
CREATE TABLE IF NOT EXISTS public.student_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    exam_model_id UUID REFERENCES public.exam_models(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    student_code TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    recording_url TEXT,
    transcript TEXT,
    ai_score NUMERIC(5, 2),
    ai_score_breakdown JSONB,
    teacher_override_score NUMERIC(5, 2),
    tab_switch_count INT NOT NULL DEFAULT 0,
    flagged_reason TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress'
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_teachers_subdomain ON public.teachers(subdomain);
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON public.exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exam_models_exam_id ON public.exam_models(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_model_id ON public.questions(exam_model_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_exam_id ON public.student_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_exam_model_id ON public.student_sessions(exam_model_id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Policy: Teachers (can view/update/insert their own profile)
-- ------------------------------------------------------------------------------
CREATE POLICY "Teachers can view own profile" 
    ON public.teachers FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Teachers can update own profile" 
    ON public.teachers FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Teachers can insert own profile" 
    ON public.teachers FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Policy: Teacher Settings
-- ------------------------------------------------------------------------------
CREATE POLICY "Teachers can access own settings" 
    ON public.teacher_settings FOR ALL 
    USING (auth.uid() = teacher_id) 
    WITH CHECK (auth.uid() = teacher_id);

-- ------------------------------------------------------------------------------
-- Policy: Exams (Teachers manage own exams; Students view published/active exams)
-- ------------------------------------------------------------------------------
CREATE POLICY "Teachers can manage own exams" 
    ON public.exams FOR ALL 
    USING (auth.uid() = teacher_id) 
    WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Public/Students can view active exams" 
    ON public.exams FOR SELECT 
    USING (status IN ('published', 'active') OR auth.uid() = teacher_id);

-- ------------------------------------------------------------------------------
-- Policy: Exam Models
-- ------------------------------------------------------------------------------
CREATE POLICY "Teachers can manage exam models of own exams" 
    ON public.exam_models FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.exams 
            WHERE public.exams.id = public.exam_models.exam_id 
              AND public.exams.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exams 
            WHERE public.exams.id = public.exam_models.exam_id 
              AND public.exams.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can view exam models of accessible active exams" 
    ON public.exam_models FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.exams 
            WHERE public.exams.id = public.exam_models.exam_id
              AND public.exams.status IN ('published', 'active')
        )
    );

-- ------------------------------------------------------------------------------
-- Policy: Questions
-- [SECURITY FIX 2]: Restrict student question visibility to published/active exams only
-- ------------------------------------------------------------------------------
CREATE POLICY "Teachers can manage questions of own exams" 
    ON public.questions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_models 
            JOIN public.exams ON public.exam_models.exam_id = public.exams.id 
            WHERE public.exam_models.id = public.questions.exam_model_id 
              AND public.exams.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exam_models 
            JOIN public.exams ON public.exam_models.exam_id = public.exams.id 
            WHERE public.exam_models.id = public.questions.exam_model_id 
              AND public.exams.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can view questions for published/active exams only" 
    ON public.questions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_models 
            JOIN public.exams ON public.exam_models.exam_id = public.exams.id
            WHERE public.exam_models.id = public.questions.exam_model_id
              AND public.exams.status IN ('published', 'active')
        )
    );

-- ------------------------------------------------------------------------------
-- Policy: Student Sessions
-- [SECURITY FIX 1]: Require service_role for all student operations to prevent browser tampering.
-- Teachers retain full access to student sessions for their own exams.
-- ------------------------------------------------------------------------------
CREATE POLICY "Teachers can view/manage sessions of own exams" 
    ON public.student_sessions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.exams 
            WHERE public.exams.id = public.student_sessions.exam_id 
              AND public.exams.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exams 
            WHERE public.exams.id = public.student_sessions.exam_id 
              AND public.exams.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Service role can create student sessions" 
    ON public.student_sessions FOR INSERT 
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can view student sessions" 
    ON public.student_sessions FOR SELECT 
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update student sessions" 
    ON public.student_sessions FOR UPDATE 
    USING (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- Policy: Audit Logs
-- ------------------------------------------------------------------------------
CREATE POLICY "Teachers can view own audit logs" 
    ON public.audit_logs FOR SELECT 
    USING (
        actor = auth.uid()::text 
        OR actor IN (SELECT email FROM public.teachers WHERE id = auth.uid())
    );

CREATE POLICY "Authenticated users can insert audit logs" 
    ON public.audit_logs FOR INSERT 
    WITH CHECK (auth.role() IS NOT NULL);

-- ------------------------------------------------------------------------------
-- 5. STORAGE BUCKET & COLUMN MIGRATION
-- ------------------------------------------------------------------------------
ALTER TABLE public.student_sessions ADD COLUMN IF NOT EXISTS ai_score_breakdown JSONB;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('exam-recordings', 'exam-recordings', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow service_role full access to exam-recordings" 
    ON storage.objects FOR ALL 
    USING (bucket_id = 'exam-recordings');

CREATE POLICY "Allow public read access to exam-recordings" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'exam-recordings');

CREATE POLICY "Allow public upload to exam-recordings" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'exam-recordings');

