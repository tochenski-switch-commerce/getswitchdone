-- ============================================================
-- Board Templates
-- Stores preset and team-saved board templates for the Board Wizard.
-- Run this in your Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS board_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id       uuid REFERENCES teams(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  icon          text,
  icon_color    text,
  is_preset     boolean NOT NULL DEFAULT false,
  template_data jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS board_templates_team_id_idx ON board_templates (team_id);
CREATE INDEX IF NOT EXISTS board_templates_created_by_idx ON board_templates (created_by);
CREATE INDEX IF NOT EXISTS board_templates_is_preset_idx ON board_templates (is_preset);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE board_templates ENABLE ROW LEVEL SECURITY;

-- Preset templates are readable by all authenticated users
CREATE POLICY "Read preset templates" ON board_templates
  FOR SELECT TO authenticated
  USING (is_preset = true);

-- Team templates are readable by team members
CREATE POLICY "Read team templates" ON board_templates
  FOR SELECT TO authenticated
  USING (
    is_preset = false AND
    team_id IS NOT NULL AND
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- Personal templates (no team) are readable only by the creator
CREATE POLICY "Read personal templates" ON board_templates
  FOR SELECT TO authenticated
  USING (
    is_preset = false AND
    team_id IS NULL AND
    created_by = auth.uid()
  );

-- Any authenticated user can create a template
CREATE POLICY "Create templates" ON board_templates
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Creators can update/delete their own templates
CREATE POLICY "Manage own templates" ON board_templates
  FOR ALL TO authenticated
  USING (created_by = auth.uid());

-- ── updated_at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_board_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER board_templates_updated_at
  BEFORE UPDATE ON board_templates
  FOR EACH ROW EXECUTE FUNCTION update_board_templates_updated_at();
