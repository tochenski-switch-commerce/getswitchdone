-- ============================================================
-- Due Date Notifications Sent
-- Track which due date notifications have been sent to avoid duplicates
-- Run this in your Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS due_date_notifications_sent (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id     uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('due_soon_1day', 'due_soon_1hour', 'due_now')),
  sent_at     timestamptz DEFAULT now(),
  UNIQUE(user_id, card_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_due_date_notifications_sent_card_id ON due_date_notifications_sent(card_id);
CREATE INDEX IF NOT EXISTS idx_due_date_notifications_sent_user_id ON due_date_notifications_sent(user_id);
