-- ============================================================
-- Notification Preferences
-- Control which notifications users receive per board and type
-- Run this in your Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id    uuid NOT NULL REFERENCES project_boards(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('assignment', 'mention', 'comment', 'due_soon', 'due_now')),
  enabled     boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, board_id, notification_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own preferences
CREATE POLICY "View own notification preferences" ON notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Update own notification preferences" ON notification_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_board_id ON notification_preferences(board_id);
