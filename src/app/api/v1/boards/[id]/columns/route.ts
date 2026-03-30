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
      .from('board_columns')
      .select('id, title, position, color, column_type, created_at')
      .eq('board_id', id)
      .order('position');

    if (error) throw error;
    return ok(data);
  } catch (e) {
    console.error('[v1/boards/:id/columns GET]', e);
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
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) return err('title is required');

    const color = typeof body?.color === 'string' ? body.color : null;

    // Compute next position
    const { data: maxRow } = await getAdminClient()
      .from('board_columns')
      .select('position')
      .eq('board_id', id)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const position = (maxRow?.position ?? -1) + 1;

    const { data, error } = await getAdminClient()
      .from('board_columns')
      .insert({ board_id: id, title, position, color, column_type: 'normal' })
      .select('id, title, position, color, column_type, created_at')
      .single();

    if (error) throw error;

    dispatchWebhook(userId, 'column.created', { column: data, boardId: id });

    return ok(data, 201);
  } catch (e) {
    console.error('[v1/boards/:id/columns POST]', e);
    return err('Internal server error', 500);
  }
}
