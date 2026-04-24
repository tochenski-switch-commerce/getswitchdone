import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  appBaseUrl,
  escapeHtml,
  renderEmailButtonRow,
  renderEmailInfoPanel,
  renderLumioEmailShell,
  renderPrimaryEmailButton,
  renderSecondaryEmailButton,
} from '@/lib/email-theme';
import { resend } from '@/lib/resend';

const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'Lumio <notifications@mail.switchcommerce.team>';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { teamId, email } = body ?? {};

  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ error: 'Missing teamId' }, { status: 400 });
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Verify the requesting user is an owner of this team
  const { data: membership } = await supabaseAdmin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only team owners can send invite emails' }, { status: 403 });
  }

  // Fetch team name and inviter display name
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const { data: inviterProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('name')
    .eq('id', user.id)
    .single();

  const inviterName = inviterProfile?.name?.trim() || 'A teammate';

  // Get or create an active invite code for the team
  const { data: existingInvite } = await supabaseAdmin
    .from('team_invites')
    .select('invite_code')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let inviteCode: string;

  if (existingInvite?.invite_code) {
    inviteCode = existingInvite.invite_code;
  } else {
    const { data: newInvite, error: createError } = await supabaseAdmin
      .from('team_invites')
      .insert({ team_id: teamId, created_by: user.id })
      .select('invite_code')
      .single();

    if (createError || !newInvite) {
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }
    inviteCode = newInvite.invite_code;
  }

  const joinUrl = `${appBaseUrl()}/join/${inviteCode}`;
  const signUpUrl = `${appBaseUrl()}/auth?returnTo=${encodeURIComponent(`/join/${inviteCode}`)}`;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: normalizedEmail,
      subject: `${escapeHtml(inviterName)} invited you to join ${escapeHtml(team.name)} on Lumio`,
      html: buildTeamInviteEmailHtml({
        teamName: team.name,
        inviterName,
        joinUrl,
        signUpUrl,
      }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[send-invite-email] failed:', message);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function buildTeamInviteEmailHtml(args: {
  teamName: string;
  inviterName: string;
  joinUrl: string;
  signUpUrl: string;
}): string {
  const { teamName, inviterName, joinUrl, signUpUrl } = args;
  const safeTeam = escapeHtml(teamName);
  const safeInviter = escapeHtml(inviterName);
  const safeJoin = escapeHtml(joinUrl);
  const safeSignUp = escapeHtml(signUpUrl);

  const leadHtml = `
    <p style="margin:0 0 10px;color:#d6deef;font-size:15px;line-height:1.62;">
      <strong style="color:#f0f4ff;">${safeInviter}</strong> has invited you to collaborate on
      <strong style="color:#f0f4ff;">${safeTeam}</strong> in Lumio — a focused space for getting things done together.
    </p>
    <p style="margin:0;color:#9ca8c0;font-size:14px;line-height:1.6;">
      Click the button below to join. If you don't have an account yet, you'll be prompted to create one — it only takes a moment.
    </p>`;

  const actionsHtml = renderEmailButtonRow(
    renderPrimaryEmailButton({ href: safeJoin, label: `Join ${safeTeam}` }),
    renderSecondaryEmailButton({ href: safeSignUp, label: 'Create Account' }),
  );

  const gettingStartedHtml = renderEmailInfoPanel({
    title: 'Getting started with Lumio',
    contentHtml: `
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
        ${[
          ['🗂️', 'Create a board', 'Boards are your projects. Make one for a product, a team, or a goal.'],
          ['🃏', 'Add cards', 'Cards are tasks. Drag them across columns as work moves forward.'],
          ['👁️', 'Watch cards', 'Click Watch on any card to get notified when it changes — perfect for staying in the loop without being assigned.'],
          ['🎯', 'Check your Focus', 'The Focus tab shows everything due today and overdue across all your boards — your daily briefing.'],
        ].map(([emoji, title, desc]) => `
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:28px;font-size:18px;line-height:1;">${emoji}</td>
            <td style="padding:8px 0 8px 4px;vertical-align:top;">
              <p style="margin:0 0 2px;color:#eaf1ff;font-size:13px;font-weight:600;line-height:1.4;">${title}</p>
              <p style="margin:0;color:#8a95b0;font-size:12px;line-height:1.55;">${desc}</p>
            </td>
          </tr>
        `).join('')}
      </table>
    `,
  });

  const sectionsHtml = `<tr><td style="padding-top:20px;">${gettingStartedHtml}</td></tr>`;

  const footerHtml = `
    <p style="margin:0;color:#6f7891;font-size:12px;line-height:1.55;">
      If you already have a Lumio account, sign in first and then use the Join button to connect to the team.
    </p>
    <p style="margin:8px 0 0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
      Lumio: <a href="${escapeHtml(appBaseUrl())}" style="color:#ff8a5f;text-decoration:none;">${escapeHtml(appBaseUrl())}</a>
    </p>`;

  return renderLumioEmailShell({
    documentTitle: `You're invited to join ${teamName} on Lumio`,
    badgeText: 'Team Invite',
    headline: `You're invited to ${safeTeam}`,
    leadHtml,
    actionsHtml,
    sectionsHtml,
    footerHtml,
    baseUrl: appBaseUrl(),
  });
}
