-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL,
    team_code TEXT UNIQUE NOT NULL,
    leader_email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_disqualified BOOLEAN DEFAULT false,
    current_round INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    round1_score INTEGER DEFAULT 0,
    round2_score INTEGER DEFAULT 0,
    round3_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Teams RLS policies
CREATE POLICY "Teams can view their own data"
ON public.teams
FOR SELECT
TO authenticated
USING (
    leader_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can manage teams"
ON public.teams
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create rounds table
CREATE TABLE public.rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_number INTEGER UNIQUE NOT NULL,
    round_name TEXT NOT NULL,
    round_type TEXT NOT NULL, -- 'quiz', 'constraint', 'jeopardy'
    is_active BOOLEAN DEFAULT false,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    time_limit_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view rounds"
ON public.rounds
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage rounds"
ON public.rounds
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create questions table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'mcq', 'code', 'jeopardy'
    options JSONB, -- For MCQ questions
    correct_answer TEXT,
    constraints TEXT, -- For constraint paradox
    category TEXT, -- For jeopardy
    points INTEGER DEFAULT 100,
    difficulty TEXT, -- 'easy', 'medium', 'medium-hard', 'hard', 'extreme'
    reward_points INTEGER,
    is_locked BOOLEAN DEFAULT false,
    locked_by UUID REFERENCES public.teams(id),
    locked_at TIMESTAMP WITH TIME ZONE,
    answered_by UUID REFERENCES public.teams(id),
    jeopardy_row INTEGER,
    jeopardy_col INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active teams can view questions"
ON public.questions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage questions"
ON public.questions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create submissions table
CREATE TABLE public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
    answer TEXT NOT NULL,
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    evaluated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

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

-- Create game_state table for real-time updates
CREATE TABLE public.game_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_round INTEGER DEFAULT 0,
    is_competition_active BOOLEAN DEFAULT false,
    round_start_time TIMESTAMP WITH TIME ZONE,
    round_end_time TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view game state"
ON public.game_state
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can update game state"
ON public.game_state
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default rounds
INSERT INTO public.rounds (round_number, round_name, round_type, time_limit_seconds) VALUES
(1, 'Aptitude Arena', 'quiz', 1800),
(2, 'Constraint Paradox', 'constraint', 3600),
(3, 'Code Jeopardy', 'jeopardy', 5400);

-- Insert initial game state
INSERT INTO public.game_state (current_round, is_competition_active) VALUES (0, false);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_state_updated_at
BEFORE UPDATE ON public.game_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();