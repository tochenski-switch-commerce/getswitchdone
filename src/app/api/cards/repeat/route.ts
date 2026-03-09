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

/** Check if today is a repeat day, anchored to start_date. */
function isRepeatDueToday(startDate: string, every: number, unit: string): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const anchor = new Date(startDate + 'T00:00:00');

  let cursor = new Date(anchor);
  // Step forward from anchor until we reach or pass today
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
    const rule = card.repeat_rule as { every: number; unit: string; endDate?: string };
    if (!rule?.every || !rule?.unit) continue;
    if (!card.start_date) continue;

    // Check end date
    if (rule.endDate && todayStr > rule.endDate) continue;

    if (isRepeatDueToday(card.start_date, rule.every, rule.unit)) {
      cardsToRepeat.push(card);
    }
  }

  if (cardsToRepeat.length === 0) {
    return NextResponse.json({ message: 'No cards match today\'s schedule', created: 0 });
  }

  // 3. Duplicate each matching card
  let created = 0;
  const errors: string[] = [];

  for (const card of cardsToRepeat) {
    const { data: posData } = await supabase
      .from('board_cards')
      .select('position')
      .eq('column_id', card.column_id)
      .eq('is_archived', false)
      .order('position', { ascending: false })
      .limit(1)
      .single();
    const nextPos = (posData?.position ?? 0) + 1;

    const newCard = {
      board_id: card.board_id,
      column_id: card.column_id,
      title: card.title,
      description: card.description || null,
      priority: card.priority || null,
      assignee: card.assignee || null,
      start_date: todayStr,
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
      // Copy label assignments
      if (inserted) {
        const { data: labels } = await supabase
          .from('card_label_assignments')
          .select('label_id')
          .eq('card_id', card.id);
        if (labels && labels.length > 0) {
          await supabase
            .from('card_label_assignments')
            .insert(labels.map(l => ({ card_id: inserted.id, label_id: l.label_id })));
        }
      }
    }
  }

  return NextResponse.json({
    message: `Created ${created} card(s)`,
    created,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
