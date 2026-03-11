import { NextRequest } from 'next/server';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { gsdModel } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';

/* ── Supabase clients ── */
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user } } = await supabaseAnon.auth.getUser(authHeader.replace('Bearer ', ''));
  return user;
}

/* ── Build board context for the system prompt ── */
async function buildBoardContext(boardId: string) {
  const [boardRes, colsRes, cardsRes, labelsRes, fieldsRes, profilesRes] = await Promise.all([
    supabaseAdmin.from('project_boards').select('*').eq('id', boardId).single(),
    supabaseAdmin.from('board_columns').select('*').eq('board_id', boardId).order('position'),
    supabaseAdmin.from('board_cards').select('id, title, column_id, position, priority, due_date, assignees, is_archived, created_at, updated_at').eq('board_id', boardId).eq('is_archived', false),
    supabaseAdmin.from('board_labels').select('*').eq('board_id', boardId),
    supabaseAdmin.from('board_custom_fields').select('*').eq('board_id', boardId),
    supabaseAdmin.from('user_profiles').select('*'),
  ]);

  const board = boardRes.data;
  const columns = colsRes.data || [];
  const cards = cardsRes.data || [];
  const labels = labelsRes.data || [];
  const fields = fieldsRes.data || [];
  const profiles = profilesRes.data || [];

  const columnSummaries = columns.map(col => {
    const colCards = cards.filter((c: { column_id: string }) => c.column_id === col.id);
    const cardList = colCards.map((c: { title: string; priority: string | null; due_date: string | null; assignees: string[] | null }) =>
      `  - "${c.title}"${c.priority ? ` [${c.priority}]` : ''}${c.due_date ? ` (due: ${c.due_date})` : ''}${c.assignees?.length ? ` → ${c.assignees.join(', ')}` : ''}`
    ).join('\n');
    return `Column "${col.title}" (${colCards.length} cards):\n${cardList || '  (empty)'}`;
  }).join('\n\n');

  const now = new Date();
  const overdue = cards.filter((c: { due_date?: string }) => c.due_date && new Date(c.due_date) < now);
  const noAssignee = cards.filter((c: { assignees?: string[] }) => !c.assignees?.length);
  const noDueDate = cards.filter((c: { due_date?: string }) => !c.due_date);

  return {
    board, columns, cards, labels, fields, profiles,
    systemContext: `Board: "${board?.title}"${board?.description ? ` — ${board.description}` : ''}
Total cards: ${cards.length} | Overdue: ${overdue.length} | No assignee: ${noAssignee.length} | No due date: ${noDueDate.length}
Labels: ${labels.map((l: { name: string }) => l.name).join(', ') || 'none'}
Custom fields: ${fields.map((f: { title: string }) => f.title).join(', ') || 'none'}
Team members: ${profiles.map((p: { name: string }) => p.name).join(', ') || 'none'}

${columnSummaries}`,
  };
}

