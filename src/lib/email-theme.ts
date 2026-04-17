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

/**
 * Converts TipTap/ProseMirror HTML from card comments into email-safe
 * inline-styled HTML. Strips dangerous elements and attributes, maps
 * structural tags to inline-styled equivalents compatible with email clients.
 */
export function sanitizeCommentHtmlForEmail(html: string): string {
  if (!html || !html.trim()) return '';

  let safe = html;

  // Strip dangerous elements (and their inner content)
  for (const tag of ['script', 'style', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base']) {
    safe = safe.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    safe = safe.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), '');
  }

  const TEXT_STYLE = 'color:#ffffff !important;font-size:15px;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;';

  // Map structural/formatting tags to email-safe inline-styled versions
  safe = safe
    // Paragraphs
    .replace(/<p\b[^>]*>/gi, `<p style="margin:0 0 8px;${TEXT_STYLE}">`)
    // Headings → styled paragraphs
    .replace(/<h[1-3]\b[^>]*>/gi, `<p style="margin:0 0 10px;color:#f0f4ff;font-size:17px;font-weight:700;line-height:1.4;">`)
    .replace(/<\/h[1-3]>/gi, '</p>')
    .replace(/<h[4-6]\b[^>]*>/gi, `<p style="margin:0 0 8px;color:#eaf1ff;font-size:15px;font-weight:700;line-height:1.5;">`)
    .replace(/<\/h[4-6]>/gi, '</p>')
    // Lists
    .replace(/<ul\b[^>]*>/gi, `<ul style="margin:0 0 8px;padding-left:22px;${TEXT_STYLE}">`)
    .replace(/<ol\b[^>]*>/gi, `<ol style="margin:0 0 8px;padding-left:22px;${TEXT_STYLE}">`)
    .replace(/<li\b[^>]*>/gi, '<li style="margin:0 0 4px;">')
    // Bold
    .replace(/<strong\b[^>]*>/gi, '<strong style="font-weight:700;color:#eaf1ff;">')
    .replace(/<b\b[^>]*>/gi, '<strong style="font-weight:700;color:#eaf1ff;">')
    .replace(/<\/b>/gi, '</strong>')
    // Italic
    .replace(/<em\b[^>]*>/gi, '<em style="font-style:italic;">')
    .replace(/<i\b[^>]*>/gi, '<em style="font-style:italic;">')
    .replace(/<\/i>/gi, '</em>')
    // Strikethrough
    .replace(/<s\b[^>]*>/gi, '<s style="opacity:0.65;">')
    .replace(/<del\b[^>]*>/gi, '<s style="opacity:0.65;">')
    .replace(/<\/del>/gi, '</s>')
    // Inline code
    .replace(/<code\b[^>]*>/gi, '<code style="font-family:\'Menlo\',\'Courier New\',monospace;background:rgba(255,255,255,0.07);padding:2px 5px;border-radius:4px;font-size:13px;color:#d6deef;">')
    // Code block
    .replace(/<pre\b[^>]*>/gi, '<pre style="background:rgba(255,255,255,0.05);padding:10px 14px;border-radius:6px;font-size:13px;color:#c9d3ea;margin:0 0 8px;overflow-x:auto;">')
    // Blockquote
    .replace(/<blockquote\b[^>]*>/gi, '<blockquote style="margin:0 0 8px;padding:8px 12px;border-left:3px solid #fa420f;background:rgba(250,66,15,0.07);border-radius:0 6px 6px 0;">')
    // HR
    .replace(/<hr\b[^>]*\/?>/gi, '<hr style="border:none;border-top:1px solid #2a3142;margin:12px 0;">')
    // Line breaks
    .replace(/<br\b[^>]*\/?>/gi, '<br/>')
    // Spans (mentions etc.) — strip all attributes, keep content
    .replace(/<span\b[^>]*>/gi, `<span style="${TEXT_STYLE}">`);

  // Handle <a> tags — keep only safe http/https hrefs
  safe = safe.replace(/<a\b[^>]*>/gi, (match: string) => {
    const hrefMatch = /href=["']([^"']*?)["']/i.exec(match);
    if (hrefMatch) {
      const href = hrefMatch[1];
      if (/^https?:\/\//i.test(href)) {
        const safeHref = href.replace(/"/g, '&quot;');
        return `<a href="${safeHref}" style="color:#fa420f;text-decoration:underline;" target="_blank" rel="noopener noreferrer">`;
      }
    }
    return '<a style="color:#fa420f;text-decoration:underline;">';
  });

  // Strip all remaining unrecognised/unhandled open and close tags (keep content)
  safe = safe.replace(/<\/?(?!(p|ul|ol|li|strong|em|s|a|code|pre|blockquote|hr|br|span)\b)[a-z][a-z0-9]*\b[^>]*>/gi, '');

  // Strip any remaining on* event attributes (final safety pass)
  safe = safe.replace(/\s+on\w+="[^"]*"/gi, '').replace(/\s+on\w+='[^']*'/gi, '');

  return safe.trim();
}

interface LumioEmailButtonArgs {
  href: string;
  label: string;
}

export function renderPrimaryEmailButton(args: LumioEmailButtonArgs): string {
  return `<a href="${args.href}" style="display:inline-block;background:#fa420f;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:11px;">${args.label}</a>`;
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
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#151926;background:linear-gradient(160deg,#151926,#131a28);border:1px solid #2a3142;border-radius:14px;padding:16px 16px 10px;">
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
  baseUrl: string;
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
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background-color:#141925;background:#141925;border:1px solid #2a3142;border-radius:18px;padding:28px 24px 24px;">
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <img src="${args.baseUrl}/icons/icon-192.png" width="36" height="36" alt="Lumio" style="display:block;border-radius:9px;border:0;" />
                  </td>
                  <td style="vertical-align:middle;line-height:1;">
                    <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Lumio</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:12px;">
              <span style="display:inline-block;background-color:#fa420f;background:linear-gradient(135deg,#fa420f,#e03508);color:#fff;font-size:12px;font-weight:700;letter-spacing:0.4px;padding:7px 12px;border-radius:999px;text-transform:uppercase;">${args.badgeText}</span>
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
</html>`
}
