import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export async function GET(req: NextRequest) {
  // Verify auth — accept either CRON_SECRET or PUSH_WEBHOOK_SECRET
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET || process.env.PUSH_WEBHOOK_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const tz = process.env.APP_TIMEZONE || 'America/New_York';
  const now = new Date();

  // Get current date and time in the app's timezone
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayStr = formatter.format(now); // 'YYYY-MM-DD'
  const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const currentTime = timeFormatter.format(now); // 'HH:mm'

  // Find non-archived cards that are overdue:
  // 1. due_date is before today, OR
  // 2. due_date is today AND due_time has passed
  // We query cards due today or earlier that haven't been archived
  const { data: cards, error: cardsErr } = await db
    .from('board_cards')
    .select('id, title, due_date, due_time, board_id, created_by, assignee, assignees')
    .eq('is_archived', false)
    .not('due_date', 'is', null)
    .lte('due_date', todayStr);

  if (cardsErr) {
    console.error('[check-overdue] Failed to query cards:', cardsErr.message);
    return NextResponse.json({ error: cardsErr.message }, { status: 500 });
  }

  if (!cards || cards.length === 0) {
    return NextResponse.json({ checked: 0, notified: 0 });
  }

  // Filter to actually overdue cards (accounting for due_time on today's cards)
  const overdueCards = cards.filter(card => {
    if (card.due_date < todayStr) return true;
    // due_date === todayStr
    if (card.due_time) {
      return card.due_time <= currentTime;
    }
    // No time set, due today = not overdue until end of day
    return false;
  });

  if (overdueCards.length === 0) {
    return NextResponse.json({ checked: cards.length, notified: 0 });
  }

  // Check which cards already have an overdue notification (avoid duplicates)
  const cardIds = overdueCards.map(c => c.id);
  const { data: existingNotifs } = await db
    .from('notifications')
    .select('card_id')
    .eq('type', 'overdue')
    .in('card_id', cardIds);

  const alreadyNotified = new Set((existingNotifs || []).map(n => n.card_id));
  const newOverdue = overdueCards.filter(c => !alreadyNotified.has(c.id));

  if (newOverdue.length === 0) {
    return NextResponse.json({ checked: cards.length, notified: 0, alreadyNotified: alreadyNotified.size });
  }

  // For each overdue card, determine who to notify:
  // - The card creator (created_by)
  // - All assignees
  // Deduplicate user IDs per card
  const notifications: { user_id: string; board_id: string; card_id: string; type: string; title: string; body: string }[] = [];
  const pushTargets: { user_id: string; title: string; body: string; type: string; board_id: string; card_id: string }[] = [];

  for (const card of newOverdue) {
    const userIds = new Set<string>();
    if (card.created_by) userIds.add(card.created_by);

    // Look up assignee user IDs from user_profiles (assignees are stored as names)
    const assigneeNames: string[] = card.assignees?.length ? card.assignees : card.assignee ? [card.assignee] : [];
    if (assigneeNames.length > 0) {
      const { data: profiles } = await db
        .from('user_profiles')
        .select('id')
        .in('name', assigneeNames);
      if (profiles) {
        for (const p of profiles) userIds.add(p.id);
      }
    }

    const dueDisplay = new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = card.due_time ? ` at ${formatTime12(card.due_time)}` : '';
    const title = `"${card.title}" is overdue`;
    const body = `Due ${dueDisplay}${timeStr}`;

    for (const userId of userIds) {
      notifications.push({
        user_id: userId,
        board_id: card.board_id,
        card_id: card.id,
        type: 'overdue',
        title,
        body,
      });
      pushTargets.push({ user_id: userId, title, body, type: 'overdue', board_id: card.board_id, card_id: card.id });
    }
  }

  // Batch insert notifications
  if (notifications.length > 0) {
    const { error: insertErr } = await db.from('notifications').insert(notifications);
    if (insertErr) {
      console.error('[check-overdue] Failed to insert notifications:', insertErr.message);
    }
  }

  // Send push notifications (fire-and-forget, don't block response)
  const pushUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/push/send`;
  const pushSecret = process.env.PUSH_WEBHOOK_SECRET;

  if (pushSecret) {
    for (const target of pushTargets) {
      try {
        await fetch(pushUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-push-secret': pushSecret,
          },
          body: JSON.stringify(target),
        });
      } catch (err) {
        console.error('[check-overdue] Push failed for', target.user_id, err);
      }
    }
  }

  return NextResponse.json({
    checked: cards.length,
    notified: newOverdue.length,
    pushSent: pushTargets.length,
  });
}
