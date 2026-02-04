-- Test minimal submission to verify schema
-- This tests if we can insert with just the basic required fields

-- Check what columns are actually required (NOT NULL)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'submissions' 
AND is_nullable = 'NO'
ORDER BY ordinal_position;

-- Test a minimal insert (replace with actual team_id)
-- INSERT INTO submissions (team_id, question_id, answer) 
-- VALUES ('your-team-id-here', 'test-q-1', 'test answer');

-- Check recent submissions
SELECT 
    id,
    team_id,
    question_id,
    answer,
    submitted_at
FROM submissions 
ORDER BY submitted_at DESC 
LIMIT 5;