-- repeat_series table
-- Owns the repeat_rule and active state for a series of repeating cards.
-- Cards reference repeat_series_id; deleting individual cards never kills the series.

CREATE TABLE IF NOT EXISTS repeat_series (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid        NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
  repeat_rule jsonb       NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for board-level lookups (drawer)
CREATE INDEX IF NOT EXISTS idx_repeat_series_board_id ON repeat_series (board_id);

-- Index for cron (active series only)
CREATE INDEX IF NOT EXISTS idx_repeat_series_active ON repeat_series (board_id) WHERE is_active = true;

-- RLS
ALTER TABLE repeat_series ENABLE ROW LEVEL SECURITY;

-- Users can manage series on boards they own
CREATE POLICY "Users manage their own repeat series"
  ON repeat_series
  FOR ALL
  USING (
    board_id IN (
      SELECT id FROM project_boards WHERE user_id = auth.uid()
    )
  );

-- Team members can read/write series on shared boards
CREATE POLICY "Team members access repeat series"
  ON repeat_series
  FOR ALL
  USING (
    board_id IN (
      SELECT id FROM project_boards
      WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Service role bypass (used by cron)
CREATE POLICY "Service role full access to repeat_series"
  ON repeat_series
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Backfill: one series row per distinct repeat_series_id found on existing cards.
-- Uses the most recently created card's repeat_rule as the authoritative rule.
INSERT INTO repeat_series (id, board_id, repeat_rule, is_active)
SELECT DISTINCT ON (bc.repeat_series_id)
  bc.repeat_series_id,
  bc.board_id,
  bc.repeat_rule,
  true
FROM board_cards bc
WHERE bc.repeat_series_id IS NOT NULL
  AND bc.repeat_rule IS NOT NULL
ORDER BY bc.repeat_series_id, bc.created_at DESC
ON CONFLICT (id) DO NOTHING;
