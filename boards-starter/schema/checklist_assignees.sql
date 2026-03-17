-- ============================================================
-- Add assignees to checklist items
-- Run this in your Supabase SQL editor.
-- ============================================================

ALTER TABLE card_checklists
  ADD COLUMN IF NOT EXISTS assignees jsonb NOT NULL DEFAULT '[]'::jsonb;
