-- ============================================================
-- Teams, Invites & Board Sharing Schema
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 1. teams — a named group of users
CREATE TABLE IF NOT EXISTS teams (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now()
);

-- 2. team_members — user ↔ team join table with role
CREATE TABLE IF NOT EXISTS team_members (
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- 3. team_invites — shareable invite links
CREATE TABLE IF NOT EXISTS team_invites (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  max_uses    integer,                       -- null = unlimited
  use_count   integer NOT NULL DEFAULT 0,
  expires_at  timestamptz,                    -- null = never expires
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

-- 4. Add team_id to project_boards (nullable — personal boards have NULL)
ALTER TABLE project_boards
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_boards_team_id ON project_boards(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_code ON team_invites(invite_code);

-- ============================================================
-- Helper functions (SECURITY DEFINER — bypass RLS to avoid
-- infinite recursion when team_members policies query itself)
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_owned_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'owner';
$$;

CREATE OR REPLACE FUNCTION get_my_watched_board_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT bc.board_id
  FROM card_watchers cw
  JOIN board_cards bc ON bc.id = cw.card_id
  WHERE cw.user_id = auth.uid();
$$;

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- teams: viewable/manageable by members
DROP POLICY IF EXISTS "View teams I belong to" ON teams;
CREATE POLICY "View teams I belong to" ON teams
  FOR SELECT TO authenticated
  USING (id IN (SELECT get_my_team_ids()));

DROP POLICY IF EXISTS "Create teams" ON teams;
CREATE POLICY "Create teams" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Update teams (owner only)" ON teams;
CREATE POLICY "Update teams (owner only)" ON teams
  FOR UPDATE TO authenticated
  USING (id IN (SELECT get_my_owned_team_ids()));

DROP POLICY IF EXISTS "Delete teams (owner only)" ON teams;
CREATE POLICY "Delete teams (owner only)" ON teams
  FOR DELETE TO authenticated
  USING (id IN (SELECT get_my_owned_team_ids()));

-- team_members: viewable by fellow members, manageable by owners
DROP POLICY IF EXISTS "View team members" ON team_members;
CREATE POLICY "View team members" ON team_members
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT get_my_team_ids()));

DROP POLICY IF EXISTS "Insert team members (owner or self-join)" ON team_members;
CREATE POLICY "Insert team members (owner or self-join)" ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- owners can add anyone
    team_id IN (SELECT get_my_owned_team_ids())
    -- or self-join (used by invite flow)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Delete team members (owner or self)" ON team_members;
CREATE POLICY "Delete team members (owner or self)" ON team_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (SELECT get_my_owned_team_ids())
  );

-- team_invites: viewable/manageable by team owners
DROP POLICY IF EXISTS "View team invites (owner)" ON team_invites;
CREATE POLICY "View team invites (owner)" ON team_invites
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT get_my_owned_team_ids()));

-- Allow anyone authenticated to read an invite by code (for the join flow)
DROP POLICY IF EXISTS "Read invite by code" ON team_invites;
CREATE POLICY "Read invite by code" ON team_invites
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Create team invites (owner)" ON team_invites;
CREATE POLICY "Create team invites (owner)" ON team_invites
  FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT get_my_owned_team_ids()));

DROP POLICY IF EXISTS "Update team invites (owner)" ON team_invites;
CREATE POLICY "Update team invites (owner)" ON team_invites
  FOR UPDATE TO authenticated
  USING (team_id IN (SELECT get_my_owned_team_ids()));

DROP POLICY IF EXISTS "Delete team invites (owner)" ON team_invites;
CREATE POLICY "Delete team invites (owner)" ON team_invites
  FOR DELETE TO authenticated
  USING (team_id IN (SELECT get_my_owned_team_ids()));

-- ============================================================
-- Update project_boards RLS — owner OR team member OR is_public
-- ============================================================

-- Drop old policies first
DROP POLICY IF EXISTS "View own or public boards" ON project_boards;
DROP POLICY IF EXISTS "Insert own boards" ON project_boards;
DROP POLICY IF EXISTS "Update own boards" ON project_boards;
DROP POLICY IF EXISTS "Delete own boards" ON project_boards;

-- New policies
DROP POLICY IF EXISTS "View accessible boards" ON project_boards;
CREATE POLICY "View accessible boards" ON project_boards
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR is_public = true
    OR team_id IN (SELECT get_my_team_ids())
    OR id IN (SELECT get_my_watched_board_ids())
  );

DROP POLICY IF EXISTS "Insert own boards" ON project_boards;
CREATE POLICY "Insert own boards" ON project_boards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own or team boards" ON project_boards;
CREATE POLICY "Update own or team boards" ON project_boards
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR team_id IN (SELECT get_my_owned_team_ids())
  );

DROP POLICY IF EXISTS "Delete own boards" ON project_boards;
CREATE POLICY "Delete own boards" ON project_boards
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- can_access_board() — reusable function for child-table RLS
-- ============================================================
CREATE OR REPLACE FUNCTION can_access_board(board_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_boards
    WHERE id = board_uuid
      AND (
        user_id = auth.uid()
        OR is_public = true
        OR team_id IN (SELECT get_my_team_ids())
      )
  )
  OR board_uuid IN (SELECT get_my_watched_board_ids());
$$;

-- ============================================================
-- Tighten child-table RLS using can_access_board()
-- ============================================================

-- board_columns
DROP POLICY IF EXISTS "View columns" ON board_columns;
DROP POLICY IF EXISTS "Manage columns" ON board_columns;
DROP POLICY IF EXISTS "Access columns" ON board_columns;
CREATE POLICY "Access columns" ON board_columns
  FOR ALL TO authenticated
  USING (can_access_board(board_id));

