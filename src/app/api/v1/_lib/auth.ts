import { NextRequest } from 'next/server';
import * as crypto from 'crypto';
import { getAdminClient } from './db';

export interface ResolvedKey {
  userId: string;
}

export async function resolveApiKey(req: NextRequest): Promise<ResolvedKey | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer lum_')) return null;

  const token = authHeader.slice('Bearer '.length);
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const db = getAdminClient();
  const { data, error } = await db
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .single();

  if (error || !data) return null;

  // Fire-and-forget — never blocks response
  db.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})
    .catch(() => {});

  return { userId: data.user_id };
}
