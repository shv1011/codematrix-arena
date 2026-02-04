-- Complete RLS Policy Fix for CodeWars 2.0
-- Run this entire script in Supabase SQL Editor

-- ============================================
-- 1. GAME STATE TABLE - Allow everyone to read, admins to update
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view game state" ON public.game_state;
DROP POLICY IF EXISTS "Admins can update game state" ON public.game_state;
DROP POLICY IF EXISTS "Allow anonymous read access to game_state" ON public.game_state;
DROP POLICY IF EXISTS "Admins can update game_state" ON public.game_state;

-- Create new policies
CREATE POLICY "Allow all users to read game_state"
ON public.game_state
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow admins to update game_state"
ON public.game_state
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Allow admins to insert game_state"
ON public.game_state
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================
-- 2. ROUNDS TABLE - Allow everyone to read, admins to manage
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view rounds" ON public.rounds;
DROP POLICY IF EXISTS "Admins can manage rounds" ON public.rounds;
DROP POLICY IF EXISTS "Allow anonymous read access to rounds" ON public.rounds;
DROP POLICY IF EXISTS "Admins can update rounds" ON public.rounds;

-- Create new policies
CREATE POLICY "Allow all users to read rounds"
ON public.rounds
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow admins to manage rounds"
ON public.rounds
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================
-- 3. TEAMS TABLE - Allow admins and supervisors to view all, teams to view own
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Teams can view their own data" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;

-- Create new policies
CREATE POLICY "Allow admins and supervisors to view all teams"
ON public.teams
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')
    )
    OR leader_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Allow admins to manage teams"
ON public.teams
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================
-- 4. USER ROLES TABLE - Allow users to see own roles, admins to manage all
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Create new policies
CREATE POLICY "Allow users to view own roles and admins to view all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
);

CREATE POLICY "Allow admins to manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================
-- 5. QUESTIONS TABLE - Allow everyone to read active questions
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Active teams can view questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;

-- Create new policies
CREATE POLICY "Allow all users to read questions"
ON public.questions
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow admins to manage questions"
ON public.questions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================
-- 6. SUBMISSIONS TABLE - Allow teams to view own, admins to view all
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Teams can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Teams can submit answers" ON public.submissions;
DROP POLICY IF EXISTS "Admins can manage submissions" ON public.submissions;

-- Create new policies
CREATE POLICY "Allow teams to view own submissions and admins to view all"
ON public.submissions
FOR SELECT
TO authenticated
USING (
    team_id IN (
        SELECT id FROM public.teams 
        WHERE leader_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')
    )
);

CREATE POLICY "Allow teams to submit answers"
ON public.submissions
FOR INSERT
TO authenticated
WITH CHECK (
    team_id IN (
        SELECT id FROM public.teams 
        WHERE leader_email = (SELECT email FROM auth.users WHERE id = auth.uid()) 
        AND is_active = true 
        AND is_disqualified = false
    )
);

CREATE POLICY "Allow admins to manage submissions"
ON public.submissions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================
-- 7. Initialize missing data
-- ============================================

-- Create initial game_state record if missing
INSERT INTO public.game_state (current_round, is_competition_active)
VALUES (0, false)
ON CONFLICT DO NOTHING;

-- Ensure default rounds exist
INSERT INTO public.rounds (round_number, round_name, round_type, time_limit_seconds, is_active) VALUES
(1, 'Aptitude Arena', 'quiz', 1800, false),
(2, 'Constraint Paradox', 'constraint', 3600, false),
(3, 'Code Jeopardy', 'jeopardy', 5400, false)
ON CONFLICT (round_number) DO NOTHING;

-- ============================================
-- 8. Verification queries
-- ============================================

-- Check if policies were created successfully
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('game_state', 'rounds', 'teams', 'user_roles', 'questions', 'submissions')
ORDER BY tablename, policyname;

-- Check if initial data exists
SELECT 'game_state' as table_name, count(*) as record_count FROM public.game_state
UNION ALL
SELECT 'rounds' as table_name, count(*) as record_count FROM public.rounds
UNION ALL
SELECT 'teams' as table_name, count(*) as record_count FROM public.teams;

-- Success message
SELECT 'RLS policies have been updated successfully! Refresh your application.' as status;