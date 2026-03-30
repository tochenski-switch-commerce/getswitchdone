import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
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

const VALID_EVENTS = [
  'board.created', 'board.updated', 'board.deleted',
  'card.created', 'card.updated', 'card.moved', 'card.deleted',
  'column.created', 'column.deleted',
  'label.created', 'label.deleted',
] as const;

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.enum(VALID_EVENTS)).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('webhook_endpoints')
      .select('id, name, url, events, is_active, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[user/webhooks GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { name, url, events } = parsed.data;
    const secret = crypto.randomBytes(32).toString('hex');

    const { data, error } = await supabaseAdmin
      .from('webhook_endpoints')
      .insert({ user_id: user.id, name, url, secret, events, is_active: true })
      .select('id, name, url, secret, events, is_active, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    console.error('[user/webhooks POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
