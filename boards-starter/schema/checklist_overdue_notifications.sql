-- ============================================================
-- Support overdue notifications for checklist items
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 1. Add checklist_item_id column to notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS checklist_item_id uuid REFERENCES card_checklists(id) ON DELETE CASCADE;

-- 2. Extend the type CHECK constraint to include 'checklist_overdue'
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('comment', 'assignment', 'due_soon', 'overdue', 'mention', 'email_unrouted', 'checklist_overdue'));

CREATE INDEX IF NOT EXISTS idx_notifications_checklist_item_id ON notifications(checklist_item_id);
