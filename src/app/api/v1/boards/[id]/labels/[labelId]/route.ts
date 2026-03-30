import { NextRequest } from 'next/server';
import { resolveApiKey } from '../../../../_lib/auth';
import { getAdminClient } from '../../../../_lib/db';
import { ok, err } from '../../../../_lib/response';
import { dispatchWebhook } from '../../../../_lib/webhooks';

async function fetchOwnedLabel(boardId: string, labelId: string, userId: string) {
  const { data } = await getAdminClient()
    .from('board_labels')
    .select('id, name, color, board_id, project_boards!inner(user_id)')
    .eq('id', labelId)
    .eq('board_id', boardId)
    .eq('project_boards.user_id', userId)
    .single();
  return data;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; labelId: string }> }
) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;
    const { id, labelId } = await params;

    const label = await fetchOwnedLabel(id, labelId, userId);
    if (!label) return err('Label not found', 404);

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (typeof body?.name === 'string' && body.name.trim()) updates.name = body.name.trim();
    if (typeof body?.color === 'string' && body.color.trim()) updates.color = body.color.trim();
    if (Object.keys(updates).length === 0) return err('No valid fields to update');

    const { data, error } = await getAdminClient()
      .from('board_labels')
      .update(updates)
      .eq('id', labelId)
      .select('id, name, color')
      .single();

    if (error) throw error;
    return ok(data);
  } catch (e) {
    console.error('[v1/boards/:id/labels/:labelId PATCH]', e);
    return err('Internal server error', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; labelId: string }> }
) {
  try {
    const resolved = await resolveApiKey(req);
    if (!resolved) return err('Invalid or missing API key', 401);
    const { userId } = resolved;
    const { id, labelId } = await params;

    const label = await fetchOwnedLabel(id, labelId, userId);
    if (!label) return err('Label not found', 404);

    // Remove all assignments first, then delete label
    await getAdminClient().from('card_label_assignments').delete().eq('label_id', labelId);

    const { error } = await getAdminClient().from('board_labels').delete().eq('id', labelId);
    if (error) throw error;

    dispatchWebhook(userId, 'label.deleted', { labelId, boardId: id });

    return ok({ deleted: true });
  } catch (e) {
    console.error('[v1/boards/:id/labels/:labelId DELETE]', e);
    return err('Internal server error', 500);
  }
}
