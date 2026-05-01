import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

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
 * Cron endpoint — finds active repeat series whose schedule hits today,
 * then duplicates the latest non-archived card in each series.
 *
 * Protect with a secret header in production:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  if (!supabaseServiceKey) {
    console.error('[cards/repeat] SUPABASE_SERVICE_ROLE_KEY is not configured');
    return NextResponse.json({ error: 'Server misconfiguration: missing service role key' }, { status: 500 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch all active repeat series
  const { data: activeSeries, error: seriesError } = await supabase
    .from('repeat_series')
    .select('id, board_id, repeat_rule')
    .eq('is_active', true);

  if (seriesError) {
    return NextResponse.json({ error: seriesError.message }, { status: 500 });
  }

  if (!activeSeries || activeSeries.length === 0) {
    return NextResponse.json({ message: 'No active repeat series found', created: 0 });
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // 2. Filter to series whose schedule hits today
  type RepeatRule = { mode?: string; every: number; unit: string; nth?: number; weekday?: number; endDate?: string };
  const dueSeries = activeSeries.filter(series => {
    const rule = series.repeat_rule as RepeatRule;
    if (!rule) return false;
    if (rule.endDate && todayStr > rule.endDate) return false;

    if (rule.mode === 'monthly-weekday') {
      return rule.nth != null && rule.weekday != null && isMonthlyWeekdayDueToday(rule.nth, rule.weekday);
    }
    // Interval mode — needs a card with a start_date (checked below)
    return !!(rule.every && rule.unit);
  });

  if (dueSeries.length === 0) {
    return NextResponse.json({ message: "No series match today's schedule", created: 0 });
  }

  // 3. For each due series, find the latest non-archived card
  const seriesIds = dueSeries.map(s => s.id);
  const { data: cards, error: cardsError } = await supabase
    .from('board_cards')
    .select('*')
    .in('repeat_series_id', seriesIds)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
  }

  // Latest card per series
  const latestCardBySeries = new Map<string, typeof cards[0]>();
  for (const card of cards || []) {
    if (card.repeat_series_id && !latestCardBySeries.has(card.repeat_series_id)) {
      latestCardBySeries.set(card.repeat_series_id, card);
    }
  }

  // Filter interval-mode series that have a card with a start_date
  const cardsToRepeat: Array<{ card: typeof cards[0]; rule: RepeatRule }> = [];
  for (const series of dueSeries) {
    const rule = series.repeat_rule as RepeatRule;
    const card = latestCardBySeries.get(series.id);
    if (!card) continue;

    if (rule.mode === 'monthly-weekday') {
      cardsToRepeat.push({ card, rule });
    } else {
      if (!card.start_date) continue;
      if (isRepeatDueToday(card.start_date, rule.every, rule.unit)) {
        cardsToRepeat.push({ card, rule });
      }
    }
  }

  if (cardsToRepeat.length === 0) {
    return NextResponse.json({ message: "No cards match today's schedule", created: 0 });
  }

  // 4. Batch-fetch max positions and label assignments
  const uniqueColumnIds = [...new Set(cardsToRepeat.map(({ card }) => card.column_id))];
  const sourceCardIds = cardsToRepeat.map(({ card }) => card.id);

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

  // Max position per column_id
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

  // 5. Duplicate each matching card
  let created = 0;
  const errors: string[] = [];

  for (const { card, rule } of cardsToRepeat) {
    const currentMax = maxPosMap.get(card.column_id) ?? 0;
    const nextPos = currentMax + 1;
    maxPosMap.set(card.column_id, nextPos);

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
      repeat_rule: rule,
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
