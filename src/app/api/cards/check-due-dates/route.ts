import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type BoardTimezoneRow = {
  id: string;
  timezone: string | null;
};

type CardReminderRow = {
  id: string;
  board_id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  assignee: string | null;
  assignees: string[] | null;
};

type ChecklistAssigneeRow = {
  card_id: string;
  assignees: string[] | null;
};

type ChecklistReminderCardRow = {
  title: string;
  board_id: string;
  assignee: string | null;
  assignees: string[] | null;
  is_archived: boolean;
  is_complete: boolean;
};

type ChecklistReminderRow = {
  id: string;
  title: string;
  due_date: string | null;
  assignees: string[] | null;
  card_id: string;
  board_cards: ChecklistReminderCardRow | ChecklistReminderCardRow[];
};

type ReminderTarget = {
  userId: string;
  boardId: string;
  cardId: string;
  checklistItemId?: string;
  notificationType: string;
  triggerType: 'due_soon' | 'due_now';
  cardTitle: string;
  title: string;
  body: string;
};

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.URL) return process.env.URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function getDateFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getTimeFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getDateInTimezone(date: Date, timeZone: string): string {
  return getDateFormatter(timeZone).format(date);
}

function getMinutesInTimezone(date: Date, timeZone: string): number {
  const formatted = getTimeFormatter(timeZone).format(date);
  const [hours, minutes] = formatted.split(':').map(Number);
  return (hours * 60) + minutes;
}

function addDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function extractLocalDate(value: string | null, timeZone: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10) || null;
  return getDateInTimezone(parsed, timeZone);
}

function extractLocalMinutes(value: string | null, timeZone: string): number | null {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return getMinutesInTimezone(parsed, timeZone);
}

function parseDueTimeMinutes(dueTime: string | null): number | null {
  if (!dueTime) return null;
  const [hours, minutes] = dueTime.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function isWithinDueWindow(currentMinutes: number, dueMinutes: number): boolean {
  return currentMinutes >= dueMinutes && currentMinutes < (dueMinutes + 60);
}

function uniqueAssigneeIds(...groups: Array<Array<string | null | undefined> | null | undefined>): string[] {
  const ids = new Set<string>();

  for (const group of groups) {
    for (const value of group || []) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed) ids.add(trimmed);
    }
  }

  return [...ids];
}

async function reminderAlreadySent(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
  userId: string;
  cardId: string;
  notificationType: string;
  checklistItemId?: string;
}): Promise<boolean> {
  const { supabaseAdmin, userId, cardId, notificationType, checklistItemId } = args;

  let query = supabaseAdmin
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

async function markReminderSent(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
  userId: string;
  cardId: string;
  notificationType: string;
  checklistItemId?: string;
}) {
  const { supabaseAdmin, userId, cardId, notificationType, checklistItemId } = args;

  await supabaseAdmin
    .from('due_date_notifications_sent')
    .upsert({
      user_id: userId,
      card_id: cardId,
      checklist_item_id: checklistItemId || null,
      notification_type: notificationType,
    });
}

