import type { EmailNotificationType } from '@/lib/notification-email';

export type NotificationTriggerType =
  | 'assignment'
  | 'mention'
  | 'due_soon'
  | 'due_now'
  | 'comment'
  | 'overdue'
  | 'checklist_overdue'
  | 'email_unrouted'
  | 'comment_reaction'
  | 'list_automation';

export function mapTriggerTypeToEmailType(type: NotificationTriggerType): EmailNotificationType {
  return type === 'list_automation' ? 'comment' : type;
}
