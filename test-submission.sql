-- Test submission functionality
-- This script helps debug submission issues

-- 1. Check if we have active teams
SELECT 
  id, 
  team_name, 
  leader_email, 
  is_active, 
  is_disqualified 
FROM teams 
WHERE is_active = true AND is_disqualified = false;

-- 2. Check if we have active rounds
SELECT 
  id, 
  round_number, 
  round_name, 
  is_active 
FROM rounds 
ORDER BY round_number;

-- 3. Check current game state
SELECT * FROM game_state ORDER BY updated_at DESC LIMIT 1;

-- 4. Check recent submissions
SELECT 
  s.id,
  t.team_name,
  s.question_id,
  s.question_text,
  s.answer,
  s.is_correct,
  s.points_earned,
  s.submitted_at
FROM submissions s
JOIN teams t ON s.team_id = t.id
ORDER BY s.submitted_at DESC
LIMIT 10;

-- 5. Test a sample submission (replace with actual team_id and round_id)
-- INSERT INTO submissions (
--   team_id, 
--   question_id, 
--   round_id, 
--   answer, 
--   question_text
-- ) VALUES (
--   'your-team-id-here',
--   'test-question-1',
--   'your-round-id-here',
--   'Test answer',
--   'Test question text'
-- );

-- 6. Check RLS policies on submissions table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'submissions';