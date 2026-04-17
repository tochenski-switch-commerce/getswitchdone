/**
 * Helper to trigger push notifications via the push/trigger API.
 * Call this after card operations that should notify users.
 */

import type { NotificationTriggerType } from '@/app/api/push/trigger/route';
import { supabase } from '@/lib/supabase';

export async function triggerNotification(payload: {
  type: NotificationTriggerType;
  user_id: string;
  board_id: string;
  card_id: string;
  checklist_item_id?: string;
  card_title?: string;
  actor_name?: string;
  message?: string;
  title?: string;
  body?: string;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/push/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error(`Failed to trigger ${payload.type} notification:`, err);
    }
  } catch (err) {
    console.error(`Error triggering ${payload.type} notification:`, err);
    // Don't throw — notification failure shouldn't break the main operation
  }
}

/**
 * Trigger multiple notifications in parallel.
 * Useful for notifying multiple people (e.g., all mentees).
 */
export async function triggerNotifications(
  payloads: Array<{
    type: NotificationTriggerType;
    user_id: string;
    board_id: string;
    card_id: string;
    checklist_item_id?: string;
    card_title?: string;
    actor_name?: string;
    message?: string;
    title?: string;
    body?: string;
  }>
) {
  await Promise.all(payloads.map(p => triggerNotification(p)));
}
