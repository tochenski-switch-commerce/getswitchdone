import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { gsdModel } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  return user;
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, boardTitle, columnName, cardTitle, cardDescription, existingChecklists, checklistItems, availableLabels, currentPriority } = body;

  const context = [
    `Board: "${boardTitle}"`,
    columnName && `Column: "${columnName}"`,
    `Card title: "${cardTitle}"`,
    cardDescription && `Current description: "${cardDescription}"`,
    checklistItems?.length && `Checklist items:\n${(checklistItems as string[]).map((t: string) => `- ${t}`).join('\n')}`,
  ].filter(Boolean).join('\n');

  try {
    if (action === 'describe') {
      const hasExisting = !!cardDescription?.trim();
      const { object } = await generateObject({
        model: gsdModel,
        schema: z.object({ description: z.string() }),
        prompt: hasExisting
          ? `You are a senior project manager writing a professional card description. Improve and expand the existing content while keeping the original intent. Be clear and outcome-focused. Do NOT repeat or include the card title in the output. Return ONLY clean HTML using these tags: <b>, <ul>, <li>, <p>, <h3>. No markdown, no wrapper div, no inline styles, no other tags.\n\n${context}`
          : `You are a senior project manager writing a professional card description. Based on the card title and any context provided, write a clear, outcome-focused description. Use authoritative language. Keep it brief — 2-4 sentences or a short bulleted structure if appropriate. Do NOT repeat or include the card title in the output. Return ONLY clean HTML using these tags: <b>, <ul>, <li>, <p>, <h3>. No markdown, no wrapper div, no inline styles, no other tags.\n\n${context}`,
      });
      return NextResponse.json(object);
    }

    if (action === 'checklist') {
      const existing = existingChecklists?.length
        ? `\nExisting checklist items (do NOT repeat these): ${existingChecklists.join(', ')}`
        : '';
      const { object } = await generateObject({
        model: gsdModel,
        schema: z.object({ items: z.array(z.string()) }),
        prompt: `You are a project management assistant. Suggest 4-8 actionable checklist items for this card. Each item should be a short, specific task. Do not include items that already exist.${existing}\n\n${context}`,
      });
      return NextResponse.json(object);
    }

    if (action === 'classify') {
      const labels = availableLabels?.length
        ? `\nAvailable labels: ${availableLabels.join(', ')}`
        : '';
      const { object } = await generateObject({
        model: gsdModel,
        schema: z.object({
          suggestedPriority: z.enum(['low', 'medium', 'high', 'urgent']),
          suggestedLabels: z.array(z.string()),
        }),
        prompt: `You are a project management assistant. Based on the card title and description, suggest a priority level and relevant labels from the available list. Only suggest labels that exist in the available list.${labels}\n\nCurrent priority: ${currentPriority || 'none'}\n\n${context}`,
      });
      return NextResponse.json(object);
    }

    if (action === 'title') {
      const { object } = await generateObject({
        model: gsdModel,
        schema: z.object({ title: z.string() }),
        prompt: `You are a project management assistant. Rewrite this card title to be clearer and more actionable. Keep it concise (under 80 characters). Do not lose any meaning.\n\nOriginal title: "${cardTitle}"`,
      });
      return NextResponse.json(object);
    }

    if (action === 'breakdown') {
      const { object } = await generateObject({
        model: gsdModel,
        schema: z.object({
          cards: z.array(z.object({
            title: z.string(),
            description: z.string(),
          })),
        }),
        prompt: `You are a project management assistant. Break this card into 3-6 smaller, actionable sub-tasks. Each should have a clear title and a 1-2 sentence description in clean HTML (<p> tags only).\n\n${context}`,
      });
      return NextResponse.json(object);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
