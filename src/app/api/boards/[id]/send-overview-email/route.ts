import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resend } from '@/lib/resend';
import {
  appBaseUrl,
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

// Import the email building functions from the cron route
// (simplified version for test emails)
function buildTestEmail(board: FullBoard, profiles: UserProfile[], todayStr: string, baseUrl: string, displayName: string): string {
  const boardUrl = `${baseUrl}/boards/${board.id}`;
  const printUrl = `${baseUrl}/boards/${board.id}/overview?print=1`;
  const overviewUrl = `${baseUrl}/boards/${board.id}/overview`;

  const sentAt = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const leadHtml = `
    <p style="margin:0;color:#9aa4ba;font-size:13px;line-height:1.6;">Hi ${displayName},</p>
    <p style="margin:8px 0 0;color:#d6deef;font-size:15px;line-height:1.62;"><strong>Test email</strong> — Your overview report for <strong style="color:#ffffff;">${board.title}</strong>.</p>
    <p style="margin:6px 0 0;color:#6b7280;font-size:12px;">${sentAt}</p>`;

  const actionsHtml = renderEmailButtonRow(
    renderPrimaryEmailButton({ href: overviewUrl, label: 'View Overview' }),
    renderSecondaryEmailButton({ href: printUrl, label: 'Printable Version' }),
  );

  // Build summary panel
  const s = computeSummary(board, todayStr);
  const summaryHtml = renderEmailInfoPanel({
    title: 'Summary',
    contentHtml: `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;">Total Cards</td><td style="padding:4px 0;color:#d9dfed;font-size:13px;font-weight:600;">${s.total}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;">Completed</td><td style="padding:4px 0;color:#d9dfed;font-size:13px;font-weight:600;">${s.completed} (${s.completionPct}%)</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8d96ab;font-size:12px;">Overdue</td><td style="padding:4px 0;color:${s.overdue > 0 ? '#f87171' : '#d9dfed'};font-size:13px;font-weight:600;">${s.overdue}</td></tr>
      </table>`,
  });

  const sectionsHtml = `
    <tr><td style="padding-top:16px;">${summaryHtml}</td></tr>
    <tr><td style="padding-top:14px;">
      <p style="margin:0;color:#8f98ad;font-size:12px;line-height:1.6;">
        This is a test email. If you set up a schedule, emails will be sent automatically at your configured time.
      </p>
    </td></tr>`;

  const footerHtml = `
    <p style="margin:0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
      Board: <a href="${boardUrl}" style="color:#fa420f;text-decoration:none;">${boardUrl}</a>
    </p>`;

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
