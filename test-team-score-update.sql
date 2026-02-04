-- Test team score updates
-- Verify that teams table can be updated properly

-- Check current team scores
SELECT 
    team_name,
    total_score,
    round1_score,
    round2_score,
    round3_score,
    is_active,
    is_disqualified
FROM teams 
ORDER BY total_score DESC;

-- Test updating a team's score (replace with actual team_id)
-- UPDATE teams 
-- SET 
--     round1_score = round1_score + 10,
--     total_score = total_score + 10
-- WHERE id = 'your-team-id-here';

-- Check RLS policies on teams table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'teams';