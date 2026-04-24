import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resend } from '@/lib/resend';
import {
  appBaseUrl,
  renderEmailButtonRow,
  renderEmailInfoPanel,
  renderLumioEmailShell,
  renderPrimaryEmailButton,
} from '@/lib/email-theme';
import {
  computeSummary,
  computeTimeline,
  getTodayStrInTimezone,
} from '@/components/board-overview/overviewMetrics';
import type { FullBoard } from '@/hooks/useProjectBoard';
import type { UserProfile } from '@/types/board-types';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

async function getAuthUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  try {
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    return user?.id ?? null;
  } catch (err) {
    console.error('[send-overview-email] auth error:', err);
    return null;
  }
}

function esc(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${m}-${day}-${y}`;
}

const PRIORITY_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  urgent: { color: '#dc2626', bg: '#fee2e2', label: 'URGENT' },
  high:   { color: '#c2410c', bg: '#ffedd5', label: 'HIGH' },
  medium: { color: '#b45309', bg: '#fef3c7', label: 'MEDIUM' },
  low:    { color: '#16a34a', bg: '#dcfce7', label: 'LOW' },
};

function priorityBadge(priority: string | null | undefined): string {
  const p = priority ? PRIORITY_COLORS[priority] : null;
  return p
    ? `<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:4px;background:${p.bg};color:${p.color}">${p.label}</span>`
    : '<span style="color:#6b7280">—</span>';
}

function getAssigneeName(card: FullBoard['cards'][number], profileById: Map<string, string>): string {
  const ids = (card.assignees && card.assignees.length > 0) ? card.assignees : (card.assignee ? [card.assignee] : []);
  return ids.length > 0 ? (profileById.get(ids[0]) ?? '—') : '—';
}

function buildTimelineSection(board: FullBoard, todayStr: string, profileById: Map<string, string>, colById: Map<string, string>): string {
  const tl = computeTimeline(board, todayStr);
  const groups = [
    { label: 'Overdue',        cards: tl.overdue,    color: '#f87171' },
    { label: 'Due Today',      cards: tl.today,      color: '#fbbf24' },
    { label: 'Due This Week',  cards: tl.thisWeek,   color: '#a5b4fc' },
    { label: 'Due This Month', cards: tl.thisMonth,  color: '#9ca3af' },
    { label: 'No Due Date',    cards: tl.noDate,     color: '#6b7280' },
  ].filter(g => g.cards.length > 0);
  if (groups.length === 0) return '';

  const headerCells = ['Card', 'Column', 'Priority', 'Assignee', 'Due'].map(
    h => `<th style="padding:0 10px 6px 0;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap;">${h}</th>`
  ).join('');

  const groupsHtml = groups.map(({ label, cards, color }) => {
    const rows = cards.map(card => `
      <tr>
        <td style="padding:4px 10px 4px 0;color:#d9dfed;font-size:12px;word-break:break-word;">${esc(card.title)}</td>
        <td style="padding:4px 10px 4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${esc(colById.get(card.column_id) ?? '—')}</td>
        <td style="padding:4px 10px 4px 0;">${priorityBadge(card.priority)}</td>
        <td style="padding:4px 10px 4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${esc(getAssigneeName(card, profileById))}</td>
        <td style="padding:4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${fmtDate(card.due_date)}</td>
      </tr>`).join('');
    return `
      <tr><td colspan="5" style="padding:12px 0 4px;">
        <span style="color:${color};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${esc(label)}</span>
        <span style="color:#4b5563;font-size:11px;margin-left:6px;">${cards.length}</span>
      </td></tr>${rows}`;
  }).join('');

  return renderEmailInfoPanel({
    title: 'Timeline & Due Dates',
    contentHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0"><thead><tr>${headerCells}</tr></thead><tbody>${groupsHtml}</tbody></table>`,
  });
}

