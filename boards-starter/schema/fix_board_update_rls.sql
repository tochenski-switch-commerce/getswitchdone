-- Fix: allow all team members (not just team owners) to update team boards.
-- Previously, only the board owner or a team owner could update project_boards,
-- which blocked team editors from saving board notes (and any other board-level updates).

DROP POLICY IF EXISTS "Update own or team boards" ON project_boards;

CREATE POLICY "Update own or team boards" ON project_boards
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR team_id IN (SELECT get_my_team_ids())
  );
