import { NextRequest } from 'next/server';
import { resolveApiKey } from '../../../../_lib/auth';
import { getAdminClient } from '../../../../_lib/db';
import { ok, err } from '../../../../_lib/response';
import { dispatchWebhook } from '../../../../_lib/webhooks';

async function fetchOwnedColumn(boardId: string, colId: string, userId: string) {
  const { data } = await getAdminClient()
    .from('board_columns')
    .select('id, title, position, color, column_type, created_at, board_id, project_boards!inner(user_id)')
    .eq('id', colId)
    .eq('board_id', boardId)
    .eq('project_boards.user_id', userId)
    .single();
  return data;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; colId: string }> }
) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;
    const { id, colId } = await params;

    const col = await fetchOwnedColumn(id, colId, userId);
    if (!col) return err('Column not found', 404);

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (typeof body?.title === 'string' && body.title.trim()) updates.title = body.title.trim();
    if (typeof body?.color === 'string') updates.color = body.color;
    if (typeof body?.position === 'number') updates.position = body.position;
    if (Object.keys(updates).length === 0) return err('No valid fields to update');

    const { data, error } = await getAdminClient()
      .from('board_columns')
      .update(updates)
      .eq('id', colId)
      .select('id, title, position, color, column_type, created_at')
      .single();

    if (error) throw error;
    return ok(data);
  } catch (e) {
    console.error('[v1/boards/:id/columns/:colId PATCH]', e);
    return err('Internal server error', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; colId: string }> }
) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;
    const { id, colId } = await params;

    const col = await fetchOwnedColumn(id, colId, userId);
    if (!col) return err('Column not found', 404);

    const { error } = await getAdminClient()
      .from('board_columns')
      .delete()
      .eq('id', colId);

    if (error) throw error;

    dispatchWebhook(userId, 'column.deleted', { columnId: colId, boardId: id });

    return ok({ deleted: true });
  } catch (e) {
    console.error('[v1/boards/:id/columns/:colId DELETE]', e);
    return err('Internal server error', 500);
  }
}