function buildAllCardsSection(board: FullBoard, profileById: Map<string, string>, colById: Map<string, string>): string {
  const cards = board.cards.filter(c => !c.is_archived);
  if (cards.length === 0) return '';

  const headerCells = ['Card', 'Column', 'Priority', 'Assignee', 'Due', 'Done'].map(
    h => `<th style="padding:0 10px 6px 0;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap;">${h}</th>`
  ).join('');

  const rows = cards.map(card => `
    <tr>
      <td style="padding:4px 10px 4px 0;color:#d9dfed;font-size:12px;word-break:break-word;">${esc(card.title)}</td>
      <td style="padding:4px 10px 4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${esc(colById.get(card.column_id) ?? '—')}</td>
      <td style="padding:4px 10px 4px 0;">${priorityBadge(card.priority)}</td>
      <td style="padding:4px 10px 4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${esc(getAssigneeName(card, profileById))}</td>
      <td style="padding:4px 10px 4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${fmtDate(card.due_date)}</td>
      <td style="padding:4px 0;">${card.is_complete ? '<span style="color:#34d399;font-size:12px;font-weight:600;">Yes</span>' : '<span style="color:#6b7280;font-size:12px;">No</span>'}</td>
    </tr>`).join('');

  return renderEmailInfoPanel({
    title: `All Cards (${cards.length})`,
    contentHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`,
  });
}

function buildTestEmail(board: FullBoard, profiles: UserProfile[], todayStr: string, baseUrl: string, displayName: string): string {
  const boardUrl = `${baseUrl}/boards/${board.id}`;
  const overviewUrl = `${baseUrl}/boards/${board.id}/overview`;
  const sentAt = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const profileById = new Map(profiles.map(p => [p.id, p.name]));
  const colById = new Map(board.columns.map(c => [c.id, c.title]));

  const leadHtml = `
    <p style="margin:0;color:#9aa4ba;font-size:13px;line-height:1.6;">Hi ${esc(displayName)},</p>
    <p style="margin:8px 0 0;color:#d6deef;font-size:15px;line-height:1.62;"><strong>Test email</strong> — Your overview report for <strong style="color:#ffffff;">${esc(board.title)}</strong>.</p>
    <p style="margin:6px 0 0;color:#6b7280;font-size:12px;">${sentAt}</p>`;

  const actionsHtml = renderEmailButtonRow(
    renderPrimaryEmailButton({ href: overviewUrl, label: 'View Overview' }),
  );

  const s = computeSummary(board, todayStr);
  const summaryHtml = renderEmailInfoPanel({
    title: 'Summary',
    contentHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;">Total Cards</td><td style="padding:4px 0;color:#d9dfed;font-size:13px;font-weight:600;">${s.total}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;">Completed</td><td style="padding:4px 0;color:#d9dfed;font-size:13px;font-weight:600;">${s.completed} (${s.completionPct}%)</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;">Overdue</td><td style="padding:4px 0;color:${s.overdue > 0 ? '#f87171' : '#d9dfed'};font-size:13px;font-weight:600;">${s.overdue}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;">Due Today</td><td style="padding:4px 0;color:#d9dfed;font-size:13px;font-weight:600;">${s.dueToday}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;">Due This Week</td><td style="padding:4px 0;color:#d9dfed;font-size:13px;font-weight:600;">${s.dueThisWeek}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;">High Priority</td><td style="padding:4px 0;color:${s.highPriorityCount > 0 ? '#f87171' : '#d9dfed'};font-size:13px;font-weight:600;">${s.highPriorityCount}</td></tr>
    </table>`,
  });

  const timelineHtml = buildTimelineSection(board, todayStr, profileById, colById);
  const allCardsHtml = buildAllCardsSection(board, profileById, colById);

  const sectionsHtml = [summaryHtml, timelineHtml, allCardsHtml]
    .filter(Boolean)
    .map(html => `<tr><td style="padding-top:16px;">${html}</td></tr>`)
    .join('') +
    `<tr><td style="padding-top:14px;"><p style="margin:0;color:#8f98ad;font-size:12px;line-height:1.6;">This is a test email. If you set up a schedule, emails will be sent automatically at your configured time.</p></td></tr>`;

  const footerHtml = `<p style="margin:0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">Board: <a href="${boardUrl}" style="color:#fa420f;text-decoration:none;">${boardUrl}</a></p>`;

  return renderLumioEmailShell({
    documentTitle: `${board.title} — Test Overview Email`,
    badgeText: 'Test Email',
    headline: `${board.title} — Test Overview`,
    leadHtml,
    actionsHtml,
    sectionsHtml,
    footerHtml,
    baseUrl,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: boardId } = await params;
  const userId = await getAuthUserId(req);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // Verify user owns this board (has access to it)
    const { data: board, error: boardErr } = await db
      .from('project_boards')
      .select('*')
      .eq('id', boardId)
      .maybeSingle();

    if (boardErr || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Fetch board data, columns, and cards
    const [colsRes, cardsRes] = await Promise.all([
      db.from('board_columns').select('*').eq('board_id', boardId).order('position'),
      db.from('board_cards').select('*').eq('board_id', boardId).eq('is_archived', false).order('position'),
    ]);

    const cards = cardsRes.data ?? [];
    const assigneeIds = new Set<string>();
    for (const card of cards) {
      if (card.assignee) assigneeIds.add(card.assignee);
      for (const id of (card.assignees ?? [])) assigneeIds.add(id);
    }

    // Fetch profiles
    const { data: profileRows } = [...assigneeIds].length > 0
      ? await db.from('user_profiles').select('id, name').in('id', [...assigneeIds])
      : { data: [] };

    const profiles: UserProfile[] = (profileRows ?? []).map((p: { id: string; name: string }) => ({
      id: p.id,
      name: p.name ?? 'Unknown',
      updated_at: new Date().toISOString(),
    }));

    // Get user email and name
    const { data: userResult, error: userErr } = await db.auth.admin.getUserById(userId);
    if (userErr || !userResult?.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: userProfile } = await db
      .from('user_profiles')
      .select('name')
      .eq('id', userId)
      .maybeSingle();

    const displayName = userProfile?.name || userResult.user.user_metadata?.name || 'there';
    const toEmail = userResult.user.email;

    // Build the board object
    const fullBoard: FullBoard = {
      ...board,
      columns: (colsRes.data ?? []) as FullBoard['columns'],
      cards: cards as FullBoard['cards'],
      labels: [] as FullBoard['labels'],
      customFields: [] as FullBoard['customFields'],
      boardLinks: [] as FullBoard['boardLinks'],
      boardLinkStats: [] as FullBoard['boardLinkStats'],
    };

    const baseUrl = appBaseUrl();
    const todayStr = getTodayStrInTimezone('UTC'); // Use UTC for test
    const html = buildTestEmail(fullBoard, profiles, todayStr, baseUrl, displayName);

    // Send the email
    const from = process.env.NOTIFICATION_FROM_EMAIL || 'Lumio <notifications@mail.switchcommerce.team>';
    const result = await resend.emails.send({
      from,
      to: toEmail,
      subject: `${board.title} — Test Overview Email`,
      html,
    });

    console.log('[send-overview-email] Resend result:', JSON.stringify(result));

    if (result.error) {
      console.error('[send-overview-email] Resend error:', result.error);
      return NextResponse.json({
        error: `Resend error: ${result.error.message || JSON.stringify(result.error)}`,
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: `Test email sent to ${toEmail}`, id: result.data?.id });
  } catch (error) {
    console.error('[send-overview-email] error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send email',
    }, { status: 500 });
  }
}
