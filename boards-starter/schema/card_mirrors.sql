-- ============================================================
-- Card Mirrors Schema
-- Bidirectional field sync between cards across boards
-- ============================================================

-- Ensure due_time exists (added by due_time.sql migration; guard here for safety)
ALTER TABLE board_cards ADD COLUMN IF NOT EXISTS due_time text;

CREATE TABLE IF NOT EXISTS card_mirrors (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_card_id  uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  target_card_id  uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (source_card_id, target_card_id),
  CHECK (source_card_id <> target_card_id)
);

CREATE INDEX IF NOT EXISTS idx_card_mirrors_source ON card_mirrors(source_card_id);
CREATE INDEX IF NOT EXISTS idx_card_mirrors_target ON card_mirrors(target_card_id);

ALTER TABLE card_mirrors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View card mirrors" ON card_mirrors;
DROP POLICY IF EXISTS "Manage card mirrors" ON card_mirrors;

CREATE POLICY "View card mirrors" ON card_mirrors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage card mirrors" ON card_mirrors
  FOR ALL TO authenticated USING (true);

-- ============================================================
-- Trigger: sync scalar fields bidirectionally on card update
-- Synced fields: title, description, priority, due_date,
--                start_date, due_time
-- NOT synced: assignees, labels, checklists, comments,
--             column_id, position (board-specific)
-- ============================================================

CREATE OR REPLACE FUNCTION sync_card_mirror_fields()
RETURNS TRIGGER AS $$
DECLARE
  mirror    RECORD;
  other_id  uuid;
BEGIN
  -- Prevent recursive trigger firing when mirrored cards are updated
  IF pg_trigger_depth() > 0 THEN
    RETURN NEW;
  END IF;

  FOR mirror IN
    SELECT * FROM card_mirrors
    WHERE source_card_id = NEW.id OR target_card_id = NEW.id
  LOOP
    other_id := CASE
      WHEN mirror.source_card_id = NEW.id THEN mirror.target_card_id
      ELSE mirror.source_card_id
    END;

    UPDATE board_cards
    SET
      title       = NEW.title,
      description = NEW.description,
      priority    = NEW.priority,
      due_date    = NEW.due_date,
      start_date  = NEW.start_date,
      due_time    = NEW.due_time,
      updated_at  = NOW()
    WHERE id = other_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS card_mirror_sync ON board_cards;

CREATE TRIGGER card_mirror_sync
AFTER UPDATE OF title, description, priority, due_date, start_date, due_time
ON board_cards
FOR EACH ROW
EXECUTE FUNCTION sync_card_mirror_fields();
