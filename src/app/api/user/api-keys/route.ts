import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user } } = await supabaseAnon.auth.getUser(auth.slice(7));
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, created_at, revoked_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[user/api-keys GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const plaintext = 'lum_' + crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex');
    const keyPrefix = plaintext.slice(0, 8);

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({ user_id: user.id, name, key_hash: keyHash, key_prefix: keyPrefix })
      .select('id, name, key_prefix, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ data: { ...data, key: plaintext } }, { status: 201 });
  } catch (e) {
    console.error('[user/api-keys POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
