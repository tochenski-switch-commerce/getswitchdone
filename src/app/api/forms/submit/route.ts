import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { FormField } from '@/types/board-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formId, data } = body as { formId: string; data: Record<string, string> };

    if (!formId || !data) {
      return NextResponse.json({ error: 'Missing formId or data' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the form
    const { data: form, error: formErr } = await supabase
      .from('board_forms')
      .select('*')
      .eq('id', formId)
      .eq('is_active', true)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ error: 'Form not found or inactive' }, { status: 404 });
    }

    const fields = form.fields as FormField[];

    // Validate required fields
    for (const field of fields) {
      if (field.required && !data[field.id]?.trim()) {
        return NextResponse.json({ error: `${field.label} is required` }, { status: 400 });
      }
    }

    // Build card data from field mappings
    let cardTitle = 'Form submission';
    let cardDescription = '';
    let cardPriority = 'medium';
    let priorityExplicitlyMapped = false;
    let cardDueDate: string | null = null;
    let cardAssignee: string | null = null;
    const descParts: string[] = [];
    const customFieldValues: { field_id: string; value: string }[] = [];

    for (const field of fields) {
      const value = data[field.id]?.trim() || '';

      // Hidden assignee: apply the form-configured default before the empty-value guard
      if (field.maps_to === 'assignee' && field.assignee_visible === false) {
        if (field.assignee_default_id) cardAssignee = field.assignee_default_id;
        continue;
      }

      if (!value) continue;

      if (field.maps_to === 'title') {
        cardTitle = value;
      } else if (field.maps_to === 'description') {
        cardDescription = value;
      } else if (field.maps_to === 'priority') {
        if (['low', 'medium', 'high', 'urgent'].includes(value)) {
          cardPriority = value;
          priorityExplicitlyMapped = true;
        }
      } else if (field.maps_to === 'due_date') {
        cardDueDate = value;
      } else if (field.maps_to === 'assignee') {
        cardAssignee = value;
      } else if (field.maps_to && field.maps_to.startsWith('custom_field:')) {
        const cfId = field.maps_to.slice('custom_field:'.length);
        customFieldValues.push({ field_id: cfId, value });
      } else {
        // Unmapped fields go into description
        descParts.push(`**${field.label}:** ${value}`);
      }
    }

    // Combine mapped description with unmapped fields
    if (descParts.length > 0) {
      cardDescription = cardDescription
        ? cardDescription + '\n\n' + descParts.join('\n')
        : descParts.join('\n');
    }

    // Get next position in the target column
    const { data: existingCards } = await supabase
      .from('board_cards')
      .select('position')
      .eq('column_id', form.column_id)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = existingCards && existingCards.length > 0 ? existingCards[0].position + 1 : 0;

    // Create the card
    const { data: card, error: cardErr } = await supabase
      .from('board_cards')
      .insert([{
        board_id: form.board_id,
        column_id: form.column_id,
        title: cardTitle,
        description: cardDescription || null,
        priority: cardPriority,
        due_date: cardDueDate,
        assignee: cardAssignee,
        assignees: cardAssignee ? [cardAssignee] : [],
        position: nextPosition,
        is_archived: false,
      }])
      .select()
      .single();

    if (cardErr) {
      console.error('[form-submit] Failed to create card:', cardErr);
      return NextResponse.json({ error: 'Failed to create card' }, { status: 500 });
    }

    // Write custom field values
    if (customFieldValues.length > 0) {
      const cfRows = customFieldValues.map(cf => ({
        card_id: card.id,
        field_id: cf.field_id,
        value: cf.value,
        multi_value: [],
      }));
      const { error: cfErr } = await supabase.from('card_custom_field_values').insert(cfRows);
      if (cfErr) {
        console.error('Failed to save custom field values:', cfErr);
      }
    }

    // Log the submission
    await supabase
      .from('form_submissions')
      .insert([{
        form_id: formId,
        data,
        card_id: card.id,
      }]);

    // ── AI auto-triage: classify priority if not explicitly mapped ──
    if (!priorityExplicitlyMapped) {
      try {
        const { triageContent } = await import('@/lib/ai');
        const triage = await triageContent({
          title: cardTitle,
          body: cardDescription,
        });
        if (triage && triage.priority !== cardPriority) {
          await supabase
            .from('board_cards')
            .update({ priority: triage.priority })
            .eq('id', card.id);
        }
      } catch (err) {
        console.error('[form-submit] AI triage failed (non-critical):', err);
      }
    }

    return NextResponse.json({ success: true, cardId: card.id, boardId: form.board_id });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
