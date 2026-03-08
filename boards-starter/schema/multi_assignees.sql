-- ============================================================
-- Migration: Multi-assignee support
-- Adds an 'assignees' text[] column and migrates existing
-- single-assignee data. Run in your Supabase SQL editor.
-- ============================================================

-- 1. Add the new array column
ALTER TABLE board_cards ADD COLUMN IF NOT EXISTS assignees text[] DEFAULT '{}';

-- 2. Migrate existing single assignee values into the array
UPDATE board_cards
SET assignees = ARRAY[assignee]
WHERE assignee IS NOT NULL AND assignee <> '';

-- 3. (Optional) Drop the old column once you've verified the migration
-- ALTER TABLE board_cards DROP COLUMN assignee;
