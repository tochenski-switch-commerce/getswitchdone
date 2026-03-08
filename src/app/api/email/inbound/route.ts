import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const resend = new Resend(process.env.RESEND_API_KEY);

// ── Fuzzy matching helpers ──

/** Strip common forwarding prefixes from subject lines */
function cleanSubject(subject: string): string {
  return subject.replace(/^(fwd?|re|fw)\s*:\s*/gi, '').trim();
}

/** Normalize text for comparison: lowercase, strip punctuation, collapse whitespace */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Word-overlap similarity score between two strings (0–1) */
function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalize(b).split(' ').filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.min(wordsA.size, wordsB.size);
}

interface BoardCandidate {
  id: string;
  title: string;
}

/**
 * Match a cleaned subject to a board.
 * 1) Substring match — board title appears somewhere in the subject (case-insensitive)
 *    If multiple match, pick the longest title (most specific).
 * 2) Word-overlap similarity — pick best if score > 0.4
 */
function matchBoard(cleanedSubject: string, boards: BoardCandidate[]): BoardCandidate | null {
  const subjectNorm = normalize(cleanedSubject);

  // Phase 1: Substring matches
  const substringMatches = boards.filter(b => subjectNorm.includes(normalize(b.title)));
  if (substringMatches.length > 0) {
    return substringMatches.reduce((best, b) => b.title.length > best.title.length ? b : best);
  }

  // Phase 2: Word-overlap similarity
  let bestBoard: BoardCandidate | null = null;
  let bestScore = 0;
  for (const b of boards) {
    const score = wordSimilarity(cleanedSubject, b.title);
    if (score > bestScore) {
      bestScore = score;
      bestBoard = b;
    }
  }

  return bestScore >= 0.4 ? bestBoard : null;
}

// ── Webhook handler ──

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any;

    if (webhookSecret) {
      const payload = await request.text();
      try {
        event = resend.webhooks.verify({
          payload,
          headers: {
            id: request.headers.get('svix-id') || '',
            timestamp: request.headers.get('svix-timestamp') || '',
            signature: request.headers.get('svix-signature') || '',
          },
          webhookSecret,
        });
      } catch {
        // Also allow Bearer token auth (for test endpoint)
        const authHeader = request.headers.get('authorization');
        const fallbackSecret = process.env.INBOUND_EMAIL_SECRET;
        if (fallbackSecret && authHeader?.replace(/^Bearer\s+/i, '') === fallbackSecret) {
          event = JSON.parse(payload);
        } else {
          return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
        }
      }
    } else {
      // No webhook secret — accept Bearer token or unsigned requests (dev mode)
      const authHeader = request.headers.get('authorization');
      const fallbackSecret = process.env.INBOUND_EMAIL_SECRET;
      if (fallbackSecret) {
        const token = authHeader?.replace(/^Bearer\s+/i, '');
        if (token !== fallbackSecret) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }
      event = await request.json();
    }

    // Handle Resend's wrapped format: { type: "email.received", data: { ... } }
    // Also handle flat format from test endpoint
    const isResendFormat = event.type === 'email.received' && event.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailData: any = isResendFormat ? event.data : event;

    const fromRaw = String(emailData.from || '');
    const toRaw = emailData.to || '';
    const subject = String(emailData.subject || '');
    const messageId = String(emailData.message_id || emailData.messageId || '');

    // Resend webhook doesn't include body — fetch it via API if we have an email_id
    let bodyText = String(emailData.text || emailData.body_text || '');
    let bodyHtml = String(emailData.html || emailData.body_html || '');
    let headers: Record<string, unknown> = emailData.headers || {};

    if (isResendFormat && emailData.email_id) {
      try {
        const { data: fullEmail } = await resend.emails.receiving.get(
          String(emailData.email_id)
        );
        if (fullEmail) {
          const emailContent = fullEmail as unknown as Record<string, unknown>;
          bodyText = (emailContent.text as string) || bodyText;
          bodyHtml = (emailContent.html as string) || bodyHtml;
          headers = (emailContent.headers as Record<string, unknown>) || headers;
        }
      } catch (err) {
        console.error('Failed to fetch email content from Resend:', err);
        // Continue with whatever we have
      }
    }

    // Parse "Name <email>" format
    const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
    const fromName = fromMatch ? fromMatch[1].trim().replace(/^["']|["']$/g, '') : '';
    const fromAddress = fromMatch ? fromMatch[2] : fromRaw;
    const toAddress = typeof toRaw === 'string'
      ? toRaw.replace(/^.*<(.+?)>$/, '$1')
      : Array.isArray(toRaw) && toRaw.length > 0
        ? String(toRaw[0]).replace(/^.*<(.+?)>$/, '$1')
        : '';

    if (!fromAddress) {
      return NextResponse.json({ error: 'Missing from address' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Dedup check by message_id
    if (messageId) {
      const { data: existing } = await supabase
        .from('board_emails')
        .select('id')
        .eq('message_id', messageId)
        .limit(1);
      if (existing && existing.length > 0) {
        return NextResponse.json({ ok: true, deduplicated: true });
      }
    }

    // Fetch all non-archived boards for matching
    const { data: boards } = await supabase
      .from('project_boards')
      .select('id, title')
      .eq('is_archived', false);

    const cleanedSubject = cleanSubject(subject);
    const matched = matchBoard(cleanedSubject, boards || []);

    // Insert the email
    const { error: insertErr } = await supabase
      .from('board_emails')
      .insert([{
        board_id: matched?.id || null,
        message_id: messageId || null,
        from_address: fromAddress,
        from_name: fromName || null,
        to_address: toAddress,
        subject: subject || null,
        body_text: bodyText || null,
        body_html: bodyHtml || null,
        headers: headers,
      }]);

    if (insertErr) {
      console.error('Failed to insert email:', insertErr);
      return NextResponse.json({ error: 'Failed to store email' }, { status: 500 });
    }

    // If unrouted, notify all users
    if (!matched) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id');

      if (profiles && profiles.length > 0) {
        const notifications = profiles.map(p => ({
          user_id: p.id,
          type: 'email_unrouted',
          title: "Email couldn't be routed to a board",
          body: `Subject: "${subject || '(no subject)'}" — From: ${fromName || fromAddress}. Open any board's email panel to assign it.`,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    }

    return NextResponse.json({
      ok: true,
      routed_to: matched?.title || null,
      board_id: matched?.id || null,
    });
  } catch (err: unknown) {
    console.error('Email inbound error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
