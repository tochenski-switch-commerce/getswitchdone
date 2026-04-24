-- Board overview email schedules
-- One schedule per user per board (upsert on conflict)

CREATE TABLE IF NOT EXISTS board_overview_schedules (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid        NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency   text        NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  time_of_day text        NOT NULL, -- HH:MM (24h, local to timezone)
  day_of_week integer     CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, NULL for daily
  timezone    text        NOT NULL DEFAULT 'UTC',
  next_send_at timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, user_id)
);

ALTER TABLE board_overview_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_overview_schedules"
  ON board_overview_schedules FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass (for cron reads/updates)
CREATE POLICY "service_role_overview_schedules"
  ON board_overview_schedules FOR ALL
  TO service_role USING (true) WITH CHECK (true);
