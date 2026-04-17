-- ============================================================
-- Checklist due-date reminder dedupe support
-- Extends due_date_notifications_sent so checklist reminders can
-- be tracked independently from card reminders.
-- ============================================================

ALTER TABLE due_date_notifications_sent
  ADD COLUMN IF NOT EXISTS checklist_item_id uuid REFERENCES card_checklists(id) ON DELETE CASCADE;

ALTER TABLE due_date_notifications_sent
  DROP CONSTRAINT IF EXISTS due_date_notifications_sent_notification_type_check;

ALTER TABLE due_date_notifications_sent
  ADD CONSTRAINT due_date_notifications_sent_notification_type_check
  CHECK (
    notification_type IN (
      'due_soon_1day',
      'due_soon_1hour',
      'due_now',
      'checklist_due_soon_1day',
      'checklist_due_now'
    )
  );

ALTER TABLE due_date_notifications_sent
  DROP CONSTRAINT IF EXISTS due_date_notifications_sent_user_id_card_id_notification_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_due_date_notifications_sent_card_unique
  ON due_date_notifications_sent(user_id, card_id, notification_type)
  WHERE checklist_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_due_date_notifications_sent_checklist_unique
  ON due_date_notifications_sent(user_id, checklist_item_id, notification_type)
  WHERE checklist_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_due_date_notifications_sent_checklist_item_id
  ON due_date_notifications_sent(checklist_item_id);
