import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/cards/repeat
 *
 * Cron-callable endpoint that duplicates cards with an active repeat_schedule.
 * Checks each repeating card's created_at to decide if it's time to duplicate:
 *   - daily:   last copy created ≥ 1 day ago
 *   - weekly:  last copy created ≥ 7 days ago
 *   - monthly: last copy created ≥ 28 days ago
 *
 * Secure with CRON_SECRET header in production.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch all non-archived cards with an active repeat schedule
    const { data: repeatingCards, error: fetchErr } = await supabase
      .from('board_cards')
      .select('*')
      .not('repeat_schedule', 'is', null)
      .eq('is_archived', false);

    if (fetchErr) throw fetchErr;
    if (!repeatingCards || repeatingCards.length === 0) {
      return NextResponse.json({ message: 'No repeating cards found', created: 0 });
    }

    // Group cards by repeat_series_id — only duplicate the most recent in each series
    const seriesMap = new Map<string, typeof repeatingCards[0]>();
    for (const card of repeatingCards) {
      const seriesId = card.repeat_series_id || card.id;
      const existing = seriesMap.get(seriesId);
      if (!existing || new Date(card.created_at) > new Date(existing.created_at)) {
        seriesMap.set(seriesId, card);
      }
    }

    const now = new Date();
    let createdCount = 0;

    for (const [seriesId, card] of seriesMap) {
      const createdAt = new Date(card.created_at);
      const daysSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

      let shouldDuplicate = false;
      if (card.repeat_schedule === 'daily' && daysSince >= 1) shouldDuplicate = true;
      if (card.repeat_schedule === 'weekly' && daysSince >= 7) shouldDuplicate = true;
      if (card.repeat_schedule === 'monthly' && daysSince >= 28) shouldDuplicate = true;

      if (!shouldDuplicate) continue;

      // Determine next position in the column
      const { data: colCards } = await supabase
        .from('board_cards')
        .select('position')
        .eq('column_id', card.column_id)
        .eq('is_archived', false)
        .order('position', { ascending: false })
        .limit(1);

      const nextPos = (colCards && colCards.length > 0 ? colCards[0].position : -1) + 1;

      // Create the duplicate
      const { error: insertErr } = await supabase
        .from('board_cards')
        .insert({
          column_id: card.column_id,
          board_id: card.board_id,
          title: card.title,
          description: card.description || null,
          position: nextPos,
          priority: card.priority,
          start_date: null,
          due_date: null,
          assignee: card.assignee || null,
          created_by: card.created_by || null,
          repeat_schedule: card.repeat_schedule,
          repeat_series_id: seriesId,
        });

      if (insertErr) {
        console.error(`Failed to duplicate card ${card.id}:`, insertErr.message);
        continue;
      }

      // Copy label assignments
      const { data: labelAssigns } = await supabase
        .from('card_label_assignments')
        .select('label_id')
        .eq('card_id', card.id);

      if (labelAssigns && labelAssigns.length > 0) {
        // We need the new card ID — fetch it
        const { data: newCards } = await supabase
          .from('board_cards')
          .select('id')
          .eq('board_id', card.board_id)
          .eq('column_id', card.column_id)
          .eq('position', nextPos)
          .eq('repeat_series_id', seriesId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (newCards && newCards.length > 0) {
          const newCardId = newCards[0].id;
          await supabase.from('card_label_assignments').insert(
            labelAssigns.map(la => ({ card_id: newCardId, label_id: la.label_id }))
          );
        }
      }

      createdCount++;
    }

    return NextResponse.json({ message: `Created ${createdCount} repeated card(s)`, created: createdCount });
  } catch (err: any) {
    console.error('Card repeat error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
