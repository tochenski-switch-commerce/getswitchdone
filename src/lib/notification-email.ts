import { resend } from '@/lib/resend';
import {
  appBaseUrl,
  escapeHtml,
  renderEmailButtonRow,
  renderEmailInfoPanel,
  renderLumioEmailShell,
  renderPrimaryEmailButton,
  renderSecondaryEmailButton,
  sanitizeCommentHtmlForEmail,
} from '@/lib/email-theme';

export type EmailNotificationType =
  | 'assignment'
  | 'mention'
  | 'comment'
  | 'comment_reaction'
  | 'due_soon'
  | 'due_now'
  | 'overdue'
  | 'checklist_overdue'
  | 'email_unrouted';

interface NotificationSettings {
  email_notifications_enabled: boolean;
  due_soon_notifications_enabled: boolean;
  comment_notifications_enabled: boolean;
  assignment_notifications_enabled: boolean;
}

interface MaybeSendNotificationEmailArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
  userId: string;
  type: EmailNotificationType;
  title: string;
  body?: string;
  richBodyHtml?: string;
  boardId?: string;
  cardId?: string;
  checklistItemId?: string;
}

interface NotificationEmailContext {
  board: {
    id: string;
    title: string;
    description?: string | null;
  } | null;
  card: {
    id: string;
    title: string;
    description?: string | null;
    priority?: string | null;
    start_date?: string | null;
    due_date?: string | null;
    due_time?: string | null;
    assignee?: string | null;
    assignees?: string[] | null;
    assigneeNames?: string[];
    is_complete?: boolean | null;
    column_id?: string | null;
  } | null;
  columnTitle: string | null;
  labels: Array<{ name: string; color?: string | null }>;
  checklistSummary: {
    total: number;
    completed: number;
    overdue: number;
  } | null;
  checklistItem: {
    id: string;
    title: string;
    due_date?: string | null;
    assignees?: string[] | null;
    assigneeNames?: string[];
  } | null;
  checklistItems: Array<{
    id: string;
    title: string;
    isCompleted: boolean;
    dueDate: string | null;
    assigneeNames: string[];
  }>;
  recentComments: Array<{
    authorName: string;
    content: string;
    createdAt: string;
  }>;
}

function normalizeSettings(raw: Partial<NotificationSettings> | null | undefined): NotificationSettings {
  return {
    email_notifications_enabled: raw?.email_notifications_enabled ?? true,
    due_soon_notifications_enabled: raw?.due_soon_notifications_enabled ?? true,
    comment_notifications_enabled: raw?.comment_notifications_enabled ?? true,
    assignment_notifications_enabled: raw?.assignment_notifications_enabled ?? true,
  };
}

function shouldSendForType(settings: NotificationSettings, type: EmailNotificationType): boolean {
  if (!settings.email_notifications_enabled) return false;

  if (type === 'assignment') return settings.assignment_notifications_enabled;
  if (type === 'mention' || type === 'comment' || type === 'comment_reaction') return settings.comment_notifications_enabled;
  if (type === 'due_soon' || type === 'due_now' || type === 'overdue' || type === 'checklist_overdue') {
    return settings.due_soon_notifications_enabled;
  }

  return true;
}

