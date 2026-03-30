import { NextRequest } from 'next/server';
import { resolveApiKey } from '../_lib/auth';
import { getAdminClient } from '../_lib/db';
import { ok, err } from '../_lib/response';
import { dispatchWebhook } from '../_lib/webhooks';

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;

    const { data, error } = await getAdminClient()
      .from('project_boards')
      .select('id, title, description, is_archived, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ok(data);
  } catch (e) {
    console.error('[v1/boards GET]', e);
    return err('Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;

    const body = await req.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return err('title is required');

    const description = typeof body?.description === 'string' ? body.description : null;

    const { data, error } = await getAdminClient()
      .from('project_boards')
      .insert({ user_id: userId, title, description, is_archived: false })
      .select('id, title, description, is_archived, created_at, updated_at')
      .single();

    if (error) throw error;

    dispatchWebhook(userId, 'board.created', { board: data });

    return ok(data, 201);
  } catch (e) {
    console.error('[v1/boards POST]', e);
    return err('Internal server error', 500);
  }
}
