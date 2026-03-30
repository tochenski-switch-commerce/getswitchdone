import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveApiKey } from '../../_lib/auth';
import { getAdminClient } from '../../_lib/db';
import { ok, err } from '../../_lib/response';
import { dispatchWebhook } from '../../_lib/webhooks';

async function fetchOwnedCard(cardId: string, userId: string) {
  const { data } = await getAdminClient()
    .from('board_cards')
    .select('id, title, description, column_id, board_id, position, priority, due_date, is_complete, is_archived, created_at, updated_at, project_boards!inner(user_id)')
    .eq('id', cardId)
    .eq('project_boards.user_id', userId)
    .single();
  return data;
}

const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  column_id: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  is_complete: z.boolean().optional(),
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

    const card = await fetchOwnedCard(id, userId);
    if (!card) return err('Card not found', 404);

    // Fetch label assignments
    const { data: assignments } = await getAdminClient()
      .from('card_label_assignments')
      .select('label_id, board_labels(id, name, color)')
      .eq('card_id', id);

    const labels = assignments?.map((a) => a.board_labels).filter(Boolean) ?? [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { project_boards: _, ...cardData } = card as typeof card & { project_boards: unknown };
    return ok({ ...cardData, labels });
  } catch (e) {
    console.error('[v1/cards/:id GET]', e);
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

    const card = await fetchOwnedCard(id, userId);
    if (!card) return err('Card not found', 404);

    const body = await req.json();
    const parsed = updateCardSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const { label_ids, column_id, ...rest } = parsed.data;
    const updates: Record<string, unknown> = { ...rest };

    // Verify new column_id belongs to the same board
    if (column_id) {
      const { data: col } = await getAdminClient()
        .from('board_columns')
        .select('id')
        .eq('id', column_id)
        .eq('board_id', (card as { board_id: string }).board_id)
        .single();
      if (!col) return err('column_id does not belong to this card\'s board');
      updates.column_id = column_id;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await getAdminClient()
        .from('board_cards')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    }

    // Reassign labels if provided
    if (label_ids !== undefined) {
      await getAdminClient().from('card_label_assignments').delete().eq('card_id', id);
      if (label_ids.length > 0) {
        await getAdminClient()
          .from('card_label_assignments')
          .insert(label_ids.map((label_id) => ({ card_id: id, label_id })));
      }
    }

    const { data: updated } = await getAdminClient()
      .from('board_cards')
      .select('id, title, description, column_id, board_id, position, priority, due_date, is_complete, is_archived, created_at, updated_at')
      .eq('id', id)
      .single();

    dispatchWebhook(userId, 'card.updated', { card: updated });

    return ok(updated);
  } catch (e) {
    console.error('[v1/cards/:id PATCH]', e);
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

    const card = await fetchOwnedCard(id, userId);
    if (!card) return err('Card not found', 404);

    const { error } = await getAdminClient().from('board_cards').delete().eq('id', id);
    if (error) throw error;

    dispatchWebhook(userId, 'card.deleted', { cardId: id });

    return ok({ deleted: true });
  } catch (e) {
    console.error('[v1/cards/:id DELETE]', e);
    return err('Internal server error', 500);
  }
}
