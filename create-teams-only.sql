-- Create teams to play CodeWars 2.0
-- Admin is already working, so this focuses only on game participants

-- ============================================
-- STEP 1: CREATE GAME TEAMS
-- ============================================

-- Create main team for testing
INSERT INTO public.teams (
    team_name,
    team_code,
    leader_email,
    password_hash,
    is_active,
    is_disqualified,
    current_round,
    total_score,
    round1_score,
    round2_score,
    round3_score
) VALUES (
    'Code Crushers',
    'CC001',
    'team@acm.com',
    '$2b$10$hashedpassword123',
    true,
    false,
    0,
    0,
    0,
    0,
    0
) ON CONFLICT (team_code) DO NOTHING;

-- Create additional teams for a competitive environment
INSERT INTO public.teams (team_name, team_code, leader_email, password_hash, is_active, is_disqualified, total_score) VALUES
('Debug Dragons', 'DD002', 'dragons@acm.com', '$2b$10$hashedpassword123', true, false, 0),
('Algorithm Aces', 'AA003', 'aces@acm.com', '$2b$10$hashedpassword123', true, false, 0),
('Binary Beasts', 'BB004', 'beasts@acm.com', '$2b$10$hashedpassword123', true, false, 0),
('Syntax Squad', 'SS005', 'squad@acm.com', '$2b$10$hashedpassword123', true, false, 0),
('Logic Lords', 'LL006', 'lords@acm.com', '$2b$10$hashedpassword123', true, false, 0),
('Function Force', 'FF007', 'force@acm.com', '$2b$10$hashedpassword123', true, false, 0),
('Variable Vikings', 'VV008', 'vikings@acm.com', '$2b$10$hashedpassword123', true, false, 0)
ON CONFLICT (team_code) DO NOTHING;

-- ============================================
-- STEP 2: ASSIGN USER ROLE TO TEAM LEADER
-- ============================================

-- Assign user role to team leader (when they create their auth account)
DO $$
DECLARE
    team_leader_id UUID;
BEGIN
    SELECT id INTO team_leader_id FROM auth.users WHERE email = 'team@acm.com';
    
    IF team_leader_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role) 
        VALUES (team_leader_id, 'user'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
        
        RAISE NOTICE 'User role assigned to team@acm.com';
    ELSE
        RAISE NOTICE 'Create user team@acm.com in Supabase Auth Dashboard first';
    END IF;
END $$;

-- ============================================
-- STEP 3: INITIALIZE GAME STATE FOR COMPETITION
-- ============================================

-- Set up game state for Round 1 (Aptitude Arena)
UPDATE public.game_state 
SET 
    current_round = 1,
    is_competition_active = true,
    round_start_time = now(),
    round_end_time = now() + interval '30 minutes'
WHERE id = (SELECT id FROM public.game_state LIMIT 1);

-- ============================================
-- STEP 4: VERIFICATION
-- ============================================

-- Show all teams ready for competition
SELECT 
    team_name,
    team_code,
    leader_email,
    is_active,
    is_disqualified,
    total_score,
    'Ready to compete!' as status
FROM public.teams
WHERE is_active = true
ORDER BY team_code;

-- Show current game state
SELECT 
    current_round,
    is_competition_active,
    round_start_time,
    round_end_time,
    'Competition is LIVE!' as status
FROM public.game_state;

-- Count active teams
SELECT 
    COUNT(*) as total_teams,
    COUNT(*) FILTER (WHERE is_active = true) as active_teams,
    COUNT(*) FILTER (WHERE is_disqualified = false) as eligible_teams
FROM public.teams;

-- Instructions for next steps
SELECT 'TEAMS CREATED SUCCESSFULLY!' as info
UNION ALL
SELECT '1. Create auth user: team@acm.com (password: team123) in Supabase Dashboard'
UNION ALL
SELECT '2. Login with team@acm.com to play as "Code Crushers"'
UNION ALL
SELECT '3. Competition is now ACTIVE in Round 1 (Aptitude Arena)'
UNION ALL
SELECT '4. 8 teams are ready to compete'
UNION ALL
SELECT '5. Use admin dashboard to monitor the competition';