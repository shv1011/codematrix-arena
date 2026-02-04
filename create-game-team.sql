-- Create a team to play CodeWars 2.0
-- Teams are the main participants in the competition

-- ============================================
-- STEP 1: CREATE A TEAM
-- ============================================

-- Insert a new team
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
    'Code Crushers',                    -- Team name
    'CC001',                           -- Unique team code
    'team@acm.com',                    -- Team leader email
    '$2b$10$hashedpassword123',       -- Password hash (placeholder)
    true,                              -- Active team
    false,                             -- Not disqualified
    0,                                 -- Starting at round 0
    0,                                 -- No score yet
    0,                                 -- Round 1 score
    0,                                 -- Round 2 score
    0                                  -- Round 3 score
) ON CONFLICT (team_code) DO NOTHING;

-- ============================================
-- STEP 2: CREATE AUTH USER FOR TEAM LEADER
-- ============================================

-- First, create the user in Supabase Auth (you'll need to do this in the dashboard)
-- Email: team@acm.com
-- Password: team123

-- Then assign user role to the team leader
DO $$
DECLARE
    team_leader_id UUID;
BEGIN
    -- Get team leader user ID
    SELECT id INTO team_leader_id FROM auth.users WHERE email = 'team@acm.com';
    
    IF team_leader_id IS NOT NULL THEN
        -- Assign user role (regular participant)
        INSERT INTO public.user_roles (user_id, role) 
        VALUES (team_leader_id, 'user'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
        
        RAISE NOTICE 'User role assigned to team@acm.com';
    ELSE
        RAISE NOTICE 'Please create user team@acm.com in Supabase Auth Dashboard first';
    END IF;
END $$;

-- ============================================
-- STEP 3: CREATE ADDITIONAL TEAMS FOR COMPETITION
-- ============================================

-- Create more teams for a realistic competition
INSERT INTO public.teams (team_name, team_code, leader_email, password_hash, is_active, is_disqualified) VALUES
('Debug Dragons', 'DD002', 'dragons@acm.com', '$2b$10$hashedpassword123', true, false),
('Algorithm Aces', 'AA003', 'aces@acm.com', '$2b$10$hashedpassword123', true, false),
('Binary Beasts', 'BB004', 'beasts@acm.com', '$2b$10$hashedpassword123', true, false),
('Syntax Squad', 'SS005', 'squad@acm.com', '$2b$10$hashedpassword123', true, false)
ON CONFLICT (team_code) DO NOTHING;

-- ============================================
-- STEP 4: INITIALIZE GAME STATE
-- ============================================

-- Make sure game state exists and is ready
INSERT INTO public.game_state (current_round, is_competition_active)
VALUES (0, false)
ON CONFLICT DO NOTHING;

-- Update game state to be ready for competition
UPDATE public.game_state 
SET 
    current_round = 1,
    is_competition_active = true,
    round_start_time = now(),
    round_end_time = now() + interval '30 minutes'
WHERE id = (SELECT id FROM public.game_state LIMIT 1);

-- ============================================
-- STEP 5: VERIFICATION
-- ============================================

-- Show all teams
SELECT 
    team_name,
    team_code,
    leader_email,
    is_active,
    is_disqualified,
    total_score,
    created_at
FROM public.teams
ORDER BY team_name;

-- Show game state
SELECT 
    current_round,
    is_competition_active,
    round_start_time,
    round_end_time
FROM public.game_state;

-- Show team leader roles
SELECT 
    u.email,
    ur.role,
    t.team_name
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.teams t ON t.leader_email = u.email
WHERE u.email LIKE '%@acm.com'
ORDER BY u.email;

-- Instructions
SELECT 'NEXT STEPS:' as info
UNION ALL
SELECT '1. Create user in Supabase Dashboard: team@acm.com with password team123'
UNION ALL
SELECT '2. Login with team@acm.com to see the participant dashboard'
UNION ALL
SELECT '3. The team "Code Crushers" is ready to play!'
UNION ALL
SELECT '4. Competition is now active and in Round 1'
UNION ALL
SELECT '5. You can create more auth users for other teams if needed';