import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveApiKey } from '../../../_lib/auth';
import { getAdminClient } from '../../../_lib/db';
import { ok, err } from '../../../_lib/response';
import { dispatchWebhook } from '../../../_lib/webhooks';

const moveSchema = z.object({
  column_id: z.string().uuid(),
  position: z.number().int().min(0).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;
    const { id } = await params;

    // Fetch card and verify ownership
    const { data: card } = await getAdminClient()
      .from('board_cards')
      .select('id, column_id, board_id, project_boards!inner(user_id)')
      .eq('id', id)
      .eq('project_boards.user_id', userId)
      .single();

    if (!card) return err('Card not found', 404);

    const body = await req.json();
    const parsed = moveSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const { column_id, position: requestedPosition } = parsed.data;
    const boardId = (card as { board_id: string }).board_id;
    const fromColumnId = (card as { column_id: string }).column_id;

    // Verify target column belongs to same board
    const { data: col } = await getAdminClient()
      .from('board_columns')
      .select('id')
      .eq('id', column_id)
      .eq('board_id', boardId)
      .single();
    if (!col) return err('column_id does not belong to this card\'s board');

    // Resolve final position
    let finalPosition = requestedPosition;
    if (finalPosition === undefined) {
      const { data: maxRow } = await getAdminClient()
        .from('board_cards')
        .select('position')
        .eq('column_id', column_id)
        .eq('is_archived', false)
        .order('position', { ascending: false })
        .limit(1)
        .single();
      finalPosition = (maxRow?.position ?? -1) + 1;
    }

    const { error } = await getAdminClient()
      .from('board_cards')
      .update({ column_id, position: finalPosition })
      .eq('id', id);

    if (error) throw error;

    dispatchWebhook(userId, 'card.moved', {
      cardId: id,
      fromColumnId,
      toColumnId: column_id,
      position: finalPosition,
    });

    return ok({ cardId: id, column_id, position: finalPosition });
  } catch (e) {
    console.error('[v1/cards/:id/move POST]', e);
    return err('Internal server error', 500);
  }
}
