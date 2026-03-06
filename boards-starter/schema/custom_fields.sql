-- ============================================================
-- Custom Fields Schema
-- Board-level field definitions + per-card values
-- ============================================================

-- 1. board_custom_fields — field definitions per board
CREATE TABLE IF NOT EXISTS board_custom_fields (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id      uuid NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
  title         text NOT NULL,
  field_type    text NOT NULL CHECK (field_type IN ('text', 'date', 'dropdown', 'multiselect', 'number', 'checkbox')),
  options       jsonb DEFAULT '[]'::jsonb,   -- for dropdown / multiselect
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- 2. card_custom_field_values — values per card × field
CREATE TABLE IF NOT EXISTS card_custom_field_values (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id       uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  field_id      uuid NOT NULL REFERENCES board_custom_fields(id) ON DELETE CASCADE,
  value         text,                         -- text / date / number stored as text
  multi_value   jsonb DEFAULT '[]'::jsonb,    -- for multiselect
  UNIQUE (card_id, field_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_board_custom_fields_board_id ON board_custom_fields(board_id);
CREATE INDEX IF NOT EXISTS idx_card_custom_field_values_card_id ON card_custom_field_values(card_id);
CREATE INDEX IF NOT EXISTS idx_card_custom_field_values_field_id ON card_custom_field_values(field_id);

-- RLS
ALTER TABLE board_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View custom fields" ON board_custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage custom fields" ON board_custom_fields FOR ALL TO authenticated USING (true);

CREATE POLICY "View custom field values" ON card_custom_field_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage custom field values" ON card_custom_field_values FOR ALL TO authenticated USING (true);

-- Anon needs to insert custom field values via form submission
CREATE POLICY "Anon insert custom field values" ON card_custom_field_values
  FOR INSERT TO anon WITH CHECK (true);
