import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import {
  appBaseUrl,
  escapeHtml,
  renderEmailButtonRow,
  renderEmailInfoPanel,
  renderLumioEmailShell,
  renderPrimaryEmailButton,
  renderSecondaryEmailButton,
} from '@/lib/email-theme';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'Lumio <notifications@mail.switchcommerce.team>';

export async function POST(req: NextRequest) {
  const { email, redirectTo } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  // Generate a password reset link via Supabase admin
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    // Don't leak whether the email exists — always return success to the client
    return NextResponse.json({ ok: true });
  }

  const resetLink = data.properties.action_link;

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Reset your Lumio password',
    html: buildEmailHtml(resetLink),
  });

  return NextResponse.json({ ok: true });
}

function buildEmailHtml(resetLink: string): string {
  const safeResetLink = escapeHtml(resetLink);
  const rootUrl = appBaseUrl();
  const safeRootUrl = escapeHtml(rootUrl);

  const leadHtml = `<p style="margin:0;color:#d6deef;font-size:15px;line-height:1.62;">
                We received a request to reset your Lumio password.
              </p>
              <p style="margin:8px 0 0;color:#a5afc4;font-size:13px;line-height:1.55;">
                Use the secure link below to create a new password. This link is single-use and time-limited.
              </p>`;

  const actionsHtml = renderEmailButtonRow(
    renderPrimaryEmailButton({ href: safeResetLink, label: 'Reset Password' }),
    renderSecondaryEmailButton({ href: `${safeRootUrl}/auth`, label: 'Open Lumio' }),
  );

  const sectionsHtml = `<tr>
            <td style="padding-top:18px;">
              ${renderEmailInfoPanel({
                title: 'Security Note',
                contentHtml: `<p style="margin:0 0 10px;color:#b9c2d8;font-size:13px;line-height:1.6;">
                      If you did not request a password reset, you can safely ignore this email.
                    </p>
                    <p style="margin:0;color:#8d96ab;font-size:12px;line-height:1.55;word-break:break-all;">
                      Reset link: <a href="${safeResetLink}" style="color:#ff8a5f;text-decoration:none;">${safeResetLink}</a>
                    </p>`,
              })}
            </td>
          </tr>`;

  const footerHtml = `<p style="margin:0;color:#6f7891;font-size:12px;line-height:1.55;">
                Need help? Visit Lumio and request another reset from the sign-in screen.
              </p>
              <p style="margin:8px 0 0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
                Lumio: <a href="${safeRootUrl}" style="color:#ff8a5f;text-decoration:none;">${safeRootUrl}</a>
              </p>`;

  return renderLumioEmailShell({
    documentTitle: 'Reset your Lumio password',
    badgeText: 'Lumio Security',
    headline: 'Reset your password',
    leadHtml,
    actionsHtml,
    sectionsHtml,
    footerHtml,
  });
}
