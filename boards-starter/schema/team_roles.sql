-- ============================================================
-- Migrate team_members role from (owner, member) to (owner, editor, viewer)
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 1. Drop existing constraint and add new one with editor/viewer
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner', 'editor', 'viewer'));

-- 2. Migrate existing 'member' rows to 'editor'
UPDATE team_members SET role = 'editor' WHERE role = 'member';

-- 3. Add UPDATE policy for team_members (owner can change roles)
CREATE POLICY "Update team members (owner only)" ON team_members
  FOR UPDATE TO authenticated
  USING (team_id IN (SELECT get_my_owned_team_ids()))
  WITH CHECK (team_id IN (SELECT get_my_owned_team_ids()));
