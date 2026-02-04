-- Clean up duplicate game_state records
-- Keep only the most recent record and delete the rest

-- First, let's see what we have
SELECT id, current_round, is_competition_active, updated_at 
FROM game_state 
ORDER BY updated_at DESC;

-- Delete all but the most recent game_state record
DELETE FROM game_state 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id 
    FROM game_state 
    ORDER BY updated_at DESC 
    LIMIT 1
  ) AS keeper
);

-- Verify cleanup
SELECT COUNT(*) as remaining_records FROM game_state;
SELECT * FROM game_state;