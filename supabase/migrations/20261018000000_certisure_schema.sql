-- ====================================================================
-- CERTISURE AI — SUPABASE DATABASE MIGRATION & RLS POLICIES
-- File: supabase/migrations/20261018000000_certisure_schema.sql
-- ====================================================================

-- 1. Ensure public.certificates table exists with required columns
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number TEXT NOT NULL,
    student_name TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    course_name TEXT,
    issue_date DATE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Ensure unique certificate number per user or globally
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'certificates_certificate_number_key'
    ) THEN
        ALTER TABLE public.certificates ADD CONSTRAINT certificates_certificate_number_key UNIQUE (certificate_number);
    END IF;
END $$;

-- 2. Add extension columns safely if they do not already exist
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS consent_granted BOOLEAN DEFAULT true;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS review_decision TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Safely expand status check constraint while preserving existing allowed values
DO $$
BEGIN
    ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_status_check;
    ALTER TABLE public.certificates ADD CONSTRAINT certificates_status_check
        CHECK (status IN ('pending', 'verified', 'rejected', 'flagged', 'mismatch', 'not_found', 'needs_review'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 3. Ensure public.verification_history exists
CREATE TABLE IF NOT EXISTS public.verification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID REFERENCES public.certificates(id) ON DELETE CASCADE,
    verification_status TEXT NOT NULL,
    verification_method TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 4. Helpful Performance Indexes
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON public.certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON public.certificates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_history_user_id ON public.verification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_history_cert_id ON public.verification_history(certificate_id);
CREATE INDEX IF NOT EXISTS idx_verification_history_created_at ON public.verification_history(created_at DESC);

-- 5. Row Level Security (RLS)
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_history ENABLE ROW LEVEL SECURITY;

-- Clean up any existing duplicate policies before recreating
DROP POLICY IF EXISTS "Users can view own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Users can insert own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Users can update own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Users can delete own certificates" ON public.certificates;

CREATE POLICY "Users can view own certificates"
    ON public.certificates FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certificates"
    ON public.certificates FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own certificates"
    ON public.certificates FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own certificates"
    ON public.certificates FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Verification History Policies
DROP POLICY IF EXISTS "Users can view own verification history" ON public.verification_history;
DROP POLICY IF EXISTS "Users can insert own verification history" ON public.verification_history;
DROP POLICY IF EXISTS "Users can update own verification history" ON public.verification_history;

CREATE POLICY "Users can view own verification history"
    ON public.verification_history FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification history"
    ON public.verification_history FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own verification history"
    ON public.verification_history FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Storage Bucket Configuration for Private "certificates" Bucket
-- Note: Bucket should be created in Supabase Dashboard (Private = ON, file limit = 5MB, mimeTypes: application/pdf, image/png, image/jpeg)
-- Ensure storage policies protect user path: <user_id>/<verification_id>/<filename>

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'certificates',
        'certificates',
        false,
        5242880,
        ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Users can upload own certificate documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own certificate documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own certificate documents" ON storage.objects;

CREATE POLICY "Users can upload own certificate documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'certificates' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can read own certificate documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'certificates' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can delete own certificate documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'certificates' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );
