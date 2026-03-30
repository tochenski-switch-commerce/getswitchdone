import { NextRequest } from 'next/server';
import { resolveApiKey } from '../../_lib/auth';
import { getAdminClient } from '../../_lib/db';
import { ok, err } from '../../_lib/response';
import { dispatchWebhook } from '../../_lib/webhooks';

async function fetchOwnedBoard(boardId: string, userId: string) {
  const { data } = await getAdminClient()
    .from('project_boards')
    .select('id, title, description, is_archived, created_at, updated_at')
    .eq('id', boardId)
    .eq('user_id', userId)
    .single();
  return data;
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

    const board = await fetchOwnedBoard(id, userId);
    if (!board) return err('Board not found', 404);

    const db = getAdminClient();
    const [columnsRes, labelsRes] = await Promise.all([
      db.from('board_columns').select('id, title, position, color, column_type, created_at').eq('board_id', id).order('position'),
      db.from('board_labels').select('id, name, color').eq('board_id', id),
    ]);

    return ok({ ...board, columns: columnsRes.data ?? [], labels: labelsRes.data ?? [] });
  } catch (e) {
    console.error('[v1/boards/:id GET]', e);
    return err('Internal server error', 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;
    const { id } = await params;

    const board = await fetchOwnedBoard(id, userId);
    if (!board) return err('Board not found', 404);

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (typeof body?.title === 'string' && body.title.trim()) updates.title = body.title.trim();
    if (typeof body?.description === 'string') updates.description = body.description;
    if (Object.keys(updates).length === 0) return err('No valid fields to update');

    const { data, error } = await getAdminClient()
      .from('project_boards')
      .update(updates)
      .eq('id', id)
      .select('id, title, description, is_archived, created_at, updated_at')
      .single();

    if (error) throw error;

    dispatchWebhook(userId, 'board.updated', { board: data });

    return ok(data);
  } catch (e) {
    console.error('[v1/boards/:id PATCH]', e);
    return err('Internal server error', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;
    const { id } = await params;

    const board = await fetchOwnedBoard(id, userId);
    if (!board) return err('Board not found', 404);

    const { error } = await getAdminClient()
      .from('project_boards')
      .delete()
      .eq('id', id);

    if (error) throw error;

    dispatchWebhook(userId, 'board.deleted', { boardId: id });

    return ok({ deleted: true });
  } catch (e) {
    console.error('[v1/boards/:id DELETE]', e);
    return err('Internal server error', 500);
  }
}
