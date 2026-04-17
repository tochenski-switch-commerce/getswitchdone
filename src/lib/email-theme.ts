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

  const TEXT_STYLE = 'color:#d6deef;font-size:15px;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;';

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
          <tr>            <td align="center" style="padding-bottom:22px;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 0 851 290" width="116" height="40" role="img" aria-label="Lumio">
                <path fill-rule="evenodd" fill="#ffffff" transform="translate(0, -3.891)" d="M836.649,243.604 C828.405,257.165 817.226,267.951 803.100,275.964 C788.974,283.982 772.961,287.989 755.072,287.989 C737.177,287.989 721.169,283.982 707.043,275.964 C692.918,267.951 681.733,257.104 673.494,243.427 C665.251,229.756 661.134,214.427 661.134,197.451 C661.134,180.713 665.195,165.622 673.318,152.183 C681.440,138.744 692.564,128.078 706.690,120.176 C720.816,112.280 736.940,108.329 755.072,108.329 C772.729,108.329 788.676,112.219 802.923,119.100 C817.165,127.780 828.405,138.451 836.649,152.006 C844.887,165.567 849.009,180.713 849.009,197.451 C849.009,214.665 844.887,230.049 836.649,243.604 ZM788.621,177.116 C785.321,171.104 780.791,166.390 775.024,162.969 C769.253,159.554 762.604,157.841 755.072,157.841 C747.534,157.841 740.824,159.554 734.942,162.969 C729.055,166.390 724.464,171.164 721.169,177.293 C717.870,183.426 716.225,190.262 716.225,197.805 C716.225,205.823 717.870,212.957 721.169,219.201 C724.464,225.451 729.055,230.226 734.942,233.525 C740.824,236.829 747.534,238.476 755.072,238.476 C762.604,238.476 769.313,236.829 775.201,233.525 C781.083,230.226 785.619,225.451 788.797,219.201 C791.976,212.957 793.565,205.823 793.565,197.805 C793.565,190.024 791.915,183.128 788.621,177.116 Z" />
                <path fill="#fa420f" d="M607.665,85.002 C599.884,85.002 593.331,82.269 587.998,76.798 C582.665,71.331 580.028,64.768 579.998,57.107 C579.941,42.541 586.944,32.765 592.177,28.186 C589.274,44.173 605.779,44.594 601.191,31.580 C594.742,10.187 607.500,0.000 607.500,0.000 C607.500,0.000 608.726,13.316 627.498,37.416 C631.946,43.126 634.998,49.231 634.998,57.107 C634.998,64.768 632.498,71.331 627.498,76.798 C622.498,82.269 615.883,85.002 607.665,85.002 Z" />
                <path fill="#ffffff" d="M491.959,189.321 C491.959,183.425 490.900,178.297 488.781,173.937 C486.662,169.571 483.605,166.212 479.599,163.858 C475.598,161.498 470.892,160.321 465.473,160.321 C457.472,160.321 451.170,162.913 446.579,168.101 C441.989,173.285 439.693,180.358 439.693,189.321 L439.693,287.993 L439.283,287.993 L385.308,287.993 L384.898,287.993 L384.898,189.321 C384.898,183.425 383.839,178.297 381.720,173.937 C379.601,169.571 376.544,166.212 372.538,163.858 C368.538,161.498 363.831,160.321 358.412,160.321 C350.411,160.321 344.110,162.913 339.519,168.101 C334.928,173.285 332.633,180.358 332.633,189.321 L332.633,287.993 L278.248,287.993 L278.248,188.614 C278.248,173.522 281.603,160.260 288.313,148.827 C295.022,137.388 304.381,128.431 316.388,121.949 C328.395,115.467 342.405,112.223 358.412,112.223 C373.951,112.223 387.900,115.528 400.260,122.126 C404.440,124.356 408.295,126.871 411.842,129.655 C415.390,126.787 419.254,124.213 423.448,121.949 C435.455,115.467 449.465,112.223 465.473,112.223 C481.011,112.223 494.961,115.528 507.321,122.126 C519.681,128.724 529.277,137.742 536.103,149.181 C542.934,160.614 546.344,173.760 546.344,188.614 L546.344,287.993 L491.959,287.993 L491.959,189.321 ZM210.814,278.263 C198.807,284.745 184.797,287.989 168.789,287.989 C153.251,287.989 139.302,284.684 126.941,278.086 C114.581,271.488 104.986,262.470 98.160,251.031 C91.329,239.598 87.918,226.451 87.918,211.598 L87.918,112.219 L142.303,112.219 L142.303,210.890 C142.303,216.787 143.363,221.915 145.482,226.275 C147.601,230.640 150.657,233.100 154.664,236.354 C158.664,238.714 163.371,239.891 168.789,239.891 C176.790,239.891 183.092,237.299 187.683,232.110 C192.274,226.927 194.569,219.854 194.569,210.890 L194.569,112.219 L248.954,112.219 L248.954,211.598 C248.954,226.689 245.599,239.951 238.889,251.385 C232.179,262.823 222.821,271.781 210.814,278.263 ZM-0.015,27.340 L54.369,27.340 L54.369,284.098 L-0.015,284.098 L-0.015,27.340 ZM634.648,284.098 L580.263,284.098 L580.263,112.219 L634.648,112.219 L634.648,284.098 Z" />
              </svg>
            </td>
          </tr>
          <tr>            <td style="padding-bottom:12px;">
              <span style="display:inline-block;background:linear-gradient(135deg,#fa420f,#e03508);color:#fff;font-size:12px;font-weight:700;letter-spacing:0.4px;padding:7px 12px;border-radius:999px;text-transform:uppercase;">${args.badgeText}</span>
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
