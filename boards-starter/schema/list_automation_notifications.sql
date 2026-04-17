-- list_automation_notifications.sql
-- Allow list automation notification type in notifications table

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'comment',
    'assignment',
    'due_soon',
    'overdue',
    'mention',
    'email_unrouted',
    'checklist_overdue',
    'comment_reaction',
    'list_automation'
  ));
