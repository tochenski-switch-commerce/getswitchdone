import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { gsdModel } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';
import { isProUser } from '@/lib/subscription-helpers';

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

  if (!(await isProUser(user.id))) {
    return NextResponse.json({ error: 'AI features require a Pro subscription.' }, { status: 403 });
  }

  const { notes, memberNames, boardTitle } = await req.json() as {
    notes: string;
    memberNames: string[];
    boardTitle: string;
  };

  if (!notes?.trim()) {
    return NextResponse.json({ error: 'No notes provided' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const { object } = await generateObject({
      model: gsdModel,
      schema: z.object({
        cards: z.array(z.object({
          title: z.string(),
          description: z.string().optional(),
          priority: z.enum(['low', 'medium', 'high', 'urgent']),
          assigneeName: z.string().optional(),
          dueDate: z.string().optional(),
        })),
      }),
      prompt: [
        'You are a project management assistant. Extract action items from the meeting notes below.',
        'For each action item, create a card with:',
        '- A clear, actionable title (imperative mood, under 80 chars)',
        '- A brief description (1-2 sentences) if context is needed, or omit if the title is self-explanatory',
        '- A priority: low, medium, high, or urgent based on urgency/importance signals',
        '- An assignee name if someone is mentioned as responsible (must match one of the team member names exactly)',
        '- A due date in YYYY-MM-DD format if a deadline is mentioned or implied',
        '',
        `Today's date: ${today}`,
        `Board: "${boardTitle}"`,
        memberNames.length > 0
          ? `Team members: ${memberNames.join(', ')}`
          : 'No team member list available — skip assignee.',
        '',
        'Meeting notes:',
        notes.slice(0, 6000),
      ].join('\n'),
    });

    return NextResponse.json(object);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
