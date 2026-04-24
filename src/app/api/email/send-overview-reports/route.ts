import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resend } from '@/lib/resend';
import { computeNextSendAt } from '@/lib/schedule-utils';
import {
  appBaseUrl,
  escapeHtml,
  renderEmailButtonRow,
  renderEmailInfoPanel,
  renderLumioEmailShell,
  renderPrimaryEmailButton,
  renderSecondaryEmailButton,
} from '@/lib/email-theme';
import {
  computeSummary,
  computePriorityBreakdown,
  computeAssigneeWorkload,
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

function esc(s: string) {
  return escapeHtml(s);
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

function buildSummaryPanel(board: FullBoard, todayStr: string): string {
  const s = computeSummary(board, todayStr);
  const rows = [
    { label: 'Total Cards',    value: String(s.total) },
    { label: 'Completed',      value: `${s.completed} (${s.completionPct}%)` },
    { label: 'Overdue',        value: String(s.overdue),           alert: s.overdue > 0 },
    { label: 'Due Today',      value: String(s.dueToday) },
    { label: 'Due This Week',  value: String(s.dueThisWeek) },
    { label: 'High Priority',  value: String(s.highPriorityCount), alert: s.highPriorityCount > 0 },
  ];

  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;white-space:nowrap;vertical-align:top;">${esc(r.label)}</td>
      <td style="padding:4px 0;color:${r.alert ? '#f87171' : '#d9dfed'};font-size:13px;font-weight:600;">${esc(r.value)}</td>
    </tr>`).join('');

  return renderEmailInfoPanel({
    title: 'Summary',
    contentHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>`,
  });
}

