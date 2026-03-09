import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * GET /api/cards/repeat
 * Cron endpoint — finds cards with an active repeat_rule whose schedule
 * matches today, and creates a duplicate card for each.
 *
 * Only duplicates the LATEST card in each repeat_series_id so that the
 * series progresses forward without creating exponential copies.
 *
 * Protect with a secret header in production:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  // Optional cron secret check
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
      seriesMap.set(sid, card); // Already ordered by created_at desc
    }
  }

  // 3. Check which cards match today's schedule
  const now = new Date();
  const todayDow = now.getDay();           // 0-6
  const todayDom = now.getDate();           // 1-31
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const cardsToRepeat: typeof repeatCards = [];

  for (const card of seriesMap.values()) {
    const rule = card.repeat_rule as { interval: string; days: number[]; endDate?: string };
    if (!rule?.interval) continue;

    // Check end date
    if (rule.endDate && todayStr > rule.endDate) continue;

    let matches = false;
    if (rule.interval === 'daily') {
      matches = true;
    } else if (rule.interval === 'weekly') {
      matches = (rule.days || []).includes(todayDow);
    } else if (rule.interval === 'monthly') {
      matches = (rule.days || []).includes(todayDom);
    }

    if (matches) cardsToRepeat.push(card);
  }

  if (cardsToRepeat.length === 0) {
    return NextResponse.json({ message: 'No cards match today\'s schedule', created: 0 });
  }

  // 4. Duplicate each matching card
  let created = 0;
  const errors: string[] = [];

  for (const card of cardsToRepeat) {
    // Get max position in the column
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
      position: nextPos,
      repeat_rule: card.repeat_rule,
      repeat_series_id: card.repeat_series_id,
    };

    const { error: insertErr } = await supabase
      .from('board_cards')
      .insert([newCard]);

    if (insertErr) {
      errors.push(`${card.id}: ${insertErr.message}`);
    } else {
      created++;
      // Copy label assignments
      const { data: labels } = await supabase
        .from('card_label_assignments')
        .select('label_id')
        .eq('card_id', card.id);
      if (labels && labels.length > 0) {
        const { data: inserted } = await supabase
          .from('board_cards')
          .select('id')
          .eq('board_id', card.board_id)
          .eq('column_id', card.column_id)
          .eq('position', nextPos)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (inserted) {
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
