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
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  const db = getSupabaseAdmin();

  // Verify caller is authenticated
  const { data: { user }, error: authErr } = token
    ? await db.auth.getUser(token)
    : { data: { user: null }, error: new Error('No token') };

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { cardId, email, userId } = body as { cardId?: string; email?: string; userId?: string };

  if (!cardId) {
    console.error('[invite-watcher] no cardId in body:', body);
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
  }

  console.log('[invite-watcher] received:', { cardId, email, userId });

  // ── Direct add by userId ──────────────────────────────────────────────────
  if (userId) {
    const { error: insertErr } = await db
      .from('card_watchers')
      .upsert({ card_id: cardId, user_id: userId });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, alreadyUser: true });
  }

  if (!email) {
    return NextResponse.json({ error: 'email or userId is required' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // ── Check if a user with that email already exists ────────────────────────
  const { data: existingUsers } = await db.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );

  if (existingUser) {
    // Add directly as a watcher
    const { error: insertErr } = await db
      .from('card_watchers')
      .upsert({ card_id: cardId, user_id: existingUser.id });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, alreadyUser: true });
  }

  // ── Fetch card + board details for email ─────────────────────────────────
  const { data: cardRow, error: cardErr } = await db
    .from('board_cards')
    .select('id, title, description, board_id, column_id')
    .eq('id', cardId)
    .single();

  if (cardErr || !cardRow) {
    console.error('[invite-watcher] card not found:', { cardId, cardErr });
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  // Fetch column and board separately
  const { data: colRow } = await db
    .from('board_columns')
    .select('id, title')
    .eq('id', cardRow.column_id)
    .single();

  const { data: boardRow } = await db
    .from('project_boards')
    .select('id, title')
    .eq('id', cardRow.board_id)
    .single();

  const col = colRow;
  const board = boardRow;

  // ── Create invite record ──────────────────────────────────────────────────
  const { data: invite, error: inviteErr } = await db
    .from('watcher_invites')
    .insert({
      card_id: cardId,
      email: normalizedEmail,
      invited_by: user.id,
    })
    .select('token')
    .single();

  if (inviteErr || !invite) {
    return NextResponse.json({ error: inviteErr?.message ?? 'Failed to create invite' }, { status: 500 });
  }

  // ── Send invite email ─────────────────────────────────────────────────────
  const baseUrl = appBaseUrl();
  const claimUrl = `${baseUrl}/join-watch/${invite.token}`;
  const signUpUrl = `${baseUrl}/auth`;

  const descSnippet = cardRow.description
    ? cardRow.description.replace(/<[^>]*>/g, '').slice(0, 200)
    : null;

  await resend.emails.send({
    from: fromEmail,
    to: normalizedEmail,
    subject: `You've been added as a watcher on "${cardRow.title}"`,
    html: buildInviteEmailHtml({
      cardTitle: cardRow.title,
      boardTitle: board?.title ?? '',
      columnTitle: col?.title ?? '',
      descSnippet,
      claimUrl,
      signUpUrl,
    }),
  });

  return NextResponse.json({ ok: true, alreadyUser: false });
}

function buildInviteEmailHtml(args: {
  cardTitle: string;
  boardTitle: string;
  columnTitle: string;
  descSnippet: string | null;
  claimUrl: string;
  signUpUrl: string;
}): string {
  const { cardTitle, boardTitle, columnTitle, descSnippet, claimUrl, signUpUrl } = args;
  const safeTitle = escapeHtml(cardTitle);
  const safeBoard = escapeHtml(boardTitle);
  const safeColumn = escapeHtml(columnTitle);
  const safeClaimUrl = escapeHtml(claimUrl);
  const safeSignUpUrl = escapeHtml(signUpUrl);

  const leadHtml = `
    <p style="margin:0;color:#d6deef;font-size:15px;line-height:1.62;">
      You've been added as a watcher on a card in Lumio.
      Watchers receive updates when the card changes.
    </p>`;

  const actionsHtml = renderEmailButtonRow(
    renderPrimaryEmailButton({ href: safeClaimUrl, label: 'View Card' }),
    renderSecondaryEmailButton({ href: safeSignUpUrl, label: 'Create Account' }),
  );

  const cardInfoHtml = renderEmailInfoPanel({
    title: safeTitle,
    contentHtml: `
      <p style="margin:0 0 6px;color:#9ca8c0;font-size:12px;line-height:1.5;">
        <strong style="color:#b9c2d8;">Board:</strong> ${safeBoard}
        &nbsp;·&nbsp;
        <strong style="color:#b9c2d8;">Column:</strong> ${safeColumn}
      </p>
      ${descSnippet ? `<p style="margin:6px 0 0;color:#9ca8c0;font-size:13px;line-height:1.6;">${escapeHtml(descSnippet)}${descSnippet.length >= 200 ? '…' : ''}</p>` : ''}
    `,
  });

  const sectionsHtml = `<tr><td style="padding-top:18px;">${cardInfoHtml}</td></tr>`;

  const footerHtml = `
    <p style="margin:0;color:#6f7891;font-size:12px;line-height:1.55;">
      If you already have a Lumio account, sign in first, then click the View Card link to activate your watcher status.
    </p>
    <p style="margin:8px 0 0;color:#5d667f;font-size:11px;line-height:1.5;word-break:break-all;">
      Lumio: <a href="${escapeHtml(appBaseUrl())}" style="color:#ff8a5f;text-decoration:none;">${escapeHtml(appBaseUrl())}</a>
    </p>`;

  return renderLumioEmailShell({
    documentTitle: `Watcher invite: ${cardTitle}`,
    badgeText: 'Card Watcher',
    headline: `You're watching "${safeTitle}"`,
    leadHtml,
    actionsHtml,
    sectionsHtml,
    footerHtml,
    baseUrl: appBaseUrl(),
  });
}
