-- ============================================================
-- Overdue notification dedup support
-- Extends due_date_notifications_sent so overdue reminders from
-- check-overdue are tracked with the same unique-constraint
-- guarantee used by check-due-dates.
-- ============================================================

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
      'checklist_due_now',
      'overdue',
      'checklist_overdue'
    )
  );
