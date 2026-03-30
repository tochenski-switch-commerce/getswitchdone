import { NextRequest } from 'next/server';
import { resolveApiKey } from '../../../_lib/auth';
import { getAdminClient } from '../../../_lib/db';
import { ok, err } from '../../../_lib/response';
import { dispatchWebhook } from '../../../_lib/webhooks';

async function verifyBoardOwnership(boardId: string, userId: string): Promise<boolean> {
  const { data } = await getAdminClient()
    .from('project_boards')
    .select('id')
    .eq('id', boardId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;
    const { id } = await params;

    if (!(await verifyBoardOwnership(id, userId))) return err('Board not found', 404);

    const { data, error } = await getAdminClient()
      .from('board_labels')
      .select('id, name, color')
      .eq('board_id', id);

    if (error) throw error;
    return ok(data);
  } catch (e) {
    console.error('[v1/boards/:id/labels GET]', e);
    return err('Internal server error', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;
    const { id } = await params;

    if (!(await verifyBoardOwnership(id, userId))) return err('Board not found', 404);

    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) return err('name is required');

    const color = typeof body?.color === 'string' ? body.color.trim() : '';
    if (!color) return err('color is required');

    const { data, error } = await getAdminClient()
      .from('board_labels')
      .insert({ board_id: id, name, color })
      .select('id, name, color')
      .single();

    if (error) throw error;

    dispatchWebhook(userId, 'label.created', { label: data, boardId: id });

    return ok(data, 201);
  } catch (e) {
    console.error('[v1/boards/:id/labels POST]', e);
    return err('Internal server error', 500);
  }
}
