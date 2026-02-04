-- Remove Questions Table and Related Functionality
-- CodeWars 2.0 - Questions will be loaded from JSON files only
-- Keep AI evaluation logging for answer checking

-- Drop question_locks table (depends on questions table)
DROP TABLE IF EXISTS public.question_locks CASCADE;

-- Update ai_evaluation_log table to work without questions table
-- Remove foreign key constraint to questions table
ALTER TABLE public.ai_evaluation_log DROP CONSTRAINT IF EXISTS ai_evaluation_log_question_id_fkey;

-- Change question_id to TEXT to store JSON question IDs
ALTER TABLE public.ai_evaluation_log ALTER COLUMN question_id TYPE TEXT;

-- Update submissions table to work with JSON-based questions
-- Remove foreign key constraint to questions table
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_question_id_fkey;

-- Change question_id to TEXT to store JSON question IDs
ALTER TABLE public.submissions ALTER COLUMN question_id TYPE TEXT;

-- Add additional fields for JSON-based questions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS question_text TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS ai_evaluation JSONB;

-- Drop questions table
DROP TABLE IF EXISTS public.questions CASCADE;

-- Remove questions from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.questions;

-- Update ai_evaluation_log RLS policies to work without questions table
DROP POLICY IF EXISTS "Admins can view all AI evaluations" ON public.ai_evaluation_log;
DROP POLICY IF EXISTS "Teams can view their own AI evaluations" ON public.ai_evaluation_log;
DROP POLICY IF EXISTS "System can insert AI evaluations" ON public.ai_evaluation_log;