async function sendReminder(args: {
  target: ReminderTarget;
  baseUrl: string;
  pushSecret: string;
}): Promise<boolean> {
  const { target, baseUrl, pushSecret } = args;

  const response = await fetch(`${baseUrl}/api/push/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-push-secret': pushSecret,
    },
    body: JSON.stringify({
      type: target.triggerType,
      user_id: target.userId,
      board_id: target.boardId,
      card_id: target.cardId,
      checklist_item_id: target.checklistItemId,
      card_title: target.cardTitle,
      title: target.title,
      body: target.body,
      message: target.body,
    }),
  });

  return response.ok;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET || process.env.PUSH_WEBHOOK_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pushSecret = process.env.PUSH_WEBHOOK_SECRET;
  if (!pushSecret) {
    return NextResponse.json({ error: 'Missing PUSH_WEBHOOK_SECRET' }, { status: 500 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const fallbackTimeZone = process.env.APP_TIMEZONE || 'America/New_York';
  const now = new Date();

  try {
    const [{ data: boards, error: boardsError }, { data: cards, error: cardsError }, { data: checklistAssignees, error: checklistAssigneeError }, { data: checklistItems, error: checklistError }] = await Promise.all([
      supabaseAdmin
        .from('project_boards')
        .select('id, timezone')
        .eq('is_archived', false),
      supabaseAdmin
        .from('board_cards')
        .select('id, board_id, title, due_date, due_time, assignee, assignees')
        .eq('is_archived', false)
        .eq('is_complete', false)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true }),
      supabaseAdmin
        .from('card_checklists')
        .select('card_id, assignees')
        .eq('is_completed', false),
      supabaseAdmin
        .from('card_checklists')
        .select('id, title, due_date, assignees, card_id, board_cards!inner(title, board_id, assignee, assignees, is_archived, is_complete)')
        .eq('is_completed', false)
        .not('due_date', 'is', null)
        .eq('board_cards.is_archived', false)
        .eq('board_cards.is_complete', false),
    ]);

    if (boardsError) {
      console.error('[check-due-dates] Failed to fetch boards:', boardsError.message);
      return NextResponse.json({ error: boardsError.message }, { status: 500 });
    }

    if (cardsError) {
      console.error('[check-due-dates] Failed to fetch cards:', cardsError.message);
      return NextResponse.json({ error: cardsError.message }, { status: 500 });
    }

    if (checklistAssigneeError) {
      console.error('[check-due-dates] Failed to fetch checklist assignees:', checklistAssigneeError.message);
      return NextResponse.json({ error: checklistAssigneeError.message }, { status: 500 });
    }

    if (checklistError) {
      console.error('[check-due-dates] Failed to fetch checklist due dates:', checklistError.message);
      return NextResponse.json({ error: checklistError.message }, { status: 500 });
    }

    const boardTimezones = new Map<string, string>();
    for (const board of (boards || []) as BoardTimezoneRow[]) {
      boardTimezones.set(board.id, board.timezone || fallbackTimeZone);
    }

    const checklistAssigneesByCard = new Map<string, Set<string>>();
    for (const row of (checklistAssignees || []) as ChecklistAssigneeRow[]) {
      const ids = uniqueAssigneeIds(row.assignees || []);
      if (!ids.length) continue;

      const current = checklistAssigneesByCard.get(row.card_id) || new Set<string>();
      for (const id of ids) current.add(id);
      checklistAssigneesByCard.set(row.card_id, current);
    }

    const reminderTargets: ReminderTarget[] = [];

    for (const card of (cards || []) as CardReminderRow[]) {
      const timeZone = boardTimezones.get(card.board_id) || fallbackTimeZone;
      const today = getDateInTimezone(now, timeZone);
      const tomorrow = addDays(today, 1);
      const currentMinutes = getMinutesInTimezone(now, timeZone);
      const recipientIds = uniqueAssigneeIds(
        [card.assignee],
        card.assignees || [],
        checklistAssigneesByCard.get(card.id) ? [...checklistAssigneesByCard.get(card.id)!] : []
      );

      if (!recipientIds.length || !card.due_date) continue;

      const dueDate = extractLocalDate(card.due_date, timeZone);
      const dueMinutes = parseDueTimeMinutes(card.due_time);

      if (dueDate === tomorrow) {
        for (const userId of recipientIds) {
          reminderTargets.push({
            userId,
            boardId: card.board_id,
            cardId: card.id,
            notificationType: 'due_soon_1day',
            triggerType: 'due_soon',
            cardTitle: card.title,
            title: `"${card.title}" is due tomorrow`,
            body: `${card.title} is due tomorrow.`,
          });
        }
      }

      if (dueDate === today && dueMinutes !== null && isWithinDueWindow(currentMinutes, dueMinutes)) {
        for (const userId of recipientIds) {
          reminderTargets.push({
            userId,
            boardId: card.board_id,
            cardId: card.id,
            notificationType: 'due_now',
            triggerType: 'due_now',
            cardTitle: card.title,
            title: `"${card.title}" is due now`,
            body: `${card.title} is due now.`,
          });
        }
      }
    }

    for (const item of (checklistItems || []) as ChecklistReminderRow[]) {
      const card = (Array.isArray(item.board_cards) ? item.board_cards[0] : item.board_cards) as ChecklistReminderCardRow | undefined;
      if (!card) continue;

      const timeZone = boardTimezones.get(card.board_id) || fallbackTimeZone;
      const today = getDateInTimezone(now, timeZone);
      const tomorrow = addDays(today, 1);
      const currentMinutes = getMinutesInTimezone(now, timeZone);
      const recipientIds = uniqueAssigneeIds(
        (item.assignees && item.assignees.length > 0) ? item.assignees : [],
        (!item.assignees || item.assignees.length === 0) ? [card.assignee] : [],
        (!item.assignees || item.assignees.length === 0) ? (card.assignees || []) : []
      );

      if (!recipientIds.length || !item.due_date) continue;

      const dueDate = extractLocalDate(item.due_date, timeZone);
      const dueMinutes = extractLocalMinutes(item.due_date, timeZone);

      if (dueDate === tomorrow) {
        for (const userId of recipientIds) {
          reminderTargets.push({
            userId,
            boardId: card.board_id,
            cardId: item.card_id,
            checklistItemId: item.id,
            notificationType: 'checklist_due_soon_1day',
            triggerType: 'due_soon',
            cardTitle: card.title,
            title: `"${item.title}" is due tomorrow`,
            body: `Checklist item on ${card.title} is due tomorrow.`,
          });
        }
      }

      if (dueDate === today && dueMinutes !== null && isWithinDueWindow(currentMinutes, dueMinutes)) {
        for (const userId of recipientIds) {
          reminderTargets.push({
            userId,
            boardId: card.board_id,
            cardId: item.card_id,
            checklistItemId: item.id,
            notificationType: 'checklist_due_now',
            triggerType: 'due_now',
            cardTitle: card.title,
            title: `"${item.title}" is due now`,
            body: `Checklist item on ${card.title} is due now.`,
          });
        }
      }
    }

    const baseUrl = getBaseUrl();
    let notificationsSent = 0;

    for (const target of reminderTargets) {
      const alreadySent = await reminderAlreadySent({
        supabaseAdmin,
        userId: target.userId,
        cardId: target.cardId,
        checklistItemId: target.checklistItemId,
        notificationType: target.notificationType,
      });

      if (alreadySent) continue;

      const sent = await sendReminder({ target, baseUrl, pushSecret });
      if (!sent) continue;

      await markReminderSent({
        supabaseAdmin,
        userId: target.userId,
        cardId: target.cardId,
        checklistItemId: target.checklistItemId,
        notificationType: target.notificationType,
      });
      notificationsSent += 1;
    }

    return NextResponse.json({
      success: true,
      cardsChecked: cards?.length || 0,
      checklistItemsChecked: checklistItems?.length || 0,
      notificationsSent,
    });
  } catch (error) {
    console.error('[check-due-dates] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
