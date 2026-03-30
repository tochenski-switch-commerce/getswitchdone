-- ============================================================
-- Add archive metadata columns to board_cards
-- Run this in your Supabase SQL editor.
-- ============================================================

ALTER TABLE board_cards
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_archive_column_id uuid REFERENCES board_columns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_board_cards_is_archived ON board_cards(is_archived, board_id);
