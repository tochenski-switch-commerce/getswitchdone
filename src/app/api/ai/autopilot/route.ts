import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { gsdModel } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';
import { isProUser } from '@/lib/subscription-helpers';

/* ── Supabase ── */
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

/* ── Types ── */
export interface AutopilotInsight {
  id: string;
  type: 'overdue' | 'idle' | 'bottleneck' | 'workload' | 'no_priority' | 'no_due_date' | 'suggestion';
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  description: string;
  cardIds?: string[];
  actions?: { label: string; action: string; payload: Record<string, unknown> }[];
}

/* ── Pure-data analysis (no AI cost) ── */
function analyzeBoard(
  columns: Record<string, unknown>[],
  cards: Record<string, unknown>[],
  profiles: Record<string, unknown>[],
): AutopilotInsight[] {
  const insights: AutopilotInsight[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // 1. Overdue cards
  const overdue = cards.filter(c => c.due_date && (c.due_date as string) < today);
  if (overdue.length > 0) {
    const names = overdue.slice(0, 3).map(c => `"${c.title}"`).join(', ');
    const extra = overdue.length > 3 ? ` and ${overdue.length - 3} more` : '';
    insights.push({
      id: 'overdue',
      type: 'overdue',
      severity: 'urgent',
      title: `${overdue.length} overdue card${overdue.length > 1 ? 's' : ''}`,
      description: `${names}${extra} — past due date. Consider re-prioritizing or reassigning.`,
      cardIds: overdue.map(c => c.id as string),
      actions: [
        { label: 'Ask AI to re-prioritize', action: 'chat', payload: { prompt: `These cards are overdue: ${overdue.map(c => `"${c.title}"`).join(', ')}. Suggest how to handle them — should I extend dates, reassign, or break them down?` } },
      ],
    });
  }

  // 2. Idle cards (updated_at > 5 days ago, not in first or last column)
  const sortedCols = [...columns].sort((a, b) => (a.position as number) - (b.position as number));
  const firstColId = sortedCols[0]?.id;
  const lastColId = sortedCols[sortedCols.length - 1]?.id;
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const idle = cards.filter(c =>
    c.updated_at && (c.updated_at as string) < fiveDaysAgo &&
    c.column_id !== firstColId && c.column_id !== lastColId
  );
  if (idle.length > 0) {
    const names = idle.slice(0, 3).map(c => `"${c.title}"`).join(', ');
    const extra = idle.length > 3 ? ` and ${idle.length - 3} more` : '';
    insights.push({
      id: 'idle',
      type: 'idle',
      severity: 'warning',
      title: `${idle.length} stale card${idle.length > 1 ? 's' : ''}`,
      description: `${names}${extra} — no updates in 5+ days. These may be blocked or forgotten.`,
      cardIds: idle.map(c => c.id as string),
      actions: [
        { label: 'Ask AI what to do', action: 'chat', payload: { prompt: `These cards haven't been touched in over 5 days: ${idle.map(c => `"${c.title}"`).join(', ')}. Are they blocked? Should I archive them, reassign, or break them down?` } },
      ],
    });
  }

  // 3. Column bottleneck (any mid-column has 2x+ the avg cards)
  const midCols = sortedCols.slice(1, -1);
  if (midCols.length > 0) {
    const colCounts = midCols.map(col => ({
      col,
      count: cards.filter(c => c.column_id === col.id).length,
    }));
    const avg = colCounts.reduce((s, c) => s + c.count, 0) / colCounts.length;
    const bottleneck = colCounts.find(c => c.count > 0 && c.count >= Math.max(avg * 2, 4));
    if (bottleneck) {
      insights.push({
        id: `bottleneck-${bottleneck.col.id}`,
        type: 'bottleneck',
        severity: 'warning',
        title: `"${bottleneck.col.title}" is a bottleneck`,
        description: `${bottleneck.count} cards piling up (board avg: ${Math.round(avg)}). This column may need more attention or effort redistribution.`,
        actions: [
          { label: 'Get suggestions', action: 'chat', payload: { prompt: `The "${bottleneck.col.title}" column has ${bottleneck.count} cards while the average is ${Math.round(avg)}. What should I do to clear this bottleneck?` } },
        ],
      });
    }
  }

  // 4. Workload imbalance
  const assigneeCounts: Record<string, number> = {};
  for (const c of cards) {
    const assignees = (c.assignees as string[] | undefined) || [];
    for (const a of assignees) {
      assigneeCounts[a] = (assigneeCounts[a] || 0) + 1;
    }
  }
  const assigneeEntries = Object.entries(assigneeCounts);
  if (assigneeEntries.length >= 2) {
    const sorted = assigneeEntries.sort((a, b) => b[1] - a[1]);
    const max = sorted[0];
    const min = sorted[sorted.length - 1];
    if (max[1] >= min[1] * 2.5 && max[1] >= 4) {
      insights.push({
        id: 'workload',
        type: 'workload',
        severity: 'info',
        title: 'Uneven workload',
        description: `${max[0]} has ${max[1]} cards while ${min[0]} has ${min[1]}. Consider redistributing work.`,
        actions: [
          { label: 'Rebalance suggestions', action: 'chat', payload: { prompt: `${max[0]} has ${max[1]} active cards while ${min[0]} only has ${min[1]}. Can you suggest which cards to reassign to balance the workload?` } },
        ],
      });
    }
  }

  // 5. Cards with no priority
  const noPriority = cards.filter(c => !c.priority || c.priority === 'medium');
  if (noPriority.length >= 3 && noPriority.length > cards.length * 0.5) {
    insights.push({
      id: 'no-priority',
      type: 'no_priority',
      severity: 'info',
      title: `${noPriority.length} cards need prioritization`,
      description: 'Most cards have default priority. Setting clear priorities helps focus effort on what matters.',
      actions: [
        { label: 'Auto-prioritize', action: 'chat', payload: { prompt: 'Can you analyze all my cards and suggest priority levels for each based on their titles, due dates, and context?' } },
      ],
    });
  }

  // 6. Cards with no due date (only in progress-type columns)
  const inProgressCards = cards.filter(c => c.column_id !== firstColId && c.column_id !== lastColId);
  const noDueDate = inProgressCards.filter(c => !c.due_date);
  if (noDueDate.length >= 2) {
    insights.push({
      id: 'no-due-date',
      type: 'no_due_date',
      severity: 'info',
      title: `${noDueDate.length} in-progress cards have no deadline`,
      description: 'Cards without due dates tend to drift. Adding dates helps track velocity.',
      cardIds: noDueDate.map(c => c.id as string),
    });
  }

  return insights;
}

/* ── AI-powered standup summary ── */
async function generateStandupSummary(
  columns: Record<string, unknown>[],
  cards: Record<string, unknown>[],
): Promise<string> {
  const sortedCols = [...columns].sort((a, b) => (a.position as number) - (b.position as number));

  const columnBreakdown = sortedCols.map(col => {
    const colCards = cards.filter(c => c.column_id === col.id);
    return `- ${col.title}: ${colCards.length} cards`;
  }).join('\n');

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const recentlyUpdated = cards.filter(c => (c.updated_at as string) >= yesterday);
  const dueSoon = cards.filter(c => c.due_date && (c.due_date as string) >= today && (c.due_date as string) <= new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);

  const result = await generateText({
    model: gsdModel,
    output: Output.object({ schema: z.object({ summary: z.string() }) }),
    prompt: `Write a brief standup-style board summary (3-5 sentences, plain text). Be direct and actionable.

Board state:
${columnBreakdown}
Total: ${cards.length} cards

Recently active (last 24h): ${recentlyUpdated.length > 0 ? recentlyUpdated.map(c => `"${c.title}"`).join(', ') : 'none'}
Due in next 3 days: ${dueSoon.length > 0 ? dueSoon.map(c => `"${c.title}" (${c.due_date})`).join(', ') : 'none'}

Focus on: what's moving, what's stuck, and what's coming up.`,
  });

  return result.output.summary;
}

/* ── POST handler ── */
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await isProUser(user.id))) {
    return NextResponse.json({ error: 'AI features require a Pro subscription.' }, { status: 403 });
  }

  const { boardId, includeStandup } = await req.json();
  if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 });

  // Fetch board data — profiles scoped to board team only
  const boardRes = await supabaseAdmin.from('project_boards').select('id, user_id, team_id').eq('id', boardId).single();
  if (boardRes.error || !boardRes.data) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  const boardMeta = boardRes.data;

  const [colsRes, cardsRes, profilesRes] = await Promise.all([
    supabaseAdmin.from('board_columns').select('id, title, position').eq('board_id', boardId).order('position'),
    supabaseAdmin.from('board_cards').select('id, title, column_id, position, priority, due_date, assignee, assignees, is_archived, created_at, updated_at').eq('board_id', boardId).eq('is_archived', false),
    boardMeta.team_id
      ? supabaseAdmin.from('team_members').select('user_id').eq('team_id', boardMeta.team_id)
          .then(r => {
            const ids = [...new Set([(boardMeta.user_id as string), ...((r.data || []).map((m: { user_id: string }) => m.user_id))])];
            return supabaseAdmin.from('user_profiles').select('id, name').in('id', ids);
          })
      : supabaseAdmin.from('user_profiles').select('id, name').in('id', [boardMeta.user_id]),
  ]);

  const columns = colsRes.data || [];
  const cards = cardsRes.data || [];
  const profiles = profilesRes.data || [];

  // Run pure-data analysis (free — no AI calls)
  const insights = analyzeBoard(columns, cards, profiles);

  // Optionally generate AI standup summary
  let standup: string | undefined;
  if (includeStandup && cards.length > 0) {
    try {
      standup = await generateStandupSummary(columns, cards);
    } catch (err) {
      console.error('[autopilot] standup generation failed:', err);
    }
  }

  return NextResponse.json({ insights, standup });
}
