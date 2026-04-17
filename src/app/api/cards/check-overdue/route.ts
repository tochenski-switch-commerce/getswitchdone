import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { maybeSendNotificationEmail } from '@/lib/notification-email';

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

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.URL) return process.env.URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function getRecipientIds(primary?: string | null, assignees?: string[] | null): string[] {
  const ids = new Set<string>();

  if (primary?.trim()) ids.add(primary.trim());
  for (const value of assignees || []) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) ids.add(trimmed);
  }

  return [...ids];
}

export async function GET(req: NextRequest) {
  // Verify auth — accept either CRON_SECRET or PUSH_WEBHOOK_SECRET
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET || process.env.PUSH_WEBHOOK_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const fallbackTz = process.env.APP_TIMEZONE || 'America/New_York';
  const now = new Date();

  // Fetch all non-archived boards with their timezone
  const { data: boards, error: boardsErr } = await db
    .from('project_boards')
    .select('id, timezone')
    .eq('is_archived', false);

  if (boardsErr) {
    console.error('[check-overdue] Failed to query boards:', boardsErr.message);
    return NextResponse.json({ error: boardsErr.message }, { status: 500 });
  }

  const boardTzMap = new Map<string, string>();
  for (const b of boards || []) {
    boardTzMap.set(b.id, b.timezone || fallbackTz);
  }

  // Find non-archived, incomplete cards with a due date
  const { data: cards, error: cardsErr } = await db
    .from('board_cards')
    .select('id, title, due_date, due_time, board_id, assignee, assignees')
    .eq('is_archived', false)
    .eq('is_complete', false)
    .not('due_date', 'is', null);

  if (cardsErr) {
    console.error('[check-overdue] Failed to query cards:', cardsErr.message);
    return NextResponse.json({ error: cardsErr.message }, { status: 500 });
  }

  if (!cards || cards.length === 0) {
    return NextResponse.json({ checked: 0, notified: 0 });
  }

  // Filter to actually overdue cards using each board's timezone
  const overdueCards = cards.filter(card => {
    const tz = boardTzMap.get(card.board_id) || fallbackTz;
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const currentTime = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);

    if (card.due_date < todayStr) return true;
    if (card.due_date === todayStr && card.due_time) {
      return card.due_time <= currentTime;
    }
    return false;
  });

  if (overdueCards.length === 0) {
    return NextResponse.json({ checked: cards.length, notified: 0 });
  }

  const cardIds = overdueCards.map(c => c.id);

  // Build candidate (userId, card) pairs
  const candidatePairs: { userId: string; card: (typeof overdueCards)[0] }[] = [];
  for (const card of overdueCards) {
    const assigneeIds = getRecipientIds(card.assignee, card.assignees);
    for (const userId of assigneeIds) {
      candidatePairs.push({ userId, card });
    }
  }

  if (candidatePairs.length === 0) {
    return NextResponse.json({ checked: cards.length, notified: 0 });
  }

  // Dedup per (user_id, card_id) so each user is tracked independently
  const allAssigneeUserIds = [...new Set(candidatePairs.map(p => p.userId))];
  const { data: existingNotifs } = await db
    .from('notifications')
    .select('user_id, card_id')
    .eq('type', 'overdue')
    .in('card_id', cardIds)
    .in('user_id', allAssigneeUserIds);

  const alreadyNotified = new Set((existingNotifs || []).map(n => `${n.user_id}:${n.card_id}`));

  // For each overdue card, notify only assignees
  const notifications: { user_id: string; board_id: string; card_id: string; type: string; title: string; body: string }[] = [];
  const pushTargets: { user_id: string; title: string; body: string; type: string; board_id: string; card_id: string }[] = [];

  for (const { userId, card } of candidatePairs) {
    if (alreadyNotified.has(`${userId}:${card.id}`)) continue;

    const dueDisplay = new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = card.due_time ? ` at ${formatTime12(card.due_time)}` : '';
    const title = `"${card.title}" is overdue`;
    const body = `Due ${dueDisplay}${timeStr}`;

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

  // Batch insert card overdue notifications
  if (notifications.length > 0) {
    const { error: insertErr } = await db.from('notifications').insert(notifications);
    if (insertErr) {
      console.error('[check-overdue] Failed to insert notifications:', insertErr.message);
    }
  }

  // ── Checklist item overdue notifications ────────────────────
  const { data: checklistItems, error: checklistErr } = await db
    .from('card_checklists')
    .select('id, title, due_date, assignees, card_id, board_cards!inner(title, board_id, assignee, assignees, is_archived, is_complete)')
    .eq('is_completed', false)
    .not('due_date', 'is', null)
    .eq('board_cards.is_archived', false)
    .eq('board_cards.is_complete', false);

  if (checklistErr) {
    console.error('[check-overdue] Failed to query checklist items:', checklistErr.message);
  }

  const overdueChecklistItems = (checklistItems || []).filter((item: any) => {
    const bc = item.board_cards;
    const tz = boardTzMap.get(bc.board_id) || fallbackTz;
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    return item.due_date.slice(0, 10) < todayStr;
  });

  const checklistNotifications: { user_id: string; board_id: string; card_id: string; checklist_item_id: string; type: string; title: string; body: string }[] = [];
  const checklistPushTargets: { user_id: string; title: string; body: string; type: string; board_id: string; card_id: string; checklist_item_id: string }[] = [];

  if (overdueChecklistItems.length > 0) {
    // Build candidate (userId, item) pairs
    const checklistCandidatePairs: { userId: string; item: (typeof overdueChecklistItems)[0] }[] = [];
    for (const item of overdueChecklistItems) {
      const bc = item.board_cards as any;
      const itemAssignees: string[] = Array.isArray(item.assignees) && item.assignees.length ? item.assignees : [];
      const assigneeIds = itemAssignees.length
        ? getRecipientIds(null, itemAssignees)
        : getRecipientIds(bc.assignee, bc.assignees);
      for (const userId of assigneeIds) {
        checklistCandidatePairs.push({ userId, item });
      }
    }

    // Dedup per (user_id, checklist_item_id)
    const checklistItemIds = overdueChecklistItems.map((i: any) => i.id);
    const allChecklistUserIds = [...new Set(checklistCandidatePairs.map(p => p.userId))];
    let alreadyNotifiedChecklist = new Set<string>();
    if (allChecklistUserIds.length > 0) {
      const { data: existingChecklistNotifs } = await db
        .from('notifications')
        .select('user_id, checklist_item_id')
        .eq('type', 'checklist_overdue')
        .in('checklist_item_id', checklistItemIds)
        .in('user_id', allChecklistUserIds);
      alreadyNotifiedChecklist = new Set((existingChecklistNotifs || []).map((n: any) => `${n.user_id}:${n.checklist_item_id}`));
    }

    for (const { userId, item } of checklistCandidatePairs) {
      if (alreadyNotifiedChecklist.has(`${userId}:${item.id}`)) continue;

      const bc = item.board_cards as any;
      const dueDisplay = new Date(item.due_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const title = `"${item.title}" checklist item is overdue`;
      const body = `On "${bc.title}" · Due ${dueDisplay}`;

      checklistNotifications.push({
        user_id: userId,
        board_id: bc.board_id,
        card_id: item.card_id,
        checklist_item_id: item.id,
        type: 'checklist_overdue',
        title,
        body,
      });
      checklistPushTargets.push({ user_id: userId, title, body, type: 'checklist_overdue', board_id: bc.board_id, card_id: item.card_id, checklist_item_id: item.id });
    }

    if (checklistNotifications.length > 0) {
      const { error: insertErr } = await db.from('notifications').insert(checklistNotifications);
      if (insertErr) {
        console.error('[check-overdue] Failed to insert checklist notifications:', insertErr.message);
      }
    }
  }

  // Send push notifications (fire-and-forget, don't block response)
  const pushUrl = `${getBaseUrl()}/api/push/send`;
  const pushSecret = process.env.PUSH_WEBHOOK_SECRET;

  const allPushTargets = [...pushTargets, ...checklistPushTargets];
  let emailSent = 0;

  for (const target of allPushTargets) {
    if (pushSecret) {
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

    const sent = await maybeSendNotificationEmail({
      supabaseAdmin: db,
      userId: target.user_id,
      type: target.type as 'overdue' | 'checklist_overdue',
      title: target.title,
      body: target.body,
      boardId: target.board_id,
      cardId: target.card_id,
      checklistItemId: 'checklist_item_id' in target ? (target as { checklist_item_id?: string }).checklist_item_id : undefined,
    });
    if (sent) emailSent += 1;
  }

  return NextResponse.json({
    checked: cards.length,
    notified: notifications.length,
    checklistNotified: checklistNotifications.length,
    pushSent: allPushTargets.length,
    emailSent,
  });
}
