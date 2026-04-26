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

const SEND_CONCURRENCY = 4;

async function runInBatches<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += SEND_CONCURRENCY) {
    await Promise.allSettled(items.slice(i, i + SEND_CONCURRENCY).map(fn));
  }
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

  // Fetch boards, cards, and checklist items in parallel
  const [boardsRes, cardsRes, checklistItemsRes] = await Promise.all([
    db.from('project_boards').select('id, timezone').eq('is_archived', false),
    db.from('board_cards')
      .select('id, title, due_date, due_time, board_id, assignee, assignees')
      .eq('is_archived', false)
      .eq('is_complete', false)
      .not('due_date', 'is', null),
    db.from('card_checklists')
      .select('id, title, due_date, assignees, card_id, board_cards!inner(title, board_id, assignee, assignees, is_archived, is_complete)')
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .eq('board_cards.is_archived', false)
      .eq('board_cards.is_complete', false),
  ]);

  if (boardsRes.error) {
    console.error('[check-overdue] Failed to query boards:', boardsRes.error.message);
    return NextResponse.json({ error: boardsRes.error.message }, { status: 500 });
  }
  if (cardsRes.error) {
    console.error('[check-overdue] Failed to query cards:', cardsRes.error.message);
    return NextResponse.json({ error: cardsRes.error.message }, { status: 500 });
  }

  const boardTzMap = new Map<string, string>();
  for (const b of boardsRes.data || []) {
    boardTzMap.set(b.id, b.timezone || fallbackTz);
  }

  const cards = cardsRes.data ?? [];

  // Batch-fetch watchers for all cards with due dates
  const cardIds = cards.map(c => c.id);
  const { data: watcherRows } = cardIds.length > 0
    ? await db.from('card_watchers').select('card_id, user_id').in('card_id', cardIds)
    : { data: [] };

  const watchersByCard = new Map<string, string[]>();
  for (const row of watcherRows || []) {
    const list = watchersByCard.get(row.card_id) || [];
    list.push(row.user_id);
    watchersByCard.set(row.card_id, list);
  }

  const pushUrl = `${getBaseUrl()}/api/push/send`;
  const pushSecret = process.env.PUSH_WEBHOOK_SECRET;

  // ── Card overdue notifications ──────────────────────────────────────────────

  const overdueCards = cards.filter(card => {
    const tz = boardTzMap.get(card.board_id) || fallbackTz;
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const currentTime = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    if (card.due_date < todayStr) return true;
    if (card.due_date === todayStr && card.due_time) return card.due_time <= currentTime;
    return false;
  });

  type CardPair = { userId: string; card: typeof overdueCards[0] };
  const cardPairs: CardPair[] = [];
  for (const card of overdueCards) {
    for (const userId of getRecipientIds(card.assignee, card.assignees, watchersByCard.get(card.id))) {
      cardPairs.push({ userId, card });
    }
  }

  let notified = 0;

  if (cardPairs.length > 0) {
    const uniqueUserIds = [...new Set(cardPairs.map(p => p.userId))];
    const uniqueCardIds = [...new Set(cardPairs.map(p => p.card.id))];

    const { data: sentRows } = await db
      .from('due_date_notifications_sent')
      .select('user_id, card_id')
      .in('user_id', uniqueUserIds)
      .in('card_id', uniqueCardIds)
      .eq('notification_type', 'overdue')
      .is('checklist_item_id', null);

    const sentSet = new Set((sentRows ?? []).map(r => `${r.user_id}:${r.card_id}`));
    const newPairs = cardPairs.filter(p => !sentSet.has(`${p.userId}:${p.card.id}`));

    if (newPairs.length > 0) {
      // Mark sent FIRST to prevent duplicate sends if we time out mid-loop
      await db.from('due_date_notifications_sent').upsert(
        newPairs.map(({ userId, card }) => ({
          user_id: userId,
          card_id: card.id,
          checklist_item_id: null,
          notification_type: 'overdue',
        }))
      );

      // Bulk insert inbox notifications
      await db.from('notifications').insert(
        newPairs.map(({ userId, card }) => {
          const dueDisplay = new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const timeStr = card.due_time ? ` at ${formatTime12(card.due_time)}` : '';
          return {
            user_id: userId,
            board_id: card.board_id,
            card_id: card.id,
            type: 'overdue',
            title: `"${card.title}" is overdue`,
            body: `Due ${dueDisplay}${timeStr}`,
          };
        })
      );

      // Send push + email in parallel batches
      await runInBatches(newPairs, async ({ userId, card }) => {
        const dueDisplay = new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = card.due_time ? ` at ${formatTime12(card.due_time)}` : '';
        const title = `"${card.title}" is overdue`;
        const body = `Due ${dueDisplay}${timeStr}`;

        await Promise.allSettled([
          pushSecret
            ? fetch(pushUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-push-secret': pushSecret },
                body: JSON.stringify({ user_id: userId, title, body, type: 'overdue', board_id: card.board_id, card_id: card.id }),
              }).catch(err => console.error('[check-overdue] Push failed for', userId, err))
            : Promise.resolve(),
          maybeSendNotificationEmail({
            supabaseAdmin: db,
            userId,
            type: 'overdue',
            title,
            body,
            boardId: card.board_id,
            cardId: card.id,
          }),
        ]);
      });

      notified = newPairs.length;
    }
  }

  // ── Checklist item overdue notifications ────────────────────────────────────

  if (checklistItemsRes.error) {
    console.error('[check-overdue] Failed to query checklist items:', checklistItemsRes.error.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overdueChecklistItems = (checklistItemsRes.data || []).filter((item: any) => {
    const bc = item.board_cards;
    const tz = boardTzMap.get(bc.board_id) || fallbackTz;
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    return item.due_date.slice(0, 10) < todayStr;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ChecklistPair = { userId: string; item: any };
  const checklistPairs: ChecklistPair[] = [];

  for (const item of overdueChecklistItems) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bc = item.board_cards as any;
    const itemAssignees: string[] = Array.isArray(item.assignees) && item.assignees.length ? item.assignees : [];
    const cardWatchers = watchersByCard.get(item.card_id);
    const assigneeIds = itemAssignees.length
      ? getRecipientIds(null, itemAssignees, cardWatchers)
      : getRecipientIds(bc.assignee, bc.assignees, cardWatchers);
    for (const userId of assigneeIds) {
      checklistPairs.push({ userId, item });
    }
  }

  let checklistNotified = 0;

  if (checklistPairs.length > 0) {
    const uniqueUserIds = [...new Set(checklistPairs.map(p => p.userId))];
    const uniqueChecklistIds = [...new Set(checklistPairs.map(p => p.item.id))];

    const { data: checklistSentRows } = await db
      .from('due_date_notifications_sent')
      .select('user_id, checklist_item_id')
      .in('user_id', uniqueUserIds)
      .in('checklist_item_id', uniqueChecklistIds)
      .eq('notification_type', 'checklist_overdue');

    const checklistSentSet = new Set((checklistSentRows ?? []).map(r => `${r.user_id}:${r.checklist_item_id}`));
    const newChecklistPairs = checklistPairs.filter(p => !checklistSentSet.has(`${p.userId}:${p.item.id}`));

    if (newChecklistPairs.length > 0) {
      // Mark sent FIRST
      await db.from('due_date_notifications_sent').upsert(
        newChecklistPairs.map(({ userId, item }) => ({
          user_id: userId,
          card_id: item.card_id,
          checklist_item_id: item.id,
          notification_type: 'checklist_overdue',
        }))
      );

      // Bulk insert inbox notifications
      await db.from('notifications').insert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newChecklistPairs.map(({ userId, item }: { userId: string; item: any }) => {
          const bc = item.board_cards;
          const dueDisplay = new Date(item.due_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return {
            user_id: userId,
            board_id: bc.board_id,
            card_id: item.card_id,
            checklist_item_id: item.id,
            type: 'checklist_overdue',
            title: `"${item.title}" checklist item is overdue`,
            body: `On "${bc.title}" · Due ${dueDisplay}`,
          };
        })
      );

      // Send push + email in parallel batches
      await runInBatches(newChecklistPairs, async ({ userId, item }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bc = item.board_cards as any;
        const dueDisplay = new Date(item.due_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const title = `"${item.title}" checklist item is overdue`;
        const body = `On "${bc.title}" · Due ${dueDisplay}`;

        await Promise.allSettled([
          pushSecret
            ? fetch(pushUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-push-secret': pushSecret },
                body: JSON.stringify({ user_id: userId, title, body, type: 'checklist_overdue', board_id: bc.board_id, card_id: item.card_id }),
              }).catch(err => console.error('[check-overdue] Push failed for', userId, err))
            : Promise.resolve(),
          maybeSendNotificationEmail({
            supabaseAdmin: db,
            userId,
            type: 'checklist_overdue',
            title,
            body,
            boardId: bc.board_id,
            cardId: item.card_id,
            checklistItemId: item.id,
          }),
        ]);
      });

      checklistNotified = newChecklistPairs.length;
    }
  }

  return NextResponse.json({ checked: cards.length, notified, checklistNotified });
}
