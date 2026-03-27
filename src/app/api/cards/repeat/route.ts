import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function addUnits(date: Date, every: number, unit: string): Date {
  const d = new Date(date);
  if (unit === 'days') d.setDate(d.getDate() + every);
  else if (unit === 'weeks') d.setDate(d.getDate() + every * 7);
  else if (unit === 'months') d.setMonth(d.getMonth() + every);
  return d;
}

/** Get the Nth weekday (0=Sun..6=Sat) of a given month. Returns null if it doesn't exist. */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date | null {
  const first = new Date(year, month, 1);
  let dow = first.getDay();
  let day = 1 + ((weekday - dow + 7) % 7);
  day += (nth - 1) * 7;
  if (day > new Date(year, month + 1, 0).getDate()) return null;
  return new Date(year, month, day);
}

/** Check if today is a repeat day for the monthly-weekday mode. */
function isMonthlyWeekdayDueToday(nth: number, weekday: number): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = getNthWeekdayOfMonth(now.getFullYear(), now.getMonth(), weekday, nth);
  return target !== null && target.getTime() === now.getTime();
}

/** Check if today is a repeat day, anchored to start_date (interval mode). */
function isRepeatDueToday(startDate: string, every: number, unit: string): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const anchor = new Date(startDate + 'T00:00:00');

  // First occurrence is one interval after the anchor (not the anchor itself)
  let cursor = addUnits(new Date(anchor), every, unit);
  // Step forward until we reach or pass today
  while (cursor < now) {
    cursor = addUnits(cursor, every, unit);
  }
  // Check if cursor is exactly today
  return cursor.getTime() === now.getTime();
}

/**
 * GET /api/cards/repeat
 * Cron endpoint — finds cards with an active repeat_rule whose schedule
 * hits today (anchored to each card's start_date), then duplicates them.
 *
 * Only duplicates the LATEST card in each repeat_series_id.
 *
 * Protect with a secret header in production:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch all non-archived cards with an active repeat_rule
  const { data: repeatCards, error } = await supabase
    .from('board_cards')
    .select('*')
    .not('repeat_rule', 'is', null)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!repeatCards || repeatCards.length === 0) {
    return NextResponse.json({ message: 'No repeating cards found', created: 0 });
  }

  // 2. Group by repeat_series_id, pick the latest card per series
  const seriesMap = new Map<string, typeof repeatCards[0]>();
  for (const card of repeatCards) {
    const sid = card.repeat_series_id;
    if (!sid) continue;
    if (!seriesMap.has(sid)) {
      seriesMap.set(sid, card);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const cardsToRepeat: typeof repeatCards = [];

  for (const card of seriesMap.values()) {
    const rule = card.repeat_rule as { mode?: string; every: number; unit: string; nth?: number; weekday?: number; endDate?: string };
    if (!rule) continue;

    // Check end date
    if (rule.endDate && todayStr > rule.endDate) continue;

    if (rule.mode === 'monthly-weekday') {
      if (rule.nth != null && rule.weekday != null && isMonthlyWeekdayDueToday(rule.nth, rule.weekday)) {
        cardsToRepeat.push(card);
      }
    } else {
      // Interval mode (default)
      if (!rule.every || !rule.unit) continue;
      if (!card.start_date) continue;
      if (isRepeatDueToday(card.start_date, rule.every, rule.unit)) {
        cardsToRepeat.push(card);
      }
    }
  }

  if (cardsToRepeat.length === 0) {
    return NextResponse.json({ message: 'No cards match today\'s schedule', created: 0 });
  }

  // 3. Batch-fetch max positions for all unique column_ids and all label assignments up front
  const uniqueColumnIds = [...new Set(cardsToRepeat.map(c => c.column_id))];
  const sourceCardIds = cardsToRepeat.map(c => c.id);

  const [posResults, labelsResults] = await Promise.all([
    supabase
      .from('board_cards')
      .select('column_id, position')
      .in('column_id', uniqueColumnIds)
      .eq('is_archived', false)
      .order('position', { ascending: false }),
    supabase
      .from('card_label_assignments')
      .select('card_id, label_id')
      .in('card_id', sourceCardIds),
  ]);

  // Max position per column_id (track in-flight inserts so same-column cards don't collide)
  const maxPosMap = new Map<string, number>();
  for (const row of posResults.data || []) {
    if (!maxPosMap.has(row.column_id)) {
      maxPosMap.set(row.column_id, row.position);
    }
  }
  // Labels per source card_id
  const labelsMap = new Map<string, string[]>();
  for (const row of labelsResults.data || []) {
    if (!labelsMap.has(row.card_id)) labelsMap.set(row.card_id, []);
    labelsMap.get(row.card_id)!.push(row.label_id);
  }

  // 4. Duplicate each matching card
  let created = 0;
  const errors: string[] = [];

  for (const card of cardsToRepeat) {
    const currentMax = maxPosMap.get(card.column_id) ?? 0;
    const nextPos = currentMax + 1;
    maxPosMap.set(card.column_id, nextPos); // bump for any subsequent card in same column

    // Compute new due_date: preserve the offset between start_date and due_date
    let newDueDate: string | null = null;
    if (card.due_date && card.start_date) {
      const startMs = new Date(card.start_date + 'T00:00:00').getTime();
      const dueMs = new Date(card.due_date + 'T00:00:00').getTime();
      const offsetDays = Math.round((dueMs - startMs) / 86400000);
      const newDue = new Date(todayStr + 'T00:00:00');
      newDue.setDate(newDue.getDate() + offsetDays);
      newDueDate = newDue.toISOString().slice(0, 10);
    } else if (card.due_date && !card.start_date) {
      // No start_date to anchor offset — set due_date to today
      newDueDate = todayStr;
    }

    const newCard = {
      board_id: card.board_id,
      column_id: card.column_id,
      title: card.title,
      description: card.description || null,
      priority: card.priority || null,
      assignee: card.assignee || null,
      assignees: card.assignees || null,
      start_date: todayStr,
      due_date: newDueDate,
      due_time: card.due_time || null,
      position: nextPos,
      repeat_rule: card.repeat_rule,
      repeat_series_id: card.repeat_series_id,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('board_cards')
      .insert([newCard])
      .select('id')
      .single();

    if (insertErr) {
      errors.push(`${card.id}: ${insertErr.message}`);
    } else {
      created++;
      // Copy label assignments using pre-fetched data
      const labelIds = labelsMap.get(card.id);
      if (inserted && labelIds && labelIds.length > 0) {
        await supabase
          .from('card_label_assignments')
          .insert(labelIds.map(label_id => ({ card_id: inserted.id, label_id })));
      }
    }
  }

  return NextResponse.json({
    message: `Created ${created} card(s)`,
    created,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
