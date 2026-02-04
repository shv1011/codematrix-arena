-- Manual Team Management for CodeWars 2.0
-- Use these queries to manually manage teams during competition

-- ============================================
-- VIEW ALL TEAMS AND THEIR STATUS
-- ============================================

-- Show all teams with their current status
SELECT 
    team_name,
    team_code,
    is_active,
    is_disqualified,
    round_eliminated,
    eliminated_at,
    total_score,
    round1_score,
    round2_score,
    round3_score,
    created_at
FROM public.teams
ORDER BY total_score DESC, team_name;

-- ============================================
-- ELIMINATE TEAMS MANUALLY
-- ============================================

-- Eliminate specific teams by name
UPDATE public.teams 
SET 
    is_active = false,
    eliminated_at = now(),
    round_eliminated = 1  -- Change to current round number
WHERE team_name IN ('Debug Dragons', 'Binary Beasts');

-- Eliminate bottom 3 teams after Round 1
UPDATE public.teams 
SET 
    is_active = false,
    eliminated_at = now(),
    round_eliminated = 1
WHERE id IN (
    SELECT id FROM public.teams 
    WHERE is_active = true 
    ORDER BY round1_score ASC, total_score ASC 
    LIMIT 3
);

-- Eliminate bottom 2 teams after Round 2
UPDATE public.teams 
SET 
    is_active = false,
    eliminated_at = now(),
    round_eliminated = 2
WHERE id IN (
    SELECT id FROM public.teams 
    WHERE is_active = true 
    ORDER BY round2_score ASC, total_score ASC 
    LIMIT 2
);

-- ============================================
-- DISQUALIFY TEAMS
-- ============================================

-- Disqualify a specific team
UPDATE public.teams 
SET 
    is_disqualified = true,
    eliminated_at = now()
WHERE team_name = 'Syntax Squad';

-- Reinstate a disqualified team
UPDATE public.teams 
SET 
    is_disqualified = false,
    eliminated_at = null
WHERE team_name = 'Syntax Squad';

-- ============================================
-- ACTIVATE/DEACTIVATE TEAMS
-- ============================================

-- Deactivate specific teams
UPDATE public.teams 
SET is_active = false
WHERE team_name IN ('Algorithm Aces', 'Logic Lords');

-- Reactivate teams
UPDATE public.teams 
SET 
    is_active = true,
    eliminated_at = null,
    round_eliminated = null
WHERE team_name IN ('Algorithm Aces', 'Logic Lords');

-- ============================================
-- MANUALLY SET SCORES
-- ============================================

-- Set Round 1 scores manually
UPDATE public.teams SET round1_score = 85, total_score = 85 WHERE team_name = 'Code Crushers';
UPDATE public.teams SET round1_score = 78, total_score = 78 WHERE team_name = 'Debug Dragons';
UPDATE public.teams SET round1_score = 92, total_score = 92 WHERE team_name = 'Algorithm Aces';
UPDATE public.teams SET round1_score = 65, total_score = 65 WHERE team_name = 'Binary Beasts';
UPDATE public.teams SET round1_score = 71, total_score = 71 WHERE team_name = 'Syntax Squad';
UPDATE public.teams SET round1_score = 88, total_score = 88 WHERE team_name = 'Logic Lords';
UPDATE public.teams SET round1_score = 76, total_score = 76 WHERE team_name = 'Function Force';
UPDATE public.teams SET round1_score = 82, total_score = 82 WHERE team_name = 'Variable Vikings';

-- Set Round 2 scores (add to existing total)
UPDATE public.teams SET 
    round2_score = 95, 
    total_score = round1_score + 95 
WHERE team_name = 'Code Crushers';

UPDATE public.teams SET 
    round2_score = 87, 
    total_score = round1_score + 87 
WHERE team_name = 'Algorithm Aces';

UPDATE public.teams SET 
    round2_score = 91, 
    total_score = round1_score + 91 
WHERE team_name = 'Logic Lords';

-- Set Round 3 scores (add to existing total)
UPDATE public.teams SET 
    round3_score = 88, 
    total_score = round1_score + round2_score + 88 
WHERE team_name = 'Code Crushers';

-- ============================================
-- COMPETITION FLOW SIMULATION
-- ============================================

-- Simulate end of Round 1 - eliminate bottom 3 teams
UPDATE public.teams 
SET 
    is_active = false,
    eliminated_at = now(),
    round_eliminated = 1
WHERE id IN (
    SELECT id FROM (
        SELECT id FROM public.teams 
        WHERE is_active = true AND is_disqualified = false
        ORDER BY round1_score ASC, total_score ASC 
        LIMIT 3
    ) AS bottom_teams
);

-- Simulate end of Round 2 - eliminate bottom 2 of remaining teams
UPDATE public.teams 
SET 
    is_active = false,
    eliminated_at = now(),
    round_eliminated = 2
WHERE id IN (
    SELECT id FROM (
        SELECT id FROM public.teams 
        WHERE is_active = true AND is_disqualified = false
        ORDER BY round2_score ASC, total_score ASC 
        LIMIT 2
    ) AS bottom_teams
);

-- ============================================
-- RESET COMPETITION
-- ============================================

-- Reset all teams to active state (start fresh)
UPDATE public.teams 
SET 
    is_active = true,
    is_disqualified = false,
    eliminated_at = null,
    round_eliminated = null,
    total_score = 0,
    round1_score = 0,
    round2_score = 0,
    round3_score = 0;

-- Reset game state
UPDATE public.game_state 
SET 
    current_round = 0,
    is_competition_active = false,
    round_start_time = null,
    round_end_time = null;

-- ============================================
-- USEFUL QUERIES FOR MONITORING
-- ============================================

-- Show current leaderboard
SELECT 
    ROW_NUMBER() OVER (ORDER BY total_score DESC, team_name) as rank,
    team_name,
    total_score,
    round1_score,
    round2_score,
    round3_score,
    CASE 
        WHEN is_disqualified THEN 'DISQUALIFIED'
        WHEN NOT is_active THEN 'ELIMINATED'
        ELSE 'ACTIVE'
    END as status
FROM public.teams
ORDER BY total_score DESC, team_name;

-- Show eliminated teams by round
SELECT 
    round_eliminated,
    COUNT(*) as teams_eliminated,
    STRING_AGG(team_name, ', ') as eliminated_teams
FROM public.teams
WHERE round_eliminated IS NOT NULL
GROUP BY round_eliminated
ORDER BY round_eliminated;

-- Show active teams count
SELECT 
    COUNT(*) as total_teams,
    COUNT(*) FILTER (WHERE is_active = true AND is_disqualified = false) as active_teams,
    COUNT(*) FILTER (WHERE is_disqualified = true) as disqualified_teams,
    COUNT(*) FILTER (WHERE round_eliminated IS NOT NULL) as eliminated_teams
FROM public.teams;

-- Show top 3 teams
SELECT 
    team_name,
    total_score,
    'Winner!' as status
FROM public.teams
WHERE is_active = true AND is_disqualified = false
ORDER BY total_score DESC
LIMIT 3;