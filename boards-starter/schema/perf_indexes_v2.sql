-- ============================================================
-- Performance indexes v2 — card detail query targets
--
-- card_comments and card_checklists are queried by card_id
-- during board load (Phase 2 IN queries) but were missing
-- indexes, causing full table scans on every board open.
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Most critical: comments are fetched for all cards on every board load
CREATE INDEX IF NOT EXISTS idx_card_comments_card_id
  ON card_comments(card_id);

-- Checklists fetched with .in('card_id', cardIds) — same pattern
CREATE INDEX IF NOT EXISTS idx_card_checklists_card_id
  ON card_checklists(card_id);
