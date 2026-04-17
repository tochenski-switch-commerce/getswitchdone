import { resend } from '@/lib/resend';

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

function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function stripEmojiPrefix(input: string): string {
  return input.replace(/^[^\w\s"']+\s*/u, '').trim() || input;
}

function buildEmailHtml(args: {
  displayName: string;
  title: string;
  body?: string;
  ctaUrl: string;
}): string {
  const safeBody = args.body || 'Open Lumio to view details.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${args.title}</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f1117;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:#1a1d27;border:1px solid #2a2d3a;border-radius:16px;padding:28px;">
          <tr>
            <td style="padding-bottom:16px;">
              <span style="display:inline-block;background:#fa420f;color:#fff;font-size:13px;font-weight:700;padding:6px 10px;border-radius:8px;">Lumio</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:8px;">
              <h1 style="margin:0;color:#f9fafb;font-size:20px;line-height:1.3;">${args.title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.6;">Hi ${args.displayName},</p>
              <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;line-height:1.6;">${safeBody}</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:8px;">
              <a href="${args.ctaUrl}" style="display:inline-block;background:#fa420f;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 18px;border-radius:10px;">Open in Lumio</a>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;border-top:1px solid #2a2d3a;">
              <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">
                You can update email notification settings in Profile & Settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function maybeSendNotificationEmail(args: MaybeSendNotificationEmailArgs): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;

  const { supabaseAdmin, userId, type, title, body, boardId, cardId } = args;

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
  const ctaUrl = boardId
    ? `${baseUrl}/boards/${boardId}${cardId ? `?card=${cardId}` : ''}`
    : `${baseUrl}/boards`;

  try {
    await resend.emails.send({
      from,
      to,
      subject: stripEmojiPrefix(title),
      html: buildEmailHtml({
        displayName,
        title,
        body,
        ctaUrl,
      }),
    });
    return true;
  } catch (err) {
    console.error('[notification-email] send failed:', err);
    return false;
  }
}