/* ── Knowledge base for user help ── */
const HELP_KNOWLEDGE = `
Lumio Feature Guide:
- BOARDS: Create boards from the boards list. Each board has columns, cards, labels, and custom fields. Boards can be public or private.
- COLUMNS: Default columns are "To Do", "In Progress", "Review", "Done". Add, rename, reorder, or delete columns. Drag column headers to reorder.
- CARDS: Click "+" on a column to add cards. Drag cards between columns. Click a card to open its detail modal.
- CARD DETAILS: Edit title, description (rich text), priority (low/medium/high/urgent), start & due dates, assignees, labels, checklists, custom fields, and card links.
- CHECKLISTS: Add items, check them off, save as reusable templates. Apply templates to other cards or in bulk via list actions.
- LABELS: Create board-level labels with 18 color options. Assign multiple labels to cards. Manage in the label manager (Tag icon in board menu).
- CUSTOM FIELDS: Create per-board fields (text, date, dropdown, multiselect, number, checkbox). Set values per card.
- FORMS: Create public intake forms that generate cards when submitted. Configure field mappings. Share via /f/[slug] URL.
- EMAIL INTAKE: Forward emails to the Lumio inbox. Emails are auto-matched to boards by subject. Unmatched emails appear in the email panel for manual routing.
- KEYBOARD SHORTCUTS: Alt+Arrow = navigate cards, C = copy card, Delete = delete, D = toggle due date, M = self-assign, Enter = open detail.
- DRAG & DROP: Drag cards between columns. Drag column headers to reorder. All positioning is persisted.
- SEARCH & FILTER: Use the search bar + priority/label/date filters in the board header toolbar.
- NOTIFICATIONS: Inbox bell shows comments, assignments, due reminders, overdue alerts, and mentions.
`;

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { messages, boardId } = await req.json();
    if (!boardId) return new Response('boardId required', { status: 400 });

  const { board, columns, cards, labels, profiles, systemContext } = await buildBoardContext(boardId);
  if (!board) return new Response('Board not found', { status: 404 });

  const systemPrompt = `You are Lumio AI, a smart project management assistant built into the Lumio kanban app. You help the user manage their board, answer questions, provide analytics/insights, and perform actions.

Current user: ${profiles.find((p: { id: string }) => p.id === user.id)?.name || user.email}

CURRENT BOARD STATE:
${systemContext}

${HELP_KNOWLEDGE}

GUIDELINES:
- Be concise and helpful. Use bullet points for lists.
- When referencing cards, use their exact titles in quotes.
- When you perform actions (add cards, move cards, etc.), confirm what you did.
- For analytics, compute from the board data above. Give specific numbers and actionable insights.
- If the user asks about features, answer from the knowledge base above.
- When suggesting priorities or actions, be opinionated but explain your reasoning briefly.
- Format responses in clean markdown. Use bold for emphasis.`;

  // Check API key is available
  if (!process.env.OPENAI_API_KEY) {
    return new Response('OPENAI_API_KEY is not configured in environment variables.', { status: 500 });
  }

  const result = streamText({
    model: gsdModel,
    system: systemPrompt,
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      addCard: tool({
        description: 'Add a new card to a column on the board',
        inputSchema: z.object({
          columnName: z.string().describe('Name of the target column (e.g. "To Do")'),
          title: z.string().describe('Card title'),
          description: z.string().optional().describe('Card description (plain text)'),
          priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        }),
        execute: async ({ columnName, title, description, priority }) => {
          const col = columns.find((c: { title: string }) =>
            c.title.toLowerCase() === columnName.toLowerCase()
          );
          if (!col) return { error: `Column "${columnName}" not found. Available: ${columns.map((c: { title: string }) => c.title).join(', ')}` };

          const colCards = cards.filter((c: { column_id: string }) => c.column_id === col.id);
          const maxPos = colCards.length > 0
            ? Math.max(...colCards.map((c: { position: number }) => c.position))
            : -1;

          const { data, error } = await supabaseAdmin.from('board_cards').insert({
            board_id: boardId,
            column_id: col.id,
            title,
            description: description || '',
            priority: priority || null,
            position: maxPos + 1,
            created_by: user.id,
          }).select('id, title').single();

          if (error) return { error: error.message };
          return { success: true, cardId: data.id, title: data.title, column: col.title };
        },
      }),

      addChecklistItems: tool({
        description: 'Add checklist items to a card',
        inputSchema: z.object({
          cardTitle: z.string().describe('Title of the card to add checklist items to'),
          items: z.array(z.string()).describe('Array of checklist item titles'),
        }),
        execute: async ({ cardTitle, items }) => {
          const card = cards.find((c: { title: string }) =>
            c.title.toLowerCase().includes(cardTitle.toLowerCase())
          );
          if (!card) return { error: `Card "${cardTitle}" not found` };

          const { data: existing } = await supabaseAdmin
            .from('card_checklists')
            .select('position')
            .eq('card_id', card.id)
            .order('position', { ascending: false })
            .limit(1);

          let pos = existing?.[0]?.position ?? -1;
          const inserts = items.map(title => ({
            card_id: card.id,
            title,
            is_completed: false,
            position: ++pos,
          }));

          const { error } = await supabaseAdmin.from('card_checklists').insert(inserts);
          if (error) return { error: error.message };
          return { success: true, card: card.title, itemsAdded: items.length };
        },
      }),

      moveCard: tool({
        description: 'Move a card to a different column',
        inputSchema: z.object({
          cardTitle: z.string().describe('Title of the card to move'),
          toColumn: z.string().describe('Name of the target column'),
        }),
        execute: async ({ cardTitle, toColumn }) => {
          const card = cards.find((c: { title: string }) =>
            c.title.toLowerCase().includes(cardTitle.toLowerCase())
          );
          if (!card) return { error: `Card "${cardTitle}" not found` };

          const col = columns.find((c: { title: string }) =>
            c.title.toLowerCase() === toColumn.toLowerCase()
          );
          if (!col) return { error: `Column "${toColumn}" not found` };

          const colCards = cards.filter((c: { column_id: string }) => c.column_id === col.id);
          const maxPos = colCards.length > 0
            ? Math.max(...colCards.map((c: { position: number }) => c.position))
            : -1;

          const { error } = await supabaseAdmin.from('board_cards')
            .update({ column_id: col.id, position: maxPos + 1 })
            .eq('id', card.id);

          if (error) return { error: error.message };
          return { success: true, card: card.title, from: columns.find((c: { id: string }) => c.id === card.column_id)?.title, to: col.title };
        },
      }),

      getCardDetails: tool({
        description: 'Get full details of a specific card including description, checklists, comments, and custom fields',
        inputSchema: z.object({
          cardTitle: z.string().describe('Title of the card to look up'),
        }),
        execute: async ({ cardTitle }) => {
          const card = cards.find((c: { title: string }) =>
            c.title.toLowerCase().includes(cardTitle.toLowerCase())
          );
          if (!card) return { error: `Card "${cardTitle}" not found` };

          const [descRes, checkRes, commentRes] = await Promise.all([
            supabaseAdmin.from('board_cards').select('description, priority, due_date, start_date, assignees').eq('id', card.id).single(),
            supabaseAdmin.from('card_checklists').select('title, is_completed').eq('card_id', card.id).order('position'),
            supabaseAdmin.from('card_comments').select('content, created_at, user_id').eq('card_id', card.id).order('created_at', { ascending: false }).limit(5),
          ]);

          return {
            title: card.title,
            column: columns.find((c: { id: string }) => c.id === card.column_id)?.title,
            ...descRes.data,
            checklists: checkRes.data || [],
            recentComments: commentRes.data || [],
          };
        },
      }),

      getBoardAnalytics: tool({
        description: 'Get comprehensive analytics and insights about the board',
        inputSchema: z.object({}),
        execute: async () => {
          const now = new Date();
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

          const overdue = cards.filter((c: { due_date?: string }) => c.due_date && new Date(c.due_date) < now);
          const dueThisWeek = cards.filter((c: { due_date?: string }) =>
            c.due_date && new Date(c.due_date) >= now && new Date(c.due_date) <= weekFromNow
          );
          const noAssignee = cards.filter((c: { assignees?: string[] }) => !c.assignees?.length);
          const noDueDate = cards.filter((c: { due_date?: string }) => !c.due_date);
          const stale = cards.filter((c: { updated_at: string }) => new Date(c.updated_at) < twoWeeksAgo);

          // Fetch checklists for completion rate
          const { data: allChecklists } = await supabaseAdmin
            .from('card_checklists')
            .select('card_id, is_completed')
            .in('card_id', cards.map((c: { id: string }) => c.id));

          const totalItems = allChecklists?.length || 0;
          const completedItems = allChecklists?.filter((i: { is_completed: boolean }) => i.is_completed).length || 0;

          // Cards per column
          const columnBreakdown = columns.map((col: { id: string; title: string }) => {
            const count = cards.filter((c: { column_id: string }) => c.column_id === col.id).length;
            return { column: col.title, count, pct: cards.length ? Math.round((count / cards.length) * 100) : 0 };
          });

          // Workload per assignee
          const assigneeMap: Record<string, number> = {};
          cards.forEach((c: { assignees?: string[] }) => {
            (c.assignees || []).forEach((a: string) => {
              assigneeMap[a] = (assigneeMap[a] || 0) + 1;
            });
          });

          // Label usage
          const { data: labelAssignments } = await supabaseAdmin
            .from('card_label_assignments')
            .select('label_id')
            .in('card_id', cards.map((c: { id: string }) => c.id));

          const labelCounts: Record<string, number> = {};
          (labelAssignments || []).forEach((la: { label_id: string }) => {
            const label = labels.find((l: { id: string }) => l.id === la.label_id);
            if (label) labelCounts[label.name] = (labelCounts[label.name] || 0) + 1;
          });

          // Priority breakdown
          const priorityCounts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0, none: 0 };
          cards.forEach((c: { priority?: string | null }) => {
            priorityCounts[c.priority || 'none']++;
          });

          return {
            totalCards: cards.length,
            columnBreakdown,
            overdue: { count: overdue.length, cards: overdue.map((c: { title: string; due_date?: string }) => `"${c.title}" (due ${c.due_date})`) },
            dueThisWeek: { count: dueThisWeek.length, cards: dueThisWeek.map((c: { title: string; due_date?: string }) => `"${c.title}" (due ${c.due_date})`) },
            noAssignee: { count: noAssignee.length, cards: noAssignee.map((c: { title: string }) => c.title) },
            noDueDate: { count: noDueDate.length },
            staleCards: { count: stale.length, cards: stale.map((c: { title: string }) => c.title) },
            checklistCompletion: totalItems ? `${completedItems}/${totalItems} (${Math.round((completedItems / totalItems) * 100)}%)` : 'No checklist items',
            workload: assigneeMap,
            labelUsage: labelCounts,
            priorityBreakdown: priorityCounts,
          };
        },
      }),

      searchCards: tool({
        description: 'Search for cards on the board by keyword',
        inputSchema: z.object({
          query: z.string().describe('Search keyword'),
        }),
        execute: async ({ query }) => {
          const q = query.toLowerCase();
          const results = cards
            .filter((c: { title: string }) => c.title.toLowerCase().includes(q))
            .map((c: { title: string; column_id: string; priority?: string | null; due_date?: string }) => ({
              title: c.title,
              column: columns.find((col: { id: string }) => col.id === c.column_id)?.title,
              priority: c.priority,
              dueDate: c.due_date,
            }));
          return { results, totalMatches: results.length };
        },
      }),

      setCardPriority: tool({
        description: 'Set the priority of a card',
        inputSchema: z.object({
          cardTitle: z.string().describe('Title of the card'),
          priority: z.enum(['low', 'medium', 'high', 'urgent']),
        }),
        execute: async ({ cardTitle, priority }) => {
          const card = cards.find((c: { title: string }) =>
            c.title.toLowerCase().includes(cardTitle.toLowerCase())
          );
          if (!card) return { error: `Card "${cardTitle}" not found` };

          const { error } = await supabaseAdmin.from('board_cards')
            .update({ priority })
            .eq('id', card.id);

          if (error) return { error: error.message };
          return { success: true, card: card.title, priority };
        },
      }),
    },
  });

  // Stream text-delta parts from fullStream (supports multi-step tool flows)
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            controller.enqueue(encoder.encode(part.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`AI Chat Error: ${msg}`, { status: 500 });
  }
}
