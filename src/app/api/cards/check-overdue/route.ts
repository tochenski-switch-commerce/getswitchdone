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

function getRecipientIds(primary?: string | null, assignees?: string[] | null, watchers?: string[] | null): string[] {
  const ids = new Set<string>();

  if (primary?.trim()) ids.add(primary.trim());
  for (const value of [...(assignees || []), ...(watchers || [])]) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) ids.add(trimmed);
  }

  return [...ids];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function overdueAlreadySent(db: any, userId: string, cardId: string, checklistItemId?: string): Promise<boolean> {
  const notificationType = checklistItemId ? 'checklist_overdue' : 'overdue';

  let query = db
    .from('due_date_notifications_sent')
    .select('id')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .eq('notification_type', notificationType)
    .limit(1);

  query = checklistItemId
    ? query.eq('checklist_item_id', checklistItemId)
    : query.is('checklist_item_id', null);

  const { data } = await query.maybeSingle();
  return !!data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markOverdueSent(db: any, userId: string, cardId: string, checklistItemId?: string): Promise<void> {
  const notificationType = checklistItemId ? 'checklist_overdue' : 'overdue';

  await db.from('due_date_notifications_sent').upsert({
    user_id: userId,
    card_id: cardId,
    checklist_item_id: checklistItemId || null,
    notification_type: notificationType,
  });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET || process.env.PUSH_WEBHOOK_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const fallbackTz = process.env.APP_TIMEZONE || 'America/New_York';
  const now = new Date();

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

  // Batch-fetch watchers for all cards with due dates
  const cardIds = cards.map(c => c.id);
  const { data: watcherRows } = await db
    .from('card_watchers')
    .select('card_id, user_id')
    .in('card_id', cardIds);

  const watchersByCard = new Map<string, string[]>();
  for (const row of watcherRows || []) {
    const list = watchersByCard.get(row.card_id) || [];
    list.push(row.user_id);
    watchersByCard.set(row.card_id, list);
  }

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

  const pushUrl = `${getBaseUrl()}/api/push/send`;
  const pushSecret = process.env.PUSH_WEBHOOK_SECRET;

  let notified = 0;

  // ── Card overdue notifications ──────────────────────────────────────────────
  for (const card of overdueCards) {
    const assigneeIds = getRecipientIds(card.assignee, card.assignees, watchersByCard.get(card.id));

    for (const userId of assigneeIds) {
      const alreadySent = await overdueAlreadySent(db, userId, card.id);
      if (alreadySent) continue;

      const dueDisplay = new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeStr = card.due_time ? ` at ${formatTime12(card.due_time)}` : '';
      const title = `"${card.title}" is overdue`;
      const body = `Due ${dueDisplay}${timeStr}`;

      // Inbox notification (best-effort — dedup is handled by due_date_notifications_sent)
      await db.from('notifications').insert({
        user_id: userId,
        board_id: card.board_id,
        card_id: card.id,
        type: 'overdue',
        title,
        body,
      });

      // Push
      if (pushSecret) {
        try {
          await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-push-secret': pushSecret },
            body: JSON.stringify({ user_id: userId, title, body, type: 'overdue', board_id: card.board_id, card_id: card.id }),
          });
        } catch (err) {
          console.error('[check-overdue] Push failed for', userId, err);
        }
      }

      // Email
      await maybeSendNotificationEmail({
        supabaseAdmin: db,
        userId,
        type: 'overdue',
        title,
        body,
        boardId: card.board_id,
        cardId: card.id,
      });

      // Mark sent — this is the authoritative dedup record
      await markOverdueSent(db, userId, card.id);
      notified += 1;
    }
  }

  // ── Checklist item overdue notifications ────────────────────────────────────
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

  let checklistNotified = 0;

  for (const item of overdueChecklistItems) {
    const bc = item.board_cards as any;
    const itemAssignees: string[] = Array.isArray(item.assignees) && item.assignees.length ? item.assignees : [];
    const cardWatchers = watchersByCard.get(item.card_id);
    const assigneeIds = itemAssignees.length
      ? getRecipientIds(null, itemAssignees, cardWatchers)
      : getRecipientIds(bc.assignee, bc.assignees, cardWatchers);

    for (const userId of assigneeIds) {
      const alreadySent = await overdueAlreadySent(db, userId, item.card_id, item.id);
      if (alreadySent) continue;

      const dueDisplay = new Date(item.due_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const title = `"${item.title}" checklist item is overdue`;
      const body = `On "${bc.title}" · Due ${dueDisplay}`;

      // Inbox notification (best-effort)
      await db.from('notifications').insert({
        user_id: userId,
        board_id: bc.board_id,
        card_id: item.card_id,
        checklist_item_id: item.id,
        type: 'checklist_overdue',
        title,
        body,
      });

      // Push
      if (pushSecret) {
        try {
          await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-push-secret': pushSecret },
            body: JSON.stringify({ user_id: userId, title, body, type: 'checklist_overdue', board_id: bc.board_id, card_id: item.card_id }),
          });
        } catch (err) {
          console.error('[check-overdue] Push failed for', userId, err);
        }
      }

      // Email
      await maybeSendNotificationEmail({
        supabaseAdmin: db,
        userId,
        type: 'checklist_overdue',
        title,
        body,
        boardId: bc.board_id,
        cardId: item.card_id,
        checklistItemId: item.id,
      });

      // Mark sent — authoritative dedup record
      await markOverdueSent(db, userId, item.card_id, item.id);
      checklistNotified += 1;
    }
  }

  return NextResponse.json({
    checked: cards.length,
    notified,
    checklistNotified,
  });
}
