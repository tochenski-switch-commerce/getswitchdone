-- ============================================================
-- Notifications / Inbox
-- Run this in your Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id    uuid REFERENCES project_boards(id) ON DELETE CASCADE,
  card_id     uuid REFERENCES board_cards(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('comment', 'assignment', 'due_soon', 'overdue', 'mention', 'email_unrouted')),
  title       text NOT NULL,
  body        text,
  is_read     boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "View own notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Authenticated users can insert notifications (for other users)
CREATE POLICY "Insert notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Users can only update (mark read) their own notifications
CREATE POLICY "Update own notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Users can only delete their own notifications
CREATE POLICY "Delete own notifications" ON notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