-- board_labels
DROP POLICY IF EXISTS "View labels" ON board_labels;
DROP POLICY IF EXISTS "Manage labels" ON board_labels;
DROP POLICY IF EXISTS "Access labels" ON board_labels;
CREATE POLICY "Access labels" ON board_labels
  FOR ALL TO authenticated
  USING (can_access_board(board_id));

-- board_cards
DROP POLICY IF EXISTS "View cards" ON board_cards;
DROP POLICY IF EXISTS "Manage cards" ON board_cards;
DROP POLICY IF EXISTS "Access cards" ON board_cards;
CREATE POLICY "Access cards" ON board_cards
  FOR ALL TO authenticated
  USING (can_access_board(board_id));

-- card_label_assignments — needs join through board_cards
DROP POLICY IF EXISTS "View label assignments" ON card_label_assignments;
DROP POLICY IF EXISTS "Manage label assignments" ON card_label_assignments;
DROP POLICY IF EXISTS "Access label assignments" ON card_label_assignments;
CREATE POLICY "Access label assignments" ON card_label_assignments
  FOR ALL TO authenticated
  USING (
    card_id IN (SELECT id FROM board_cards WHERE can_access_board(board_id))
  );

-- card_comments
DROP POLICY IF EXISTS "View comments" ON card_comments;
DROP POLICY IF EXISTS "Manage comments" ON card_comments;
DROP POLICY IF EXISTS "Access comments" ON card_comments;
CREATE POLICY "Access comments" ON card_comments
  FOR ALL TO authenticated
  USING (
    card_id IN (SELECT id FROM board_cards WHERE can_access_board(board_id))
  );

-- card_checklists
DROP POLICY IF EXISTS "View checklists" ON card_checklists;
DROP POLICY IF EXISTS "Manage checklists" ON card_checklists;
DROP POLICY IF EXISTS "Access checklists" ON card_checklists;
CREATE POLICY "Access checklists" ON card_checklists
  FOR ALL TO authenticated
  USING (
    card_id IN (SELECT id FROM board_cards WHERE can_access_board(board_id))
  );

-- board_custom_fields
DROP POLICY IF EXISTS "View custom fields" ON board_custom_fields;
DROP POLICY IF EXISTS "Manage custom fields" ON board_custom_fields;
DROP POLICY IF EXISTS "Access custom fields" ON board_custom_fields;
CREATE POLICY "Access custom fields" ON board_custom_fields
  FOR ALL TO authenticated
  USING (can_access_board(board_id));

-- card_custom_field_values — join through board_cards
DROP POLICY IF EXISTS "View custom field values" ON card_custom_field_values;
DROP POLICY IF EXISTS "Manage custom field values" ON card_custom_field_values;
DROP POLICY IF EXISTS "Access custom field values" ON card_custom_field_values;
CREATE POLICY "Access custom field values" ON card_custom_field_values
  FOR ALL TO authenticated
  USING (
    card_id IN (SELECT id FROM board_cards WHERE can_access_board(board_id))
  );

-- board_links
DROP POLICY IF EXISTS "View board links" ON board_links;
DROP POLICY IF EXISTS "Manage board links" ON board_links;
DROP POLICY IF EXISTS "Access board links" ON board_links;
CREATE POLICY "Access board links" ON board_links
  FOR ALL TO authenticated
  USING (can_access_board(board_id));

-- card_links — join through board_cards
DROP POLICY IF EXISTS "View card links" ON card_links;
DROP POLICY IF EXISTS "Manage card links" ON card_links;
DROP POLICY IF EXISTS "Access card links" ON card_links;
CREATE POLICY "Access card links" ON card_links
  FOR ALL TO authenticated
  USING (
    source_card_id IN (SELECT id FROM board_cards WHERE can_access_board(board_id))
  );

-- board_emails
DROP POLICY IF EXISTS "View board emails" ON board_emails;
DROP POLICY IF EXISTS "Manage board emails" ON board_emails;
DROP POLICY IF EXISTS "Access board emails" ON board_emails;
CREATE POLICY "Access board emails" ON board_emails
  FOR ALL TO authenticated
  USING (
    board_id IS NULL  -- unrouted emails visible to all authenticated
    OR can_access_board(board_id)
  );

-- ============================================================
-- create_team() — atomic: creates team + adds owner in one call
-- ============================================================
CREATE OR REPLACE FUNCTION create_team(team_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team teams%ROWTYPE;
BEGIN
  INSERT INTO teams (name, created_by)
    VALUES (trim(team_name), auth.uid())
    RETURNING * INTO v_team;

  INSERT INTO team_members (team_id, user_id, role)
    VALUES (v_team.id, auth.uid(), 'owner');

  RETURN row_to_json(v_team);
END;
$$;

-- ============================================================
-- Increment invite use_count (called from app after joining)
-- ============================================================
CREATE OR REPLACE FUNCTION use_team_invite(code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite team_invites%ROWTYPE;
  v_team_id uuid;
BEGIN
  SELECT * INTO v_invite FROM team_invites
    WHERE invite_code = code AND is_active = true
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or inactive invite code';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.use_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'Invite has reached maximum uses';
  END IF;

  v_team_id := v_invite.team_id;

  -- Add member (ignore if already exists)
  INSERT INTO team_members (team_id, user_id, role)
    VALUES (v_team_id, auth.uid(), 'editor')
    ON CONFLICT (team_id, user_id) DO NOTHING;

  -- Increment use count
  UPDATE team_invites SET use_count = use_count + 1 WHERE id = v_invite.id;

  RETURN v_team_id;
END;
$$;
