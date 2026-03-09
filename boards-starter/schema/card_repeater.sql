-- Card Repeater v2: add repeat_rule (JSONB) and repeat_series_id to board_cards
-- Run this in the Supabase SQL editor.

-- Drop old columns if they exist (from v1)
ALTER TABLE board_cards DROP COLUMN IF EXISTS repeat_schedule;

-- Add new columns
ALTER TABLE board_cards
  ADD COLUMN IF NOT EXISTS repeat_rule jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_series_id uuid DEFAULT NULL;

-- Index for the cron query (find all repeating, non-archived cards efficiently)
DROP INDEX IF EXISTS idx_board_cards_repeat;
CREATE INDEX idx_board_cards_repeat
  ON board_cards USING gin (repeat_rule)
  WHERE repeat_rule IS NOT NULL AND is_archived = false;

-- Index for series lookups
CREATE INDEX IF NOT EXISTS idx_board_cards_repeat_series
  ON board_cards (repeat_series_id)
  WHERE repeat_series_id IS NOT NULL;