function buildPriorityPanel(board: FullBoard): string {
  const p = computePriorityBreakdown(board);
  if (p.total === 0) return '';

  const entries: [string, number, string][] = [
    ['Urgent', p.urgent, '#f87171'],
    ['High',   p.high,   '#fb923c'],
    ['Medium', p.medium, '#fbbf24'],
    ['Low',    p.low,    '#34d399'],
    ['None',   p.none,   '#6b7280'],
  ].filter(([, count]) => (count as number) > 0) as [string, number, string][];

  const rows = entries.map(([label, count, color]) => {
    const pct = Math.round((count / p.total) * 100);
    return `<tr>
      <td style="padding:4px 10px 4px 0;color:${color};font-size:12px;font-weight:600;white-space:nowrap;width:60px;">${esc(label)}</td>
      <td style="padding:4px 8px 4px 0;width:100%;">
        <div style="background:#1f2638;border-radius:3px;height:8px;overflow:hidden;">
          <div style="background:${color};width:${pct}%;height:8px;border-radius:3px;opacity:0.75;"></div>
        </div>
      </td>
      <td style="padding:4px 0;color:#8d96ab;font-size:12px;white-space:nowrap;">${count} (${pct}%)</td>
    </tr>`;
  }).join('');

  return renderEmailInfoPanel({
    title: 'Priority Breakdown',
    contentHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`,
  });
}

function buildAssigneePanel(board: FullBoard, profiles: UserProfile[], todayStr: string): string {
  const workload = computeAssigneeWorkload(board, profiles, todayStr);
  if (workload.length === 0) return '';

  const headerCells = ['Assignee', 'Total', 'Done', 'Overdue', '%'].map(
    h => `<th style="padding:0 10px 8px 0;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap;">${h}</th>`
  ).join('');

  const rows = workload.map(({ name, total, completed, overdue, completionPct }) => `
    <tr>
      <td style="padding:5px 10px 5px 0;color:#d9dfed;font-size:13px;">${esc(name)}</td>
      <td style="padding:5px 10px 5px 0;color:#8d96ab;font-size:13px;">${total}</td>
      <td style="padding:5px 10px 5px 0;color:#34d399;font-size:13px;">${completed}</td>
      <td style="padding:5px 10px 5px 0;color:${overdue > 0 ? '#f87171' : '#6b7280'};font-size:13px;">${overdue}</td>
      <td style="padding:5px 0;color:${completionPct >= 75 ? '#34d399' : '#9ca3af'};font-size:13px;">${completionPct}%</td>
    </tr>`).join('');

  return renderEmailInfoPanel({
    title: 'Assignee Workload',
    contentHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

function buildTimelinePanel(board: FullBoard, todayStr: string, profiles: UserProfile[]): string {
  const tl = computeTimeline(board, todayStr);
  const colById = new Map(board.columns.map(c => [c.id, c.title]));
  const profileById = new Map(profiles.map(p => [p.id, p.name]));

  const getAssignee = (card: FullBoard['cards'][number]) => {
    const ids = (card.assignees && card.assignees.length > 0) ? card.assignees : (card.assignee ? [card.assignee] : []);
    return ids.length > 0 ? (profileById.get(ids[0]) ?? '—') : '—';
  };

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
        <td style="padding:4px 10px 4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${esc(getAssignee(card))}</td>
        <td style="padding:4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${fmtDate(card.due_date)}</td>
      </tr>`).join('');

    return `
      <tr><td colspan="5" style="padding:12px 0 4px;">
        <span style="color:${color};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${esc(label)}</span>
        <span style="color:#4b5563;font-size:11px;margin-left:6px;">${cards.length}</span>
      </td></tr>
      ${rows}`;
  }).join('');

  return renderEmailInfoPanel({
    title: 'Timeline & Due Dates',
    contentHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${groupsHtml}</tbody>
    </table>`,
  });
}

function buildAllCardsPanel(board: FullBoard, profiles: UserProfile[]): string {
  const colById = new Map(board.columns.map(c => [c.id, c.title]));
  const profileById = new Map(profiles.map(p => [p.id, p.name]));
  const cards = board.cards.filter(c => !c.is_archived);

  if (cards.length === 0) return '';

  const getAssignee = (card: FullBoard['cards'][number]) => {
    const ids = (card.assignees && card.assignees.length > 0) ? card.assignees : (card.assignee ? [card.assignee] : []);
    return ids.length > 0 ? (profileById.get(ids[0]) ?? '—') : '—';
  };

  const headerCells = ['Card', 'Column', 'Priority', 'Assignee', 'Due', 'Done'].map(
    h => `<th style="padding:0 10px 6px 0;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap;">${h}</th>`
  ).join('');

  const rows = cards.map(card => {
    const doneHtml = card.is_complete
      ? `<span style="color:#34d399;font-size:12px;font-weight:600;">Yes</span>`
      : `<span style="color:#6b7280;font-size:12px;">No</span>`;
    return `
      <tr>
        <td style="padding:4px 10px 4px 0;color:#d9dfed;font-size:12px;word-break:break-word;">${esc(card.title)}</td>
        <td style="padding:4px 10px 4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${esc(colById.get(card.column_id) ?? '—')}</td>
        <td style="padding:4px 10px 4px 0;">${priorityBadge(card.priority)}</td>
        <td style="padding:4px 10px 4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${esc(getAssignee(card))}</td>
        <td style="padding:4px 10px 4px 0;color:#6b7280;font-size:12px;white-space:nowrap;">${fmtDate(card.due_date)}</td>
        <td style="padding:4px 0;">${doneHtml}</td>
      </tr>`;
  }).join('');

  return renderEmailInfoPanel({
    title: `All Cards (${cards.length})`,
    contentHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

function buildOverviewEmail(args: {
  board: FullBoard;
  profiles: UserProfile[];
  todayStr: string;
  baseUrl: string;
  displayName: string;
  frequency: string;
  timeLabel: string;
}): string {
  const { board, profiles, todayStr, baseUrl, displayName, frequency, timeLabel } = args;
  const boardUrl = `${baseUrl}/boards/${board.id}`;
  const printUrl = `${baseUrl}/boards/${board.id}/overview?print=1`;
  const overviewUrl = `${baseUrl}/boards/${board.id}/overview`;

  const sentAt = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const scheduleLabel = frequency === 'daily' ? `Daily at ${timeLabel}` : `Weekly on ${timeLabel}`;

  const leadHtml = `
    <p style="margin:0;color:#9aa4ba;font-size:13px;line-height:1.6;">Hi ${esc(displayName)},</p>
    <p style="margin:8px 0 0;color:#d6deef;font-size:15px;line-height:1.62;">Here's your ${esc(frequency)} overview report for <strong style="color:#ffffff;">${esc(board.title)}</strong>.</p>
    <p style="margin:6px 0 0;color:#6b7280;font-size:12px;">${esc(sentAt)} · ${esc(scheduleLabel)}</p>`;

  const actionsHtml = renderEmailButtonRow(
    renderPrimaryEmailButton({ href: overviewUrl, label: 'View Overview' }),
  );

  const summaryHtml = buildSummaryPanel(board, todayStr);
  const priorityHtml = buildPriorityPanel(board);
  const assigneeHtml = buildAssigneePanel(board, profiles, todayStr);
  const timelineHtml = buildTimelinePanel(board, todayStr, profiles);
  const allCardsHtml = buildAllCardsPanel(board, profiles);

  const sectionsHtml = [summaryHtml, priorityHtml, assigneeHtml, timelineHtml, allCardsHtml]
    .filter(Boolean)
    .map(html => `<tr><td style="padding-top:16px;">${html}</td></tr>`)
    .join('') +
    `<tr><td style="padding-top:14px;">
      <p style="margin:0;color:#8f98ad;font-size:12px;line-height:1.6;">
        This is a scheduled overview report. You can manage your schedule from the Overview page in Lumio.
      </p>
    </td></tr>`;

  const footerHtml = `
    <p style="margin:0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
      Board: <a href="${boardUrl}" style="color:#fa420f;text-decoration:none;">${boardUrl}</a>
    </p>
    <p style="margin:4px 0 0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
      Printable version: <a href="${printUrl}" style="color:#fa420f;text-decoration:none;">${printUrl}</a>
    </p>`;

  return renderLumioEmailShell({
    documentTitle: `${board.title} — Overview Report`,
    badgeText: 'Overview Report',
    headline: `${board.title} — Overview`,
    leadHtml,
    actionsHtml,
    sectionsHtml,
    footerHtml,
    baseUrl,
  });
}

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET || process.env.PUSH_WEBHOOK_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  // Fetch all schedules due to send
  const { data: schedules, error: schedulesErr } = await db
    .from('board_overview_schedules')
    .select('id, board_id, user_id, frequency, time_of_day, day_of_week, timezone, next_send_at')
    .lte('next_send_at', now.toISOString());

  if (schedulesErr) {
    return NextResponse.json({ error: schedulesErr.message }, { status: 500 });
  }
  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const baseUrl = appBaseUrl();
  const from = process.env.NOTIFICATION_FROM_EMAIL || 'Lumio <notifications@mail.switchcommerce.team>';
  let sent = 0;

  for (const schedule of schedules) {
    try {
      // Fetch board data
      const [boardRes, colsRes, cardsRes] = await Promise.all([
        db.from('project_boards').select('*').eq('id', schedule.board_id).single(),
        db.from('board_columns').select('*').eq('board_id', schedule.board_id).order('position'),
        db.from('board_cards').select('*').eq('board_id', schedule.board_id).eq('is_archived', false).order('position'),
      ]);

      if (boardRes.error || !boardRes.data) continue;

      // Fetch user email
      const { data: userResult, error: userErr } = await db.auth.admin.getUserById(schedule.user_id);
      if (userErr || !userResult?.user?.email) continue;
      const toEmail = userResult.user.email;

      // Fetch profiles for assignees in this board
      const cards = cardsRes.data ?? [];
      const assigneeIds = new Set<string>();
      for (const card of cards) {
        if (card.assignee) assigneeIds.add(card.assignee);
        for (const id of (card.assignees ?? [])) assigneeIds.add(id);
      }
      const profileIds = [...assigneeIds];
      const { data: profileRows } = profileIds.length > 0
        ? await db.from('user_profiles').select('id, name').in('id', profileIds)
        : { data: [] };

      const profiles: UserProfile[] = (profileRows ?? []).map((p: { id: string; name: string }) => ({
        id: p.id,
        name: p.name ?? 'Unknown',
        updated_at: new Date().toISOString(),
      }));

      // Get user display name
      const { data: userProfile } = await db
        .from('user_profiles')
        .select('name')
        .eq('id', schedule.user_id)
        .maybeSingle();
      const displayName = userProfile?.name || userResult.user.user_metadata?.name || 'there';

      // Build the FullBoard-compatible object
      const board: FullBoard = {
        ...boardRes.data,
        columns: colsRes.data ?? [],
        cards,
        labels: [],
        customFields: [],
        boardLinks: [],
        boardLinkStats: [],
      };

      const todayStr = getTodayStrInTimezone(schedule.timezone);

      // Build time label for the email
      const timeLabel = schedule.frequency === 'weekly'
        ? `${DAY_NAMES[schedule.day_of_week ?? 1]}s at ${fmt12(schedule.time_of_day)}`
        : fmt12(schedule.time_of_day);

      const html = buildOverviewEmail({
        board,
        profiles,
        todayStr,
        baseUrl,
        displayName,
        frequency: schedule.frequency,
        timeLabel,
      });

      await resend.emails.send({
        from,
        to: toEmail,
        subject: `${board.title} — Overview Report`,
        html,
      });

      // Advance next_send_at
      const next = computeNextSendAt(
        schedule.frequency,
        schedule.time_of_day,
        schedule.day_of_week ?? null,
        schedule.timezone,
      );

      await db
        .from('board_overview_schedules')
        .update({ next_send_at: next.toISOString(), updated_at: new Date().toISOString() })
        .eq('id', schedule.id);

      sent++;
    } catch (err) {
      console.error('[send-overview-reports] Error for schedule', schedule.id, err);
    }
  }

  return NextResponse.json({ sent });
}
