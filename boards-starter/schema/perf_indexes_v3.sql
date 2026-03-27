-- ============================================================
-- Performance indexes v3 — composite and filtered indexes
--
-- Addresses full table scans on the most common query patterns:
-- - Board card listing (filtered by board_id + is_archived + position)
-- - Overdue card queries (filtered due_date, is_archived, is_complete)
-- - Comment ordering (card_id + created_at for sorted loads)
-- - Custom field value lookups (card_id)
-- - Notifications per user
--
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Composite index for the primary board card listing query:
-- .eq('board_id').eq('is_archived', false).order('position')
CREATE INDEX IF NOT EXISTS idx_board_cards_board_archived_pos
  ON board_cards(board_id, is_archived, position);

-- Partial index for overdue card queries (only rows with a due_date)
CREATE INDEX IF NOT EXISTS idx_board_cards_due_date
  ON board_cards(due_date) WHERE due_date IS NOT NULL;

-- Composite for the check-overdue cron: non-archived, non-complete cards with due dates
CREATE INDEX IF NOT EXISTS idx_board_cards_overdue_lookup
  ON board_cards(is_archived, is_complete, due_date) WHERE due_date IS NOT NULL;

-- Comments ordered by created_at within a card (used in board load Phase 2)
CREATE INDEX IF NOT EXISTS idx_card_comments_card_id_created
  ON card_comments(card_id, created_at);

-- Custom field values looked up by card_id during board load
CREATE INDEX IF NOT EXISTS idx_card_custom_field_values_card_id
  ON card_custom_field_values(card_id);

-- Notifications per user (filtered by user_id, ordered by created_at)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created
  ON notifications(user_id, created_at DESC);

-- Notifications dedup check (type + card_id) used in check-overdue to skip already-notified cards
CREATE INDEX IF NOT EXISTS idx_notifications_type_card_id
  ON notifications(type, card_id);

-- Checklist items with due dates (for overdue checklist query)
CREATE INDEX IF NOT EXISTS idx_card_checklists_due_date
  ON card_checklists(due_date) WHERE due_date IS NOT NULL;

-- Boards by archived status (used in board listing and check-overdue)
CREATE INDEX IF NOT EXISTS idx_project_boards_is_archived
  ON project_boards(is_archived);
