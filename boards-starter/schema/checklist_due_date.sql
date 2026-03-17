-- ============================================================
-- Add due_date to checklist items
-- Run this in your Supabase SQL editor.
-- ============================================================

ALTER TABLE card_checklists
  ADD COLUMN IF NOT EXISTS due_date timestamptz;
