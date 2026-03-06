-- ============================================================
-- Board Links Schema
-- Column type for board-to-board linking + link items
-- ============================================================

-- 1. Add column_type to board_columns (default 'normal')
ALTER TABLE board_columns
  ADD COLUMN IF NOT EXISTS column_type text NOT NULL DEFAULT 'normal'
  CHECK (column_type IN ('normal', 'board_links'));

-- 2. board_links — link items in board_links columns
CREATE TABLE IF NOT EXISTS board_links (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id       uuid NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  board_id        uuid NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
  target_board_id uuid NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (column_id, target_board_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_board_links_column_id ON board_links(column_id);
CREATE INDEX IF NOT EXISTS idx_board_links_board_id ON board_links(board_id);
CREATE INDEX IF NOT EXISTS idx_board_links_target_board_id ON board_links(target_board_id);

-- RLS
ALTER TABLE board_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View board links" ON board_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage board links" ON board_links
  FOR ALL TO authenticated USING (true);

-- 3. RPC to get summary stats (card count, column count) for multiple boards
CREATE OR REPLACE FUNCTION get_board_summary_stats(board_ids uuid[])
RETURNS TABLE (board_id uuid, card_count bigint, column_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    b.id AS board_id,
    (SELECT count(*) FROM board_cards bc WHERE bc.board_id = b.id AND bc.is_archived = false) AS card_count,
    (SELECT count(*) FROM board_columns bcol WHERE bcol.board_id = b.id) AS column_count
  FROM unnest(board_ids) AS bid
  JOIN project_boards b ON b.id = bid;
$$;
