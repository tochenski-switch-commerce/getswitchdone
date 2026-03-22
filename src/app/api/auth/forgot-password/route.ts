import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const resend = new Resend(process.env.RESEND_API_KEY);

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
    from: 'Lumio <noreply@getlumio.app>',
    to: email,
    subject: 'Reset your Lumio password',
    html: buildEmailHtml(resetLink),
  });

  return NextResponse.json({ ok: true });
}

function buildEmailHtml(resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Lumio password</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f1117;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#fa420f;border-radius:12px;padding:10px 20px;">
                    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Lumio</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1a1d27;border:1px solid #2a2d3a;border-radius:16px;padding:40px 36px;">

              <!-- Lock icon -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:rgba(250,66,15,0.1);border-radius:18px;width:64px;height:64px;text-align:center;vertical-align:middle;">
                          <img src="https://api.iconify.design/lucide/lock.svg?color=%23fa420f&width=30&height=30" width="30" height="30" alt="" style="display:block;margin:17px auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#f9fafb;line-height:1.3;">Reset your password</h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <p style="margin:0;font-size:14px;color:#9ca3af;line-height:1.6;max-width:320px;">
                      We received a request to reset your password. Click the button below to choose a new one.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="${resetLink}" style="display:inline-block;background:#fa420f;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.1px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #2a2d3a;padding-top:24px;">
                    <p style="margin:0 0 8px;font-size:12px;color:#6b7280;line-height:1.6;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="margin:0;font-size:11px;color:#4b5563;word-break:break-all;line-height:1.5;">
                      <a href="${resetLink}" style="color:#fa420f;text-decoration:none;">${resetLink}</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#4b5563;line-height:1.6;">
                If you didn&rsquo;t request this, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:12px;color:#374151;">
                &copy; ${new Date().getFullYear()} Lumio &mdash; <a href="https://getlumio.app" style="color:#6b7280;text-decoration:none;">getlumio.app</a>
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
