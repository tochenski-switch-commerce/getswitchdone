export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface LumioEmailButtonArgs {
  href: string;
  label: string;
}

export function renderPrimaryEmailButton(args: LumioEmailButtonArgs): string {
  return `<a href="${args.href}" style="display:inline-block;background:#ff6b35;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:11px;">${args.label}</a>`;
}

export function renderSecondaryEmailButton(args: LumioEmailButtonArgs): string {
  return `<a href="${args.href}" style="display:inline-block;background:#1f2638;color:#eaf1ff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:11px;border:1px solid #3a435a;">${args.label}</a>`;
}

export function renderEmailButtonRow(leftButtonHtml: string, rightButtonHtml?: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                <tr>
                  <td style="padding:0 8px 8px 0;">
                    ${leftButtonHtml}
                  </td>
                  ${rightButtonHtml
                    ? `<td style="padding:0 0 8px;">
                        ${rightButtonHtml}
                      </td>`
                    : ''}
                </tr>
              </table>`;
}

interface LumioEmailInfoPanelArgs {
  title: string;
  contentHtml: string;
}

export function renderEmailInfoPanel(args: LumioEmailInfoPanelArgs): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#151926,#131a28);border:1px solid #2a3142;border-radius:14px;padding:16px 16px 10px;">
                <tr>
                  <td style="padding-bottom:12px;">
                    <p style="margin:0;color:#f8fbff;font-size:13px;font-weight:700;letter-spacing:0.35px;text-transform:uppercase;">${args.title}</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    ${args.contentHtml}
                  </td>
                </tr>
              </table>`;
}

interface LumioEmailShellArgs {
  documentTitle: string;
  badgeText: string;
  headline: string;
  leadHtml: string;
  actionsHtml?: string;
  sectionsHtml?: string;
  footerHtml?: string;
}

export function renderLumioEmailShell(args: LumioEmailShellArgs): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${args.documentTitle}</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f1117;background-image:radial-gradient(circle at 10% -20%, #253051 0%, rgba(15,17,23,0) 45%),radial-gradient(circle at 90% -30%, #492823 0%, rgba(15,17,23,0) 40%);min-height:100vh;">
    <tr>
      <td align="center" style="padding:30px 14px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background:#141925;border:1px solid #2a3142;border-radius:18px;padding:28px 24px 24px;">
          <tr>
            <td style="padding-bottom:12px;">
              <span style="display:inline-block;background:linear-gradient(135deg,#ff6b35,#f64612);color:#fff;font-size:12px;font-weight:700;letter-spacing:0.4px;padding:7px 12px;border-radius:999px;text-transform:uppercase;">${args.badgeText}</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:6px;">
              <h1 style="margin:0;color:#f9fafb;font-size:24px;line-height:1.25;letter-spacing:-0.25px;">${args.headline}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:12px;">${args.leadHtml}</td>
          </tr>
          ${args.actionsHtml
            ? `<tr>
                 <td style="padding-top:6px;">${args.actionsHtml}</td>
               </tr>`
            : ''}
          ${args.sectionsHtml || ''}
          ${args.footerHtml
            ? `<tr>
                 <td style="padding-top:18px;border-top:1px solid #2a3142;">${args.footerHtml}</td>
               </tr>`
            : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
