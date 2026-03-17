-- ============================================================
-- Add is_complete flag to board_cards
-- Run this in your Supabase SQL editor.
-- ============================================================

ALTER TABLE board_cards
  ADD COLUMN IF NOT EXISTS is_complete boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_board_cards_is_complete ON board_cards(is_complete);
