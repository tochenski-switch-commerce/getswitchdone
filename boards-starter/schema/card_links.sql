-- ============================================================
-- Card Links Schema
-- Card-to-card linking (bidirectional display, stored once)
-- ============================================================

CREATE TABLE IF NOT EXISTS card_links (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_card_id  uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  target_card_id  uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (source_card_id, target_card_id),
  CHECK (source_card_id <> target_card_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_card_links_source ON card_links(source_card_id);
CREATE INDEX IF NOT EXISTS idx_card_links_target ON card_links(target_card_id);

-- RLS
ALTER TABLE card_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View card links" ON card_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage card links" ON card_links
  FOR ALL TO authenticated USING (true);
