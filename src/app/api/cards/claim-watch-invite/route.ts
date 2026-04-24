import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  const db = getSupabaseAdmin();

  // Require authentication to claim
  const { data: { user }, error: authErr } = token
    ? await db.auth.getUser(token)
    : { data: { user: null }, error: new Error('No token') };

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { inviteToken } = await req.json() as { inviteToken?: string };

  if (!inviteToken) {
    return NextResponse.json({ error: 'inviteToken is required' }, { status: 400 });
  }

  // Fetch the invite
  const { data: invite, error: fetchErr } = await db
    .from('watcher_invites')
    .select('id, card_id, claimed_at')
    .eq('token', inviteToken)
    .single();

  if (fetchErr || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (invite.claimed_at) {
    // Already claimed — still add them as a watcher in case they signed up with a different account
    await db
      .from('card_watchers')
      .upsert({ card_id: invite.card_id, user_id: user.id });
    return NextResponse.json({ ok: true, card_id: invite.card_id, alreadyClaimed: true });
  }

  // Add as watcher
  const { error: watchErr } = await db
    .from('card_watchers')
    .upsert({ card_id: invite.card_id, user_id: user.id });

  if (watchErr) {
    return NextResponse.json({ error: watchErr.message }, { status: 500 });
  }

  // Mark invite as claimed
  await db
    .from('watcher_invites')
    .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
    .eq('id', invite.id);

  return NextResponse.json({ ok: true, card_id: invite.card_id });
}
