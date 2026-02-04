-- Complete setup for both admin and team users
-- This sets up everything needed to test the game

-- ============================================
-- STEP 1: ASSIGN ADMIN ROLE TO EXISTING USER
-- ============================================

-- Assign admin role to the user ID we saw in the logs
INSERT INTO public.user_roles (user_id, role) 
VALUES ('638913c4-0550-47e3-8c82-f9f7e2a78f07', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================
-- STEP 2: CREATE GAME TEAMS
-- ============================================

-- Create main team for testing
INSERT INTO public.teams (
    team_name,
    team_code,
    leader_email,
    password_hash,
    is_active,
    is_disqualified
) VALUES (
    'Code Crushers',
    'CC001',
    'team@acm.com',
    '$2b$10$hashedpassword123',
    true,
    false
) ON CONFLICT (team_code) DO NOTHING;

-- Create additional teams for competition
INSERT INTO public.teams (team_name, team_code, leader_email, password_hash, is_active, is_disqualified) VALUES
('Debug Dragons', 'DD002', 'dragons@acm.com', '$2b$10$hashedpassword123', true, false),
('Algorithm Aces', 'AA003', 'aces@acm.com', '$2b$10$hashedpassword123', true, false),
('Binary Beasts', 'BB004', 'beasts@acm.com', '$2b$10$hashedpassword123', true, false),
('Syntax Squad', 'SS005', 'squad@acm.com', '$2b$10$hashedpassword123', true, false)
ON CONFLICT (team_code) DO NOTHING;

-- ============================================
-- STEP 3: ASSIGN TEAM LEADER ROLE
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
-- STEP 4: INITIALIZE GAME STATE
-- ============================================

-- Set up game state for Round 1
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

-- Check admin user
SELECT 
    u.email,
    ur.role,
    'Should see Admin Dashboard' as access_level
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.id = '638913c4-0550-47e3-8c82-f9f7e2a78f07';

-- Check all teams
SELECT 
    team_name,
    team_code,
    leader_email,
    is_active,
    total_score
FROM public.teams
ORDER BY team_code;

-- Check game state
SELECT 
    current_round,
    is_competition_active,
    'Game is ready!' as status
FROM public.game_state;

-- Final instructions
SELECT 'SETUP COMPLETE!' as status
UNION ALL
SELECT 'Admin user (ID: 638913c4-0550-47e3-8c82-f9f7e2a78f07) now has admin role'
UNION ALL
SELECT 'Create auth user: team@acm.com (password: team123) to test team gameplay'
UNION ALL
SELECT 'Login with admin credentials to see Admin Dashboard'
UNION ALL
SELECT 'Login with team@acm.com to see Team Dashboard and play the game';