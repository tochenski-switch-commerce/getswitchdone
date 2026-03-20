-- ============================================================
-- Fix overly permissive RLS on board child tables.
-- Previously these used USING (true), allowing any authenticated
-- user to read any card, column, or label in the database.
-- Now scoped to boards the user owns, public boards, or boards
-- on a team the user belongs to.
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Helper: returns the board IDs accessible to the current user
CREATE OR REPLACE FUNCTION get_my_board_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM project_boards
  WHERE user_id = auth.uid()
     OR is_public = true
     OR team_id IN (SELECT get_my_team_ids());
$$;

-- board_columns
DROP POLICY IF EXISTS "View columns" ON board_columns;
CREATE POLICY "View columns" ON board_columns
  FOR SELECT TO authenticated
  USING (board_id IN (SELECT get_my_board_ids()));

-- board_labels
DROP POLICY IF EXISTS "View labels" ON board_labels;
CREATE POLICY "View labels" ON board_labels
  FOR SELECT TO authenticated
  USING (board_id IN (SELECT get_my_board_ids()));

-- board_cards
DROP POLICY IF EXISTS "View cards" ON board_cards;
CREATE POLICY "View cards" ON board_cards
  FOR SELECT TO authenticated
  USING (board_id IN (SELECT get_my_board_ids()));

-- card_label_assignments
DROP POLICY IF EXISTS "View label assignments" ON card_label_assignments;
CREATE POLICY "View label assignments" ON card_label_assignments
  FOR SELECT TO authenticated
  USING (
    card_id IN (
      SELECT id FROM board_cards
      WHERE board_id IN (SELECT get_my_board_ids())
    )
  );
