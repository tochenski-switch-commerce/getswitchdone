-- ============================================================
-- Add automations to board_columns
-- Run this in your Supabase SQL editor.
-- automations is a JSONB array of ColumnAutomationAction objects.
-- ============================================================

ALTER TABLE board_columns
  ADD COLUMN IF NOT EXISTS automations jsonb NOT NULL DEFAULT '[]'::jsonb;
