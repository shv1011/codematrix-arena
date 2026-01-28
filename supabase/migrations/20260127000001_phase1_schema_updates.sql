-- Phase 1 Schema Updates for CodeWars 2.0
-- Adding fields for team elimination, AI evaluation logging, and jeopardy FCFS tracking

-- Add eliminated_at timestamp to teams table
ALTER TABLE public.teams ADD COLUMN eliminated_at TIMESTAMP WITH TIME ZONE;

-- Add round_eliminated field to track which round team was eliminated in
ALTER TABLE public.teams ADD COLUMN round_eliminated INTEGER;

-- Create ai_evaluation_log table for tracking AI responses
CREATE TABLE public.ai_evaluation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
    question_text TEXT NOT NULL,
    team_answer TEXT NOT NULL,
    ai_provider TEXT NOT NULL, -- 'openai' or 'gemini'
    ai_prompt TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    ai_score INTEGER NOT NULL, -- 0 or 1
    evaluation_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for ai_evaluation_log
ALTER TABLE public.ai_evaluation_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_evaluation_log
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

-- Create question_locks table for jeopardy FCFS tracking
CREATE TABLE public.question_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    released_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(question_id, is_active) -- Only one active lock per question
);

-- Enable RLS for question_locks
ALTER TABLE public.question_locks ENABLE ROW LEVEL SECURITY;

-- RLS policies for question_locks
CREATE POLICY "Everyone can view question locks"
ON public.question_locks
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Teams can create locks for themselves"
ON public.question_locks
FOR INSERT
TO authenticated
WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE leader_email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND is_active = true AND is_disqualified = false)
);

CREATE POLICY "Admins can manage all locks"
ON public.question_locks
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add performance indexes
CREATE INDEX idx_teams_eliminated_at ON public.teams(eliminated_at);
CREATE INDEX idx_teams_round_eliminated ON public.teams(round_eliminated);
CREATE INDEX idx_teams_is_active_disqualified ON public.teams(is_active, is_disqualified);
CREATE INDEX idx_ai_evaluation_log_team_id ON public.ai_evaluation_log(team_id);
CREATE INDEX idx_ai_evaluation_log_submission_id ON public.ai_evaluation_log(submission_id);
CREATE INDEX idx_ai_evaluation_log_created_at ON public.ai_evaluation_log(created_at);
CREATE INDEX idx_question_locks_question_id ON public.question_locks(question_id);
CREATE INDEX idx_question_locks_team_id ON public.question_locks(team_id);
CREATE INDEX idx_question_locks_is_active ON public.question_locks(is_active);
CREATE INDEX idx_question_locks_expires_at ON public.question_locks(expires_at);
CREATE INDEX idx_submissions_team_round ON public.submissions(team_id, round_id);
CREATE INDEX idx_questions_round_category ON public.questions(round_id, category);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_evaluation_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.question_locks;

-- Function to automatically release expired question locks
CREATE OR REPLACE FUNCTION public.release_expired_locks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $
  UPDATE public.question_locks 
  SET is_active = false, released_at = now()
  WHERE is_active = true AND expires_at < now();
$;

-- Function to get active teams for a specific round
CREATE OR REPLACE FUNCTION public.get_active_teams_for_round(_round_number INTEGER)
RETURNS TABLE (
    id UUID,
    team_name TEXT,
    team_code TEXT,
    leader_email TEXT,
    total_score INTEGER,
    round1_score INTEGER,
    round2_score INTEGER,
    round3_score INTEGER
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
    t.round3_score
  FROM public.teams t
  WHERE t.is_active = true 
    AND t.is_disqualified = false 
    AND (t.round_eliminated IS NULL OR t.round_eliminated >= _round_number)
  ORDER BY t.total_score DESC;
$;

-- Function to eliminate teams below a certain rank after a round
CREATE OR REPLACE FUNCTION public.eliminate_teams_below_rank(_round_number INTEGER, _keep_top_n INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    eliminated_count INTEGER := 0;
BEGIN
    -- Update teams that should be eliminated
    WITH ranked_teams AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY 
                CASE 
                    WHEN _round_number = 1 THEN round1_score
                    WHEN _round_number = 2 THEN round2_score
                    WHEN _round_number = 3 THEN round3_score
                    ELSE total_score
                END DESC
            ) as rank
        FROM public.teams
        WHERE is_active = true 
          AND is_disqualified = false
          AND (round_eliminated IS NULL OR round_eliminated >= _round_number)
    )
    UPDATE public.teams
    SET 
        eliminated_at = now(),
        round_eliminated = _round_number,
        is_active = false
    FROM ranked_teams
    WHERE teams.id = ranked_teams.id 
      AND ranked_teams.rank > _keep_top_n;
    
    GET DIAGNOSTICS eliminated_count = ROW_COUNT;
    RETURN eliminated_count;
END;
$;