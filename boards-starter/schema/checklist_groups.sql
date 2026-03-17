-- ============================================================
-- Add named checklist groups to cards (supports multiple checklists per card)
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 1. Create the checklist groups table
CREATE TABLE IF NOT EXISTS card_checklist_groups (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id   uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  name      text NOT NULL DEFAULT 'Checklist',
  position  int  NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_checklist_groups_card_id ON card_checklist_groups(card_id);

-- 2. Add group_id to existing checklist items (nullable for backward compatibility)
ALTER TABLE card_checklists
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES card_checklist_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_card_checklists_group_id ON card_checklists(group_id);
