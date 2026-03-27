-- ============================================================
-- Per-user focus: replace shared is_focused boolean with
-- focused_by text[] so each user can focus independently.
-- Run this in the Supabase SQL editor.
-- ============================================================

ALTER TABLE board_cards
  ADD COLUMN IF NOT EXISTS focused_by text[] NOT NULL DEFAULT '{}';

-- Drop old partial index (replaced by GIN below)
DROP INDEX IF EXISTS idx_board_cards_is_focused;

-- GIN index for array containment queries (.contains / @>)
CREATE INDEX IF NOT EXISTS idx_board_cards_focused_by
  ON board_cards USING GIN(focused_by)
  WHERE array_length(focused_by, 1) > 0;
