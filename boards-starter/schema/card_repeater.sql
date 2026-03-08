-- Card Repeater: add repeat_schedule and repeat_series_id to board_cards
-- Run this in the Supabase SQL editor.

ALTER TABLE board_cards
  ADD COLUMN IF NOT EXISTS repeat_schedule text DEFAULT NULL
    CHECK (repeat_schedule IS NULL OR repeat_schedule IN ('daily', 'weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS repeat_series_id uuid DEFAULT NULL;

-- Index for the cron query (find all repeating, non-archived cards efficiently)
CREATE INDEX IF NOT EXISTS idx_board_cards_repeat
  ON board_cards (repeat_schedule)
  WHERE repeat_schedule IS NOT NULL AND is_archived = false;
