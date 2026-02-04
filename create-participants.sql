-- SQL Queries for Creating Participants and Assigning User Roles
-- CodeWars 2.0 Competition Setup
-- Questions are loaded from JSON files, not database

-- =====================================================
-- 1. CREATE PARTICIPANTS (TEAMS) AND ASSIGN USER ROLES
-- =====================================================

-- First, create users in auth.users (this would typically be done through Supabase Auth)
-- For demonstration, assuming users are already created in auth.users table

-- Example: Insert sample participants with user roles
-- Note: In production, you'd get user_id from auth.users after user registration

-- Step 1: Create user roles for team leaders (assuming they have auth.users entries)
-- Replace the UUIDs with actual user IDs from auth.users table

INSERT INTO public.user_roles (user_id, role) VALUES
-- Team Leaders (replace with actual user UUIDs from auth.users)
('11111111-1111-1111-1111-111111111111', 'user'),
('22222222-2222-2222-2222-222222222222', 'user'),
('33333333-3333-3333-3333-333333333333', 'user'),
('44444444-4444-4444-4444-444444444444', 'user'),
('55555555-5555-5555-5555-555555555555', 'user'),
-- Supervisors
('66666666-6666-6666-6666-666666666666', 'supervisor'),
('77777777-7777-7777-7777-777777777777', 'supervisor'),
-- Admins
('88888888-8888-8888-8888-888888888888', 'admin'),
('99999999-9999-9999-9999-999999999999', 'admin');

-- Step 2: Create teams with their leaders
-- Password should be hashed using bcrypt or similar in production
INSERT INTO public.teams (team_name, team_code, leader_email, password_hash, is_active, is_disqualified) VALUES
('Code Warriors', 'CW001', 'team1@example.com', '$2b$10$hashedpassword1', true, false),
('Debug Masters', 'DM002', 'team2@example.com', '$2b$10$hashedpassword2', true, false),
('Algorithm Aces', 'AA003', 'team3@example.com', '$2b$10$hashedpassword3', true, false),
('Binary Beasts', 'BB004', 'team4@example.com', '$2b$10$hashedpassword4', true, false),
('Syntax Squad', 'SS005', 'team5@example.com', '$2b$10$hashedpassword5', true, false),
('Logic Lords', 'LL006', 'team6@example.com', '$2b$10$hashedpassword6', true, false),
('Data Dynamos', 'DD007', 'team7@example.com', '$2b$10$hashedpassword7', true, false),
('Function Force', 'FF008', 'team8@example.com', '$2b$10$hashedpassword8', true, false),
('Variable Vikings', 'VV009', 'team9@example.com', '$2b$10$hashedpassword9', true, false),
('Recursive Rebels', 'RR010', 'team10@example.com', '$2b$10$hashedpassword10', true, false);

-- =====================================================
-- 2. BULK PARTICIPANT CREATION FUNCTION
-- =====================================================

-- Function to create multiple teams at once
CREATE OR REPLACE FUNCTION public.create_bulk_teams(
    team_data JSONB
)
RETURNS TABLE (
    team_id UUID,
    team_name TEXT,
    team_code TEXT,
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    team_record JSONB;
    new_team_id UUID;
BEGIN
    -- Loop through each team in the JSON array
    FOR team_record IN SELECT * FROM jsonb_array_elements(team_data)
    LOOP
        BEGIN
            -- Insert the team
            INSERT INTO public.teams (
                team_name, 
                team_code, 
                leader_email, 
                password_hash, 
                is_active, 
                is_disqualified
            ) VALUES (
                team_record->>'team_name',
                team_record->>'team_code',
                team_record->>'leader_email',
                team_record->>'password_hash',
                COALESCE((team_record->>'is_active')::boolean, true),
                COALESCE((team_record->>'is_disqualified')::boolean, false)
            ) RETURNING id INTO new_team_id;
            
            -- Return success
            RETURN QUERY SELECT 
                new_team_id,
                team_record->>'team_name',
                team_record->>'team_code',
                true,
                'Team created successfully'::TEXT;
                
        EXCEPTION WHEN OTHERS THEN
            -- Return error
            RETURN QUERY SELECT 
                NULL::UUID,
                team_record->>'team_name',
                team_record->>'team_code',
                false,
                SQLERRM::TEXT;
        END;
    END LOOP;
END;
$;

-- Example usage of bulk team creation:
/*
SELECT * FROM public.create_bulk_teams('[
    {
        "team_name": "New Team 1",
        "team_code": "NT001",
        "leader_email": "newteam1@example.com",
        "password_hash": "$2b$10$hashedpassword"
    },
    {
        "team_name": "New Team 2", 
        "team_code": "NT002",
        "leader_email": "newteam2@example.com",
        "password_hash": "$2b$10$hashedpassword"
    }
]'::jsonb);
*/

-- =====================================================
-- 3. ASSIGN ROLES TO EXISTING USERS
-- =====================================================

-- Function to assign role to a user by email
CREATE OR REPLACE FUNCTION public.assign_user_role(
    user_email TEXT,
    user_role app_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    target_user_id UUID;
BEGIN
    -- Get user ID from email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = user_email;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;
    
    -- Insert or update role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, user_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN true;
END;
$;

-- Example usage:
-- SELECT public.assign_user_role('admin@example.com', 'admin');
-- SELECT public.assign_user_role('supervisor@example.com', 'supervisor');
-- SELECT public.assign_user_role('team1@example.com', 'user');

-- =====================================================
-- 4. ACTIVATE/DEACTIVATE TEAMS FOR COMPETITION
-- =====================================================

-- Function to activate teams for competition
CREATE OR REPLACE FUNCTION public.activate_teams_for_competition(
    team_codes TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.teams
    SET is_active = true, is_disqualified = false
    WHERE team_code = ANY(team_codes);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$;

-- Function to deactivate teams
CREATE OR REPLACE FUNCTION public.deactivate_teams(
    team_codes TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.teams
    SET is_active = false
    WHERE team_code = ANY(team_codes);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$;

-- Example usage:
-- SELECT public.activate_teams_for_competition(ARRAY['CW001', 'DM002', 'AA003']);
-- SELECT public.deactivate_teams(ARRAY['BB004']);

-- =====================================================
-- 5. VIEW FUNCTIONS FOR TEAM MANAGEMENT
-- =====================================================

-- Function to get all active teams
CREATE OR REPLACE FUNCTION public.get_active_teams()
RETURNS TABLE (
    id UUID,
    team_name TEXT,
    team_code TEXT,
    leader_email TEXT,
    total_score INTEGER,
    round1_score INTEGER,
    round2_score INTEGER,
    round3_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
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
        t.created_at
    FROM public.teams t
    WHERE t.is_active = true AND t.is_disqualified = false
    ORDER BY t.total_score DESC, t.team_name;
$;

-- Function to get team statistics
CREATE OR REPLACE FUNCTION public.get_team_stats()
RETURNS TABLE (
    total_teams INTEGER,
    active_teams INTEGER,
    disqualified_teams INTEGER,
    teams_with_submissions INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
    SELECT 
        COUNT(*)::INTEGER as total_teams,
        COUNT(*) FILTER (WHERE is_active = true AND is_disqualified = false)::INTEGER as active_teams,
        COUNT(*) FILTER (WHERE is_disqualified = true)::INTEGER as disqualified_teams,
        COUNT(DISTINCT s.team_id)::INTEGER as teams_with_submissions
    FROM public.teams t
    LEFT JOIN public.submissions s ON t.id = s.team_id;
$;