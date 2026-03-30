import { NextRequest } from 'next/server';
import { z } from 'zod';
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

const createCardSchema = z.object({
  title: z.string().min(1),
  column_id: z.string().uuid(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  label_ids: z.array(z.string().uuid()).optional(),
});

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

    const { searchParams } = new URL(req.url);
    const columnId = searchParams.get('column_id');

    let query = getAdminClient()
      .from('board_cards')
      .select('id, title, description, column_id, position, priority, due_date, is_complete, is_archived, created_at, updated_at')
      .eq('board_id', id)
      .eq('is_archived', false)
      .order('position');

    if (columnId) query = query.eq('column_id', columnId);

    const { data, error } = await query;
    if (error) throw error;
    return ok(data);
  } catch (e) {
    console.error('[v1/boards/:id/cards GET]', e);
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
    const parsed = createCardSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const { title, column_id, description, priority, due_date, label_ids } = parsed.data;

    // Verify column belongs to this board
    const { data: col } = await getAdminClient()
      .from('board_columns')
      .select('id')
      .eq('id', column_id)
      .eq('board_id', id)
      .single();
    if (!col) return err('column_id does not belong to this board');

    // Compute next position in column
    const { data: maxRow } = await getAdminClient()
      .from('board_cards')
      .select('position')
      .eq('column_id', column_id)
      .eq('is_archived', false)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const position = (maxRow?.position ?? -1) + 1;

    const { data: card, error } = await getAdminClient()
      .from('board_cards')
      .insert({
        board_id: id,
        column_id,
        title,
        description: description ?? null,
        priority: priority ?? null,
        due_date: due_date ?? null,
        position,
        created_by: userId,
        is_archived: false,
      })
      .select('id, title, description, column_id, position, priority, due_date, is_complete, is_archived, created_at, updated_at')
      .single();

    if (error) throw error;

    // Assign labels if provided
    if (label_ids?.length) {
      await getAdminClient()
        .from('card_label_assignments')
        .insert(label_ids.map((label_id) => ({ card_id: card.id, label_id })));
    }

    dispatchWebhook(userId, 'card.created', { card, boardId: id });

    return ok(card, 201);
  } catch (e) {
    console.error('[v1/boards/:id/cards POST]', e);
    return err('Internal server error', 500);
  }
}