function stripEmojiPrefix(input: string): string {
  return input.replace(/^[^\w\s"']+\s*/u, '').trim() || input;
}

function formatDateValue(date?: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(date.includes('T') ? date : `${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeValue(time?: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map((part) => Number(part));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveProfileNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  userIds: string[],
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(userIds.filter((value) => !!value && isUuid(value)))];
  if (!uniqueIds.length) return {};

  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, name')
    .in('id', uniqueIds);

  const nameMap: Record<string, string> = {};
  for (const p of profiles || []) nameMap[p.id] = p.name || 'Someone';
  return nameMap;
}

function resolveAssigneeNames(values: Array<string | null | undefined>, nameMap: Record<string, string>): string[] {
  return [...new Set(values.filter((value): value is string => !!value && value.trim().length > 0))].map((value) => nameMap[value] || value);
}

function resolveCommentAuthors(
  rows: Array<{ id: string; content: string; created_at: string; user_id: string }>,
  nameMap: Record<string, string>,
): Array<{ authorName: string; content: string; createdAt: string }> {
  return rows.map((r) => ({
    authorName: nameMap[r.user_id] || 'Someone',
    content: r.content,
    createdAt: r.created_at,
  }));
}

async function fetchNotificationContext(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
  boardId?: string;
  cardId?: string;
  checklistItemId?: string;
}): Promise<NotificationEmailContext> {
  const { supabaseAdmin, boardId, cardId, checklistItemId } = args;
  const fallbackContext: NotificationEmailContext = {
    board: null,
    card: null,
    columnTitle: null,
    labels: [],
    checklistSummary: null,
    checklistItem: null,
    checklistItems: [],
    recentComments: [],
  };

  try {
    const [boardRes, cardRes, checklistItemRes] = await Promise.all([
      boardId
        ? supabaseAdmin
            .from('project_boards')
            .select('id, title, description')
            .eq('id', boardId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      cardId
        ? supabaseAdmin
            .from('board_cards')
            .select('id, title, description, priority, start_date, due_date, due_time, assignee, assignees, is_complete, column_id')
            .eq('id', cardId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      checklistItemId
        ? supabaseAdmin
            .from('card_checklists')
            .select('id, title, due_date, assignees')
            .eq('id', checklistItemId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const columnId = cardRes?.data?.column_id as string | null | undefined;

    const [columnRes, labelRes, checklistRes, commentsRes] = await Promise.all([
      columnId
        ? supabaseAdmin
            .from('board_columns')
            .select('title')
            .eq('id', columnId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      cardId
        ? supabaseAdmin
            .from('card_label_assignments')
            .select('board_labels(name, color)')
            .eq('card_id', cardId)
        : Promise.resolve({ data: [] }),
      cardId
        ? supabaseAdmin
            .from('card_checklists')
            .select('id, title, is_completed, due_date, assignees, position')
            .eq('card_id', cardId)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [] }),
      cardId
      ? supabaseAdmin
        .from('card_comments')
        .select('id, content, created_at, user_id')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(3)
      : Promise.resolve({ data: [] }),
    ]);

    const nowIsoDate = new Date().toISOString().slice(0, 10);
    const checklistRows: Array<{ id: string; title: string; is_completed?: boolean; due_date?: string | null; assignees?: string[] | null; position?: number }> = checklistRes?.data || [];
    const checklistSummary = checklistRows.length
      ? {
          total: checklistRows.length,
          completed: checklistRows.filter((item) => !!item.is_completed).length,
          overdue: checklistRows.filter((item) => !item.is_completed && !!item.due_date && item.due_date.slice(0, 10) < nowIsoDate).length,
        }
      : null;

    const labels: Array<{ name: string; color?: string | null }> = (labelRes?.data || [])
      .map((row: { board_labels?: { name?: string; color?: string | null } | Array<{ name?: string; color?: string | null }> }) => {
        const nested = row.board_labels;
        if (Array.isArray(nested)) return nested[0];
        return nested;
      })
      .filter((row: { name?: string } | undefined | null): row is { name: string; color?: string | null } => !!row?.name)
      .map((row: { name: string; color?: string | null }) => ({ name: row.name, color: row.color || null }));

    const profileNameMap = await resolveProfileNames(supabaseAdmin, [
      cardRes?.data?.assignee,
      ...((cardRes?.data?.assignees as string[] | null | undefined) || []),
      ...((checklistItemRes?.data?.assignees as string[] | null | undefined) || []),
      ...((commentsRes?.data || []).map((row: { user_id: string }) => row.user_id)),
      ...checklistRows.flatMap((row) => row.assignees || []),
    ].filter((value): value is string => !!value));

    const cardData = cardRes?.data
      ? {
          ...cardRes.data,
          assigneeNames: resolveAssigneeNames(
            [cardRes.data.assignee, ...((cardRes.data.assignees as string[] | null | undefined) || [])],
            profileNameMap,
          ),
        }
      : null;

    const checklistItemData = checklistItemRes?.data
      ? {
          ...checklistItemRes.data,
          assigneeNames: resolveAssigneeNames(checklistItemRes.data.assignees || [], profileNameMap),
        }
      : null;

    return {
      board: boardRes?.data || null,
      card: cardData,
      columnTitle: (columnRes?.data?.title as string | undefined) || null,
      labels,
      checklistSummary,
      checklistItem: checklistItemData,
      checklistItems: checklistRows.map((row) => ({
        id: row.id,
        title: row.title,
        isCompleted: !!row.is_completed,
        dueDate: row.due_date || null,
        assigneeNames: resolveAssigneeNames(row.assignees || [], profileNameMap),
      })),
      recentComments: resolveCommentAuthors(commentsRes?.data || [], profileNameMap),
    };
  } catch {
    return fallbackContext;
  }
}

function renderMetaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:0 0 8px;vertical-align:top;width:108px;">
      <span style="display:inline-block;color:#8d96ab;font-size:12px;font-weight:600;line-height:1.4;letter-spacing:0.2px;">${escapeHtml(label)}</span>
    </td>
    <td style="padding:0 0 8px;vertical-align:top;">
      <span style="display:inline-block;color:#d9dfed;font-size:13px;line-height:1.5;">${escapeHtml(value)}</span>
    </td>
  </tr>`;
}

function renderDescriptionPreview(description?: string | null): string {
  const trimmed = description?.trim();
  if (!trimmed) return '';

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  if (looksLikeHtml) {
    return `<div style="margin:0 0 12px;color:#b9c2d8;font-size:13px;line-height:1.6;">${sanitizeCommentHtmlForEmail(trimmed)}</div>`;
  }

  const preview = trimmed.length > 260 ? `${trimmed.slice(0, 257)}...` : trimmed;
  return `<p style="margin:0 0 12px;color:#b9c2d8;font-size:13px;line-height:1.6;">${escapeHtml(preview)}</p>`;
}

function buildChecklistBlock(context: NotificationEmailContext): string {
  if (!context.checklistItems.length) return '';

  const nowIso = new Date().toISOString().slice(0, 10);

  const itemRows = context.checklistItems.map((item) => {
    const dueDateLabel = formatDateValue(item.dueDate);
    const isOverdue = !item.isCompleted && !!item.dueDate && item.dueDate.slice(0, 10) < nowIso;
    const checkMark = item.isCompleted
      ? `<span style="display:inline-block;width:16px;height:16px;border-radius:4px;background-color:#22c55e;text-align:center;line-height:16px;font-size:11px;color:#fff;font-weight:700;vertical-align:middle;">&#10003;</span>`
      : `<span style="display:inline-block;width:16px;height:16px;border-radius:4px;border:2px solid #3a435a;background-color:#1a2035;vertical-align:middle;"></span>`;
    const titleColor = item.isCompleted ? '#6f7891' : '#d9dfed';
    const titleDecoration = item.isCompleted ? 'text-decoration:line-through;' : '';
    const meta: string[] = [];
    if (dueDateLabel) {
      const dateColor = isOverdue ? '#f87171' : '#8d96ab';
      meta.push(`<span style="color:${dateColor};font-size:11px;">${escapeHtml(dueDateLabel)}${isOverdue ? ' · overdue' : ''}</span>`);
    }
    if (item.assigneeNames.length) {
      meta.push(`<span style="color:#8d96ab;font-size:11px;">${escapeHtml(item.assigneeNames.join(', '))}</span>`);
    }
    return `<tr>
      <td style="padding:0 0 10px;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="width:22px;vertical-align:top;padding-top:1px;">${checkMark}</td>
            <td style="vertical-align:top;">
              <span style="color:${titleColor};font-size:13px;line-height:1.5;${titleDecoration}">${escapeHtml(item.title)}</span>
              ${meta.length ? `<br/><span style="display:inline-block;margin-top:2px;">${meta.join('<span style="color:#3a435a;margin:0 5px;">·</span>')}</span>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  });

  const completed = context.checklistItems.filter((i) => i.isCompleted).length;
  const total = context.checklistItems.length;

  const contentHtml = `<p style="margin:0 0 12px;color:#8d96ab;font-size:12px;">${escapeHtml(`${completed}/${total} completed`)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${itemRows.join('')}
    </table>`;

  return `<tr>
    <td style="padding-top:18px;">
      ${renderEmailInfoPanel({ title: 'Checklist', contentHtml })}
    </td>
  </tr>`;
}

function buildRecentCommentsBlock(context: NotificationEmailContext): string {
  if (!context.recentComments.length) return '';

  const commentItems = context.recentComments.map((c) => {
    const date = new Date(c.createdAt);
    const dateLabel = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sanitized = sanitizeCommentHtmlForEmail(c.content);
    return `<tr>
      <td style="padding:0 0 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-bottom:4px;">
              <span style="color:#eaf1ff;font-size:13px;font-weight:700;">${escapeHtml(c.authorName)}</span>
              ${dateLabel ? `<span style="color:#5d667f;font-size:12px;margin-left:8px;">${escapeHtml(dateLabel)}</span>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding-left:0;">
              <div style="color:#c9d3ea;font-size:13px;line-height:1.6;">${sanitized}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  });

  const contentHtml = `<table width="100%" cellpadding="0" cellspacing="0" border="0">
    ${commentItems.join('')}
  </table>`;

  return `<tr>
    <td style="padding-top:18px;">
      ${renderEmailInfoPanel({ title: 'Recent Comments', contentHtml })}
    </td>
  </tr>`;
}

function buildCardDetailsBlock(context: NotificationEmailContext): string {
  if (!context.card) return '';

  const uniqueAssignees = context.card.assigneeNames || [];

  const startDate = formatDateValue(context.card.start_date);
  const dueDate = formatDateValue(context.card.due_date);
  const dueTime = formatTimeValue(context.card.due_time);
  const dueDisplay = dueDate ? `${dueDate}${dueTime ? ` at ${dueTime}` : ''}` : null;
  const descriptionPreviewHtml = renderDescriptionPreview(context.card.description);

  const rows: string[] = [
    renderMetaRow('Card', context.card.title),
    renderMetaRow('Status', context.card.is_complete ? 'Complete' : 'Open'),
  ];

  if (context.columnTitle) rows.push(renderMetaRow('Board Column', context.columnTitle));
  if (context.card.priority) rows.push(renderMetaRow('Priority', context.card.priority));
  if (startDate) rows.push(renderMetaRow('Start Date', startDate));
  if (dueDisplay) rows.push(renderMetaRow('Due', dueDisplay));
  if (uniqueAssignees.length > 0) rows.push(renderMetaRow('Assignees', uniqueAssignees.join(', ')));
  if (context.labels.length > 0) rows.push(renderMetaRow('Labels', context.labels.map((label) => label.name).join(', ')));

  if (context.checklistSummary) {
    const checklistLine = `${context.checklistSummary.completed}/${context.checklistSummary.total} completed`;
    const withOverdue = context.checklistSummary.overdue > 0
      ? `${checklistLine} • ${context.checklistSummary.overdue} overdue`
      : checklistLine;
    rows.push(renderMetaRow('Checklist', withOverdue));
  }

  if (context.checklistItem) {
    const checklistDue = formatDateValue(context.checklistItem.due_date);
    rows.push(renderMetaRow('Checklist Item', context.checklistItem.title));
    if (checklistDue) rows.push(renderMetaRow('Item Due', checklistDue));
    if (context.checklistItem.assigneeNames?.length) {
      rows.push(renderMetaRow('Item Assignees', context.checklistItem.assigneeNames.join(', ')));
    }
  }

  const contentHtml = `${descriptionPreviewHtml}
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rows.join('')}
            </table>`;

  return `<tr>
    <td style="padding-top:18px;">
      ${renderEmailInfoPanel({
        title: 'Card Snapshot',
        contentHtml,
      })}
    </td>
  </tr>`;
}

function buildEmailHtml(args: {
  displayName: string;
  type: EmailNotificationType;
  title: string;
  body?: string;
  richBodyHtml?: string;
  boardUrl: string;
  cardUrl?: string;
  context: NotificationEmailContext;
  baseUrl: string;
}): string {
  const safeTitle = escapeHtml(args.title);
  const safeDisplayName = escapeHtml(args.displayName);
  const boardName = args.context.board?.title ? escapeHtml(args.context.board.title) : 'your board';
  const contextLine = args.cardUrl
    ? `This update is linked to ${boardName} and a card in Lumio.`
    : `This update is linked to ${boardName} in Lumio.`;
  const safeContextLine = escapeHtml(contextLine);
  const notificationTypeLabel = args.type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  const bodyContent = args.richBodyHtml
    ? `<div style="margin:8px 0 0;">${sanitizeCommentHtmlForEmail(args.richBodyHtml)}</div>`
    : `<p style="margin:8px 0 0;color:#d6deef;font-size:15px;line-height:1.62;">${escapeHtml(args.body || 'Open Lumio to view details.')}</p>`;

  const leadHtml = `<p style="margin:0;color:#9aa4ba;font-size:13px;line-height:1.6;">Hi ${safeDisplayName},</p>
              ${bodyContent}
              <p style="margin:8px 0 0;color:#a5afc4;font-size:13px;line-height:1.55;">${safeContextLine}</p>`;

  const actionsHtml = args.cardUrl
    ? renderEmailButtonRow(
        renderPrimaryEmailButton({ href: args.cardUrl, label: 'Open Card' }),
        renderSecondaryEmailButton({ href: args.boardUrl, label: 'Open Board' }),
      )
    : renderEmailButtonRow(
        renderPrimaryEmailButton({ href: args.boardUrl, label: 'Open Board' }),
      );

    const sectionsHtml = `${buildCardDetailsBlock(args.context)}
      ${buildChecklistBlock(args.context)}
      ${buildRecentCommentsBlock(args.context)}
          <tr>
            <td style="padding-top:14px;">
              <p style="margin:0;color:#8f98ad;font-size:12px;line-height:1.6;">
                Notification type: ${escapeHtml(notificationTypeLabel)}
              </p>
            </td>
          </tr>`;

  const footerHtml = `<p style="margin:0;color:#6f7891;font-size:12px;line-height:1.55;">
                You can update email notification settings in Profile &amp; Settings.
              </p>
              <p style="margin:8px 0 0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
                Board link: <a href="${args.boardUrl}" style="color:#fa420f;text-decoration:none;">${args.boardUrl}</a>
              </p>
              ${args.cardUrl
                ? `<p style="margin:4px 0 0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
                    Card link: <a href="${args.cardUrl}" style="color:#fa420f;text-decoration:none;">${args.cardUrl}</a>
                  </p>`
                : ''}`;

  return renderLumioEmailShell({
    documentTitle: safeTitle,
    badgeText: 'Lumio Notification',
    headline: safeTitle,
    leadHtml,
    actionsHtml,
    sectionsHtml,
    footerHtml,
    baseUrl: args.baseUrl,
  });
}

export async function maybeSendNotificationEmail(args: MaybeSendNotificationEmailArgs): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;

  const { supabaseAdmin, userId, type, title, body, richBodyHtml, boardId, cardId, checklistItemId } = args;

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('name, email_notifications_enabled, due_soon_notifications_enabled, comment_notifications_enabled, assignment_notifications_enabled')
    .eq('id', userId)
    .maybeSingle();

  const settings = normalizeSettings(profile);
  if (!shouldSendForType(settings, type)) return false;

  const { data: userResult, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userErr || !userResult?.user?.email) return false;

  const to = userResult.user.email;
  const displayName = profile?.name || userResult.user.user_metadata?.name || 'there';
  const from = process.env.NOTIFICATION_FROM_EMAIL || 'Lumio <notifications@getlumio.app>';
  const baseUrl = appBaseUrl();
  const boardUrl = boardId ? `${baseUrl}/boards/${boardId}` : `${baseUrl}/boards`;
  const cardUrl = boardId && cardId ? `${baseUrl}/boards/${boardId}?card=${cardId}` : undefined;
  const context = await fetchNotificationContext({
    supabaseAdmin,
    boardId,
    cardId,
    checklistItemId,
  });

  try {
    await resend.emails.send({
      from,
      to,
      subject: stripEmojiPrefix(title),
      html: buildEmailHtml({
        displayName,
        type,
        title,
        body,
        richBodyHtml: args.richBodyHtml,
        boardUrl,
        cardUrl,
        context,
        baseUrl,
      }),
    });
    return true;
  } catch (err) {
    console.error('[notification-email] send failed:', err);
    return false;
  }
}