-- Recreate ai_evaluation_log RLS policies
CREATE POLICY "Admins can view all AI evaluations"
ON public.ai_evaluation_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teams can view their own AI evaluations"
ON public.ai_evaluation_log
FOR SELECT
TO authenticated
USING (
    team_id IN (SELECT id FROM public.teams WHERE leader_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

CREATE POLICY "System can insert AI evaluations"
ON public.ai_evaluation_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update submissions RLS policies to work without questions table
DROP POLICY IF EXISTS "Teams can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Teams can submit answers" ON public.submissions;
DROP POLICY IF EXISTS "Admins can manage submissions" ON public.submissions;

-- Recreate submissions RLS policies
CREATE POLICY "Teams can view own submissions"
ON public.submissions
FOR SELECT
TO authenticated
USING (
    team_id IN (SELECT id FROM public.teams WHERE leader_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Teams can submit answers"
ON public.submissions
FOR INSERT
TO authenticated
WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE leader_email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND is_active = true AND is_disqualified = false)
);

CREATE POLICY "Admins can manage submissions"
ON public.submissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Remove question-related indexes
DROP INDEX IF EXISTS idx_questions_round_category;
DROP INDEX IF EXISTS idx_question_locks_question_id;
DROP INDEX IF EXISTS idx_question_locks_team_id;
DROP INDEX IF EXISTS idx_question_locks_is_active;
DROP INDEX IF EXISTS idx_question_locks_expires_at;

-- Update existing indexes for submissions and ai_evaluation_log
DROP INDEX IF EXISTS idx_submissions_team_round;
CREATE INDEX idx_submissions_team_round ON public.submissions(team_id, round_id);
CREATE INDEX idx_submissions_question_id ON public.submissions(question_id);
CREATE INDEX idx_submissions_submitted_at ON public.submissions(submitted_at);

-- Update ai_evaluation_log indexes
DROP INDEX IF EXISTS idx_ai_evaluation_log_question_id;
CREATE INDEX idx_ai_evaluation_log_question_id ON public.ai_evaluation_log(question_id);

-- Remove question-related functions
DROP FUNCTION IF EXISTS public.release_expired_locks();

-- Update get_active_teams_for_round function (remove question dependencies)
CREATE OR REPLACE FUNCTION public.get_active_teams_for_round(_round_number INTEGER)
RETURNS TABLE (
    id UUID,
    team_name TEXT,
    team_code TEXT,
    leader_email TEXT,
    total_score INTEGER,
    round1_score INTEGER,
    round2_score INTEGER,
    round3_score INTEGER,
    submission_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT 
    t.id,
    t.team_name,
    t.team_code,
    t.leader_email,
    t.total_score,
    t.round1_score,
    t.round2_score,
    t.round3_score,
    COALESCE(s.submission_count, 0)::INTEGER as submission_count
  FROM public.teams t
  LEFT JOIN (
    SELECT 
      team_id,
      COUNT(*) as submission_count
    FROM public.submissions
    WHERE round_id = (SELECT id FROM public.rounds WHERE round_number = _round_number)
    GROUP BY team_id
  ) s ON t.id = s.team_id
  WHERE t.is_active = true 
    AND t.is_disqualified = false 
    AND (t.round_eliminated IS NULL OR t.round_eliminated >= _round_number)
  ORDER BY t.total_score DESC;
$;

-- Create function to get team submissions for a specific round
CREATE OR REPLACE FUNCTION public.get_team_submissions_for_round(
    _team_id UUID,
    _round_number INTEGER
)
RETURNS TABLE (
    id UUID,
    question_id TEXT,
    question_text TEXT,
    answer TEXT,
    is_correct BOOLEAN,
    points_earned INTEGER,
    ai_feedback TEXT,
    ai_evaluation JSONB,
    submitted_at TIMESTAMP WITH TIME ZONE,
    evaluated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT 
    s.id,
    s.question_id,
    s.question_text,
    s.answer,
    s.is_correct,
    s.points_earned,
    s.ai_feedback,
    s.ai_evaluation,
    s.submitted_at,
    s.evaluated_at
  FROM public.submissions s
  WHERE s.team_id = _team_id
    AND s.round_id = (SELECT id FROM public.rounds WHERE round_number = _round_number)
  ORDER BY s.submitted_at;
$;

-- Create function to get submission statistics
CREATE OR REPLACE FUNCTION public.get_submission_stats()
RETURNS TABLE (
    round_number INTEGER,
    round_name TEXT,
    total_submissions INTEGER,
    correct_submissions INTEGER,
    average_score NUMERIC,
    teams_participated INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT 
    r.round_number,
    r.round_name,
    COUNT(s.id)::INTEGER as total_submissions,
    COUNT(s.id) FILTER (WHERE s.is_correct = true)::INTEGER as correct_submissions,
    ROUND(AVG(s.points_earned), 2) as average_score,
    COUNT(DISTINCT s.team_id)::INTEGER as teams_participated
  FROM public.rounds r
  LEFT JOIN public.submissions s ON r.id = s.round_id
  GROUP BY r.round_number, r.round_name
  ORDER BY r.round_number;
$;

-- Create function to get AI evaluation statistics
CREATE OR REPLACE FUNCTION public.get_ai_evaluation_stats()
RETURNS TABLE (
    round_number INTEGER,
    total_evaluations INTEGER,
    correct_evaluations INTEGER,
    average_evaluation_time_ms NUMERIC,
    ai_provider_stats JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT 
    r.round_number,
    COUNT(ae.id)::INTEGER as total_evaluations,
    COUNT(ae.id) FILTER (WHERE ae.ai_score = 1)::INTEGER as correct_evaluations,
    ROUND(AVG(ae.evaluation_time_ms), 2) as average_evaluation_time_ms,
    jsonb_object_agg(ae.ai_provider, provider_count) as ai_provider_stats
  FROM public.rounds r
  LEFT JOIN public.ai_evaluation_log ae ON r.id = ae.round_id
  LEFT JOIN (
    SELECT 
      round_id,
      ai_provider,
      COUNT(*)::INTEGER as provider_count
    FROM public.ai_evaluation_log
    GROUP BY round_id, ai_provider
  ) provider_stats ON r.id = provider_stats.round_id AND ae.ai_provider = provider_stats.ai_provider
  GROUP BY r.round_number
  ORDER BY r.round_number;
$;