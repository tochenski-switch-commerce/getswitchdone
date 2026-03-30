import * as crypto from 'crypto';
import { getAdminClient } from './db';

export type WebhookEvent =
  | 'board.created' | 'board.updated' | 'board.deleted'
  | 'card.created' | 'card.updated' | 'card.moved' | 'card.deleted'
  | 'column.created' | 'column.deleted'
  | 'label.created' | 'label.deleted';

export async function dispatchWebhook(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const db = getAdminClient();

  const { data: endpoints, error } = await db
    .from('webhook_endpoints')
    .select('id, url, secret')
    .eq('user_id', userId)
    .eq('is_active', true)
    .contains('events', [event]);

  if (error || !endpoints?.length) return;

  const payload = { event, timestamp: new Date().toISOString(), data };
  const body = JSON.stringify(payload);
  const deliveryId = crypto.randomUUID();

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const sig = crypto
        .createHmac('sha256', endpoint.secret)
        .update(body)
        .digest('hex');

      try {
        await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Lumio-Signature': `sha256=${sig}`,
            'X-Lumio-Event': event,
            'X-Lumio-Delivery': deliveryId,
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
      } catch (e) {
        console.error(`[webhook] delivery failed to ${endpoint.url}:`, e);
      }
    })
  );
}
