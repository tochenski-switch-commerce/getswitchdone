-- ============================================================
-- Performance indexes for card-scoped queries.
-- card_label_assignments is queried by card_id during board
-- load (Phase 2) but only has a composite PK (card_id, label_id).
-- Without this index, every board load triggers a full table scan.
-- Run this in the Supabase SQL editor.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_card_label_assignments_card_id
  ON card_label_assignments(card_id);
