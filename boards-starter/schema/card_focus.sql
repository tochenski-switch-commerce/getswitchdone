-- ============================================================
-- Card Focus: allow users to pin cards to their Today page
-- ============================================================

ALTER TABLE board_cards ADD COLUMN IF NOT EXISTS is_focused boolean NOT NULL DEFAULT false;

-- Partial index — only indexes the rows that are actually focused
CREATE INDEX IF NOT EXISTS idx_board_cards_is_focused
  ON board_cards(is_focused)
  WHERE is_focused = true;
