-- Fix submissions table schema
-- Ensure all required columns exist

-- Check current submissions table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'submissions' 
ORDER BY ordinal_position;

-- Ensure all required columns exist
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS question_text TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS ai_evaluation JSONB;

-- Update question_id to TEXT if it's still UUID
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'submissions' 
        AND column_name = 'question_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.submissions ALTER COLUMN question_id TYPE TEXT;
    END IF;
END $$;

-- Verify the updated structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'submissions' 
ORDER BY ordinal_position;