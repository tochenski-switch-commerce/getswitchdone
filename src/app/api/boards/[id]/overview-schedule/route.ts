import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeNextSendAt } from '@/lib/schedule-utils';

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

async function getAuthUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  try {
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    return user?.id ?? null;
  } catch (err) {
    console.error('[overview-schedule] auth error:', err);
    return null;
  }
}

// GET /api/boards/[id]/overview-schedule
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: boardId } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('board_overview_schedules')
    .select('id, frequency, time_of_day, day_of_week, timezone, next_send_at')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data ?? null });
}

// POST /api/boards/[id]/overview-schedule — create or update
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: boardId } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { frequency, time_of_day, day_of_week, timezone } = body;

  if (!['daily', 'weekly'].includes(frequency)) {
    return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(time_of_day)) {
    return NextResponse.json({ error: 'Invalid time_of_day' }, { status: 400 });
  }

  const next_send_at = computeNextSendAt(frequency, time_of_day, day_of_week ?? null, timezone ?? 'UTC');

  const { data, error } = await supabaseAdmin
    .from('board_overview_schedules')
    .upsert({
      board_id: boardId,
      user_id: userId,
      frequency,
      time_of_day,
      day_of_week: frequency === 'weekly' ? (day_of_week ?? 1) : null,
      timezone: timezone ?? 'UTC',
      next_send_at: next_send_at.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'board_id,user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

// DELETE /api/boards/[id]/overview-schedule
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: boardId } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('board_overview_schedules')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
