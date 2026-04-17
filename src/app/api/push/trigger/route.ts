import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { maybeSendNotificationEmail } from '@/lib/notification-email';

if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@lumio.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

export type NotificationTriggerType =
  | 'assignment'
  | 'mention'
  | 'due_soon'
  | 'due_now'
  | 'comment'
  | 'overdue'
  | 'checklist_overdue'
  | 'email_unrouted'
  | 'comment_reaction';

interface TriggerPayload {
  type: NotificationTriggerType;
  user_id: string; // Who this notification is for
  board_id: string;
  card_id: string;
  card_title?: string;
  actor_id?: string; // Who performed the action (for assignment/comment)
  actor_name?: string; // Display name of actor
  message?: string; // Custom message for due notifications
}

function mapBoardPreferenceType(type: NotificationTriggerType): 'assignment' | 'mention' | 'comment' | 'due_soon' | 'due_now' | null {
  if (type === 'assignment') return 'assignment';
  if (type === 'mention') return 'mention';
  if (type === 'comment' || type === 'comment_reaction') return 'comment';
  if (type === 'due_soon' || type === 'overdue' || type === 'checklist_overdue') return 'due_soon';
  if (type === 'due_now') return 'due_now';
  return null;
}

// Helper to verify webhook calls (from external services or cron jobs)
function verifyWebhookSecret(headerSecret?: string): boolean {
  if (!process.env.PUSH_WEBHOOK_SECRET) return false;
  return headerSecret === process.env.PUSH_WEBHOOK_SECRET;
}

export async function POST(req: NextRequest) {
  const payload: TriggerPayload = await req.json();
  const { type, user_id, board_id, card_id, card_title, actor_id, actor_name, message } = payload;

  // Verify auth — accept either webhook secret OR valid Bearer token
  const headerSecret = req.headers.get('x-push-secret');
  const authHeader = req.headers.get('authorization');
    const isWebhookCall = verifyWebhookSecret(headerSecret ?? undefined);
    const isBearerToken = authHeader?.startsWith('Bearer ');

    // For now, allow webhook calls or bearer tokens
    // In production, you might want stricter validation
    if (!isWebhookCall && !isBearerToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

  if (!user_id || !board_id || !card_id || !type) {
    return NextResponse.json(
      { error: 'Missing required: user_id, board_id, card_id, type' },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const preferenceType = mapBoardPreferenceType(type);

    // Check notification preferences for this user/board/type
    const { data: prefs } = preferenceType
      ? await supabaseAdmin
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user_id)
          .eq('board_id', board_id)
          .eq('notification_type', preferenceType)
          .single()
      : { data: null };

    // Skip if user has disabled this notification type for this board
    if (prefs && !prefs.enabled) {
      return NextResponse.json({ sent: 0, skipped: true, reason: 'disabled_by_user' });
    }

    // Build notification title/body
    let title = 'Lumio';
    let body = '';

    switch (type) {
      case 'assignment':
        title = '🎯 Assigned';
        body = actor_name ? `${actor_name} assigned you to: ${card_title || 'a card'}` : `You were assigned to: ${card_title || 'a card'}`;
        break;
      case 'mention':
        title = '💬 Mentioned';
        body = actor_name ? `${actor_name} mentioned you in: ${card_title || 'a card'}` : `You were mentioned in: ${card_title || 'a card'}`;
        break;
      case 'comment':
        title = '💬 Comment';
        body = actor_name ? `${actor_name} commented on: ${card_title || 'a card'}` : `New comment on: ${card_title || 'a card'}`;
        break;
      case 'due_soon':
        title = '⏰ Due Soon';
        body = message || `${card_title || 'A card'} is due soon`;
        break;
      case 'due_now':
        title = '🔴 Due Now';
        body = message || `${card_title || 'A card'} is due now`;
        break;
      case 'overdue':
        title = '⚠️ Overdue';
        body = message || `${card_title || 'A card'} is overdue`;
        break;
      case 'checklist_overdue':
        title = '⚠️ Checklist Overdue';
        body = message || `${card_title || 'A checklist item'} is overdue`;
        break;
      case 'email_unrouted':
        title = '📩 Email Unrouted';
        body = message || 'An inbound email could not be routed to a board.';
        break;
      case 'comment_reaction':
        title = '👍 Comment Reaction';
        body = message || `${actor_name || 'Someone'} reacted to your comment on ${card_title || 'a card'}`;
        break;
    }

    // Create inbox notification
    const { error: notifError } = await supabaseAdmin.from('notifications').insert({
      user_id,
      board_id,
      card_id,
      type: type === 'due_now' ? 'due_soon' : type,
      title,
      body,
      is_read: false,
    });

    if (notifError) {
      console.error('Failed to create notification:', notifError);
      // Continue anyway — try to send push even if inbox fails
    }

    // Get web push subscriptions for this user
    const { data: webSubs, error: subsError } = await supabaseAdmin
      .from('web_push_subscriptions')
      .select('endpoint, p256dh, auth, id')
      .eq('user_id', user_id);

    if (subsError) {
      console.error('Failed to fetch web push subscriptions:', subsError);
    }

    let webSent = 0;
    if (webSubs && webSubs.length > 0 && process.env.VAPID_PRIVATE_KEY) {
      const webResults = await Promise.allSettled(
        webSubs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title, body, type, board_id, card_id })
            );
            return true;
          } catch (err: unknown) {
            // 410 Gone = subscription expired, clean it up
            if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
              await supabaseAdmin.from('web_push_subscriptions').delete().eq('id', sub.id);
            }
            return false;
          }
        })
      );
      webSent = webResults.filter((r) => r.status === 'fulfilled' && r.value).length;
    }

    const emailSent = await maybeSendNotificationEmail({
      supabaseAdmin,
      userId: user_id,
      type,
      title,
      body,
      boardId: board_id,
      cardId: card_id,
    });

    return NextResponse.json({ sent: webSent, emailSent, type });
  } catch (error) {
    console.error('Push trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
