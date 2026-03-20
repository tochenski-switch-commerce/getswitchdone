-- ============================================================
-- Board-level automation rules
-- Run this in your Supabase SQL editor.
-- automations is a JSONB array of BoardAutomationRule objects.
-- Each rule has: id, trigger, action, enabled
-- Trigger types: card_completed | assignee_added | start_date_arrived | due_date_overdue
-- Action types:  { type: 'move_to_column', column_id } | { type: 'move_to_top' }
-- ============================================================

ALTER TABLE project_boards
  ADD COLUMN IF NOT EXISTS automations jsonb NOT NULL DEFAULT '[]'::jsonb;
