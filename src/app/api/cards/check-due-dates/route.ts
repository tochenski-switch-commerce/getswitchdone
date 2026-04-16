import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

function getUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Parse due_time (stored as HH:MM string) into hours and minutes
 */
function parseDueTime(dueTime: string | null): { hours: number; minutes: number } | null {
  if (!dueTime) return null;
  const [hours, minutes] = dueTime.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Check if current time matches due time (within a 1-hour window)
 */
function isDueNow(dueTime: string | null, userTimezone?: string | null): boolean {
  const now = new Date();
  const dueTimeObj = parseDueTime(dueTime);
  if (!dueTimeObj) return false;

  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  // Within 1 hour window of due time
  const dueHours = dueTimeObj.hours;
  const isWithinWindow =
    (currentHours === dueHours && currentMinutes >= 0) ||
    (currentHours === dueHours + 1 && currentMinutes < 60);

  return isWithinWindow;
}

/**
 * Check if due date is tomorrow (at midnight user timezone)
 */
function isDueTomorrow(dueDate: string | null): boolean {
  if (!dueDate) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const due = new Date(dueDate);
  const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  return dueDateOnly.getTime() === tomorrow.getTime();
}

export async function GET(req: NextRequest) {
  // Verify auth
  const authHeader = req.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '');

  if (secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Fetch all active (non-archived) cards with due dates
    const { data: cards, error: cardsError } = await supabaseAdmin
      .from('board_cards')
      .select('id, board_id, title, due_date, due_time, assignee, assignees, timezone')
      .eq('is_archived', false)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true });

    if (cardsError) {
      console.error('Failed to fetch cards:', cardsError);
      return NextResponse.json({ error: cardsError.message }, { status: 500 });
    }

    let notificationsSent = 0;

    // Check each card for due notifications
    for (const card of cards || []) {
      // Get assignees (support both old single assignee and new multi-assignee)
      const assigneeIds = new Set<string>();
      if (card.assignee) assigneeIds.add(card.assignee);
      if (card.assignees && Array.isArray(card.assignees)) {
        card.assignees.forEach((id: string) => assigneeIds.add(id));
      }

      if (assigneeIds.size === 0) continue; // Skip unassigned cards

      // Check for "due tomorrow" notifications (once per day)
      if (isDueTomorrow(card.due_date)) {
        for (const userId of assigneeIds) {
          // Check if already sent
          const { data: sent } = await supabaseAdmin
            .from('due_date_notifications_sent')
            .select('id')
            .eq('user_id', userId)
            .eq('card_id', card.id)
            .eq('notification_type', 'due_soon_1day')
            .single();

          if (!sent) {
            // Send notification
            await fetch(
              `${process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'http://localhost:3000'}/api/push/trigger`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-push-secret': process.env.PUSH_WEBHOOK_SECRET! },
                body: JSON.stringify({
                  type: 'due_soon',
                  user_id: userId,
                  board_id: card.board_id,
                  card_id: card.id,
                  card_title: card.title,
                  message: `${card.title} is due tomorrow`,
                }),
              }
            );

            // Mark as sent
            await supabaseAdmin
              .from('due_date_notifications_sent')
              .upsert({ user_id: userId, card_id: card.id, notification_type: 'due_soon_1day' });

            notificationsSent++;
          }
        }
      }

      // Check for "due in 1 hour" / "due now" notifications (if due_time is set)
      if (card.due_date === new Date().toISOString().split('T')[0]) {
        // Card is due today
        if (isDueNow(card.due_time)) {
          for (const userId of assigneeIds) {
            // Check if already sent (within 1-hour window)
            const { data: sent } = await supabaseAdmin
              .from('due_date_notifications_sent')
              .select('id')
              .eq('user_id', userId)
              .eq('card_id', card.id)
              .eq('notification_type', 'due_now')
              .single();

            if (!sent) {
              // Send notification
              await fetch(
                `${process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'http://localhost:3000'}/api/push/trigger`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-push-secret': process.env.PUSH_WEBHOOK_SECRET! },
                  body: JSON.stringify({
                    type: 'due_now',
                    user_id: userId,
                    board_id: card.board_id,
                    card_id: card.id,
                    card_title: card.title,
                    message: `${card.title} is due now`,
                  }),
                }
              );

              // Mark as sent
              await supabaseAdmin
                .from('due_date_notifications_sent')
                .upsert({ user_id: userId, card_id: card.id, notification_type: 'due_now' });

              notificationsSent++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      cardsChecked: cards?.length || 0,
      notificationsSent,
    });
  } catch (error) {
    console.error('check-due-dates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
