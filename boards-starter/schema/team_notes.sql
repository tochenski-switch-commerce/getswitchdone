-- ============================================================
-- Team Notes
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 1. Add notes column to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS notes text;

-- 2. RPC that lets owners AND editors update only the notes field
--    without loosening the "Update teams (owner only)" RLS policy.
CREATE OR REPLACE FUNCTION update_team_notes(p_team_id uuid, p_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'Not authorized to update team notes';
  END IF;

  UPDATE teams SET notes = p_notes WHERE id = p_team_id;
END;
$$;
