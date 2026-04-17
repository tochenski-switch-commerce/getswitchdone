import { resend } from '@/lib/resend';
import {
  appBaseUrl,
  escapeHtml,
  renderEmailButtonRow,
  renderEmailInfoPanel,
  renderLumioEmailShell,
  renderPrimaryEmailButton,
  renderSecondaryEmailButton,
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
  } | null;
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

    const [columnRes, labelRes, checklistRes] = await Promise.all([
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
            .select('is_completed, due_date')
            .eq('card_id', cardId)
        : Promise.resolve({ data: [] }),
    ]);

    const nowIsoDate = new Date().toISOString().slice(0, 10);
    const checklistRows: Array<{ is_completed?: boolean; due_date?: string | null }> = checklistRes?.data || [];
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

    return {
      board: boardRes?.data || null,
      card: cardRes?.data || null,
      columnTitle: (columnRes?.data?.title as string | undefined) || null,
      labels,
      checklistSummary,
      checklistItem: checklistItemRes?.data || null,
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

function buildCardDetailsBlock(context: NotificationEmailContext): string {
  if (!context.card) return '';

  const assignees = [context.card.assignee, ...(context.card.assignees || [])]
    .filter((value): value is string => !!value && value.trim().length > 0);
  const uniqueAssignees = [...new Set(assignees)];

  const startDate = formatDateValue(context.card.start_date);
  const dueDate = formatDateValue(context.card.due_date);
  const dueTime = formatTimeValue(context.card.due_time);
  const dueDisplay = dueDate ? `${dueDate}${dueTime ? ` at ${dueTime}` : ''}` : null;
  const description = context.card.description?.trim();
  const descriptionPreview = description
    ? description.length > 260
      ? `${description.slice(0, 257)}...`
      : description
    : null;

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
  }

  const contentHtml = `${descriptionPreview
    ? `<p style="margin:0 0 12px;color:#b9c2d8;font-size:13px;line-height:1.6;">${escapeHtml(descriptionPreview)}</p>`
    : ''}
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
  boardUrl: string;
  cardUrl?: string;
  context: NotificationEmailContext;
}): string {
  const safeTitle = escapeHtml(args.title);
  const safeDisplayName = escapeHtml(args.displayName);
  const safeBody = escapeHtml(args.body || 'Open Lumio to view details.');
  const boardName = args.context.board?.title ? escapeHtml(args.context.board.title) : 'your board';
  const contextLine = args.cardUrl
    ? `This update is linked to ${boardName} and a card in Lumio.`
    : `This update is linked to ${boardName} in Lumio.`;
  const safeContextLine = escapeHtml(contextLine);
  const notificationTypeLabel = args.type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  const leadHtml = `<p style="margin:0;color:#9aa4ba;font-size:13px;line-height:1.6;">Hi ${safeDisplayName},</p>
              <p style="margin:8px 0 0;color:#d6deef;font-size:15px;line-height:1.62;">${safeBody}</p>
              <p style="margin:8px 0 0;color:#a5afc4;font-size:13px;line-height:1.55;">${safeContextLine}</p>`;

  const actionsHtml = renderEmailButtonRow(
    renderPrimaryEmailButton({ href: args.boardUrl, label: 'Open Board' }),
    args.cardUrl ? renderSecondaryEmailButton({ href: args.cardUrl, label: 'Open Card' }) : undefined,
  );

  const sectionsHtml = `${buildCardDetailsBlock(args.context)}
          <tr>
            <td style="padding-top:14px;">
              <p style="margin:0;color:#8f98ad;font-size:12px;line-height:1.6;">
                Notification type: ${escapeHtml(notificationTypeLabel)}
              </p>
            </td>
          </tr>`;

  const footerHtml = `<p style="margin:0;color:#6f7891;font-size:12px;line-height:1.55;">
                You can update email notification settings in Profile & Settings.
              </p>
              <p style="margin:8px 0 0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
                Board link: <a href="${args.boardUrl}" style="color:#ff8a5f;text-decoration:none;">${args.boardUrl}</a>
              </p>
              ${args.cardUrl
                ? `<p style="margin:4px 0 0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
                    Card link: <a href="${args.cardUrl}" style="color:#ff8a5f;text-decoration:none;">${args.cardUrl}</a>
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
  });
}

export async function maybeSendNotificationEmail(args: MaybeSendNotificationEmailArgs): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;

  const { supabaseAdmin, userId, type, title, body, boardId, cardId, checklistItemId } = args;

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
        boardUrl,
        cardUrl,
        context,
      }),
    });
    return true;
  } catch (err) {
    console.error('[notification-email] send failed:', err);
    return false;
  }
}
