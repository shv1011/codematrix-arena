-- Test Competition Flow
-- This script sets up a complete test scenario

-- ============================================
-- STEP 1: ENSURE GAME STATE AND ROUNDS EXIST
-- ============================================

-- Create initial game state if missing
INSERT INTO public.game_state (current_round, is_competition_active)
VALUES (0, false)
ON CONFLICT DO NOTHING;

-- Ensure rounds exist
INSERT INTO public.rounds (round_number, round_name, round_type, time_limit_seconds, is_active) VALUES
(1, 'Aptitude Arena', 'quiz', 1800, false),
(2, 'Constraint Paradox', 'constraint', 3600, false),
(3, 'Code Jeopardy', 'jeopardy', 5400, false)
ON CONFLICT (round_number) DO NOTHING;

-- ============================================
-- STEP 2: START ROUND 1 COMPETITION
-- ============================================

-- Deactivate all rounds first
UPDATE public.rounds SET is_active = false;

-- Activate Round 1
UPDATE public.rounds 
SET is_active = true, start_time = now()
WHERE round_number = 1;

-- Update game state to start competition
UPDATE public.game_state 
SET 
    current_round = 1,
    is_competition_active = true,
    round_start_time = now(),
    round_end_time = now() + interval '30 minutes';

-- ============================================
-- STEP 3: VERIFICATION
-- ============================================

-- Check game state
SELECT 
    current_round,
    is_competition_active,
    round_start_time,
    round_end_time,
    'Competition should be ACTIVE in Round 1' as status
FROM public.game_state;

-- Check active round
SELECT 
    round_number,
    round_name,
    round_type,
    is_active,
    start_time,
    'This round should be ACTIVE' as status
FROM public.rounds
WHERE is_active = true;

-- Check teams ready to compete
SELECT 
    team_name,
    team_code,
    is_active,
    is_disqualified,
    total_score,
    'Ready to compete' as status
FROM public.teams
WHERE is_active = true AND is_disqualified = false
ORDER BY team_name;

-- Success message
SELECT 'COMPETITION STARTED!' as status
UNION ALL
SELECT 'Round 1 (Aptitude Arena) is now ACTIVE' as info
UNION ALL
SELECT 'Users should now see questions when they login' as expected_behavior
UNION ALL
SELECT 'Admin can use Start Competition button to toggle competition state' as admin_control;