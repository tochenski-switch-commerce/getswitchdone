-- ============================================================
-- Forms Schema — Public form intake → card creation
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 1. board_forms — form definitions
CREATE TABLE IF NOT EXISTS board_forms (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id      uuid NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
  column_id     uuid NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  slug          text NOT NULL UNIQUE,
  fields        jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 2. form_submissions — log of submissions
CREATE TABLE IF NOT EXISTS form_submissions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id       uuid NOT NULL REFERENCES board_forms(id) ON DELETE CASCADE,
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  card_id       uuid REFERENCES board_cards(id) ON DELETE SET NULL,
  submitted_at  timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_board_forms_user_id ON board_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_board_forms_board_id ON board_forms(board_id);
CREATE INDEX IF NOT EXISTS idx_board_forms_slug ON board_forms(slug);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);

-- RLS
ALTER TABLE board_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- board_forms: owners can manage, anyone can read active forms (for public page)
CREATE POLICY "View own forms" ON board_forms
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own forms" ON board_forms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own forms" ON board_forms
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own forms" ON board_forms
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public read for active forms (anon role for public form page)
CREATE POLICY "Public read active forms" ON board_forms
  FOR SELECT TO anon USING (is_active = true);

-- form_submissions: owners see submissions, anon can insert
CREATE POLICY "View own submissions" ON form_submissions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM board_forms WHERE board_forms.id = form_submissions.form_id AND board_forms.user_id = auth.uid())
  );
CREATE POLICY "Anon insert submissions" ON form_submissions
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Auth insert submissions" ON form_submissions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Anon needs to insert cards via form submission
CREATE POLICY "Anon insert cards" ON board_cards
  FOR INSERT TO anon WITH CHECK (true);

-- Anon needs to read columns to determine position
CREATE POLICY "Anon read columns" ON board_columns
  FOR SELECT TO anon USING (true);

-- Anon needs to read cards to determine next position
CREATE POLICY "Anon read cards" ON board_cards
  FOR SELECT TO anon USING (true);

-- Updated_at trigger
CREATE TRIGGER update_board_forms_updated_at
  BEFORE UPDATE ON board_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
