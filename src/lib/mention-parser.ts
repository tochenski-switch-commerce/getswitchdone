/**
 * Parse @mentions from text and extract mentioned user IDs.
 * Supports @username and @full name reference format.
 * Returns array of user IDs (UUIDs) that were mentioned.
 */

export function extractMentions(text: string, users: Array<{ id: string; name: string }>): string[] {
  if (!text) return [];

  const mentionedIds = new Set<string>();
  const userNameMap = new Map(users.map((u) => [u.name?.trim().toLowerCase(), u.id] as const));

  // 1) Prefer explicit mention spans emitted by the rich-text editor.
  //    Handles names with spaces/special characters reliably.
  const mentionSpanRegex = /<span\b[^>]*class=["'][^"']*\bkb-mention\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
  let spanMatch: RegExpExecArray | null;
  while ((spanMatch = mentionSpanRegex.exec(text)) !== null) {
    const raw = spanMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
    const name = raw.startsWith('@') ? raw.slice(1).trim() : raw;
    const id = userNameMap.get(name.toLowerCase());
    if (id) mentionedIds.add(id);
  }

  // 2) Support quoted full-name mentions: @"Jane Doe"
  const quotedMentionRegex = /@"([^"]+)"/g;
  let quotedMatch: RegExpExecArray | null;
  while ((quotedMatch = quotedMentionRegex.exec(text)) !== null) {
    const name = quotedMatch[1].trim().toLowerCase();
    const id = userNameMap.get(name);
    if (id) mentionedIds.add(id);
  }

  // 3) Support simple mentions: @username (single token)
  const simpleMentionRegex = /@([\p{L}\p{N}._-]+)/gu;
  let simpleMatch: RegExpExecArray | null;
  while ((simpleMatch = simpleMentionRegex.exec(text)) !== null) {
    const token = simpleMatch[1].trim().toLowerCase();
    const exact = userNameMap.get(token);
    if (exact) {
      mentionedIds.add(exact);
      continue;
    }

    // Fallback: allow unique prefix matches for convenience.
    const candidates = users.filter((u) => u.name?.toLowerCase().startsWith(token));
    if (candidates.length === 1) {
      mentionedIds.add(candidates[0].id);
    }
  }

  return [...mentionedIds];
}

/**
 * Format mention text for display (highlight @mentions).
 * Converts @usernames to styled spans.
 */
