import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

// POST /api/users/resolve — given a list of user IDs, return display names or emails
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { ids } = body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const db = getAdminDb();

  // First, try user_profiles
  const { data: profiles } = await db
    .from('user_profiles')
    .select('id, name')
    .in('id', ids);

  const resolved = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.name?.trim()) resolved.set(p.id, p.name.trim());
  }

  // For any IDs still missing, look up auth.users for their email
  const missing = ids.filter(id => !resolved.has(id));
  if (missing.length > 0) {
    const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authUsers?.users ?? []) {
      if (missing.includes(u.id) && u.email) {
        resolved.set(u.id, u.email);
      }
    }
  }

  const users = ids.map(id => ({ id, display: resolved.get(id) ?? id }));
  return NextResponse.json({ users });
}
