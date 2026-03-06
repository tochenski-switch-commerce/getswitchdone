import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
  // Jaccard-like: overlap / size of the smaller set (board title is usually shorter)
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
    // Pick the longest title (most specific match)
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
    // Verify webhook secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.INBOUND_EMAIL_SECRET;
    if (expectedSecret) {
      const token = authHeader?.replace(/^Bearer\s+/i, '');
      if (token !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();

    // Parse Resend Inbound payload fields
    // Resend sends: from, to, subject, text, html, headers, message_id (among others)
    const fromRaw = body.from || '';
    const toRaw = body.to || '';
    const subject = body.subject || '';
    const bodyText = body.text || '';
    const bodyHtml = body.html || '';
    const messageId = body.message_id || body.messageId || '';
    const headers = body.headers || {};

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
