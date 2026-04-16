/**
 * Parse @mentions from text and extract mentioned user IDs.
 * Supports @username and @full name reference format.
 * Returns array of user IDs (UUIDs) that were mentioned.
 */

export function extractMentions(text: string, users: Array<{ id: string; name: string }>): string[] {
  if (!text) return [];

  // Match @word patterns
  const mentions = text.match(/@[\w\s-]+/g) || [];
  
  const mentionedIds = new Set<string>();

  mentions.forEach((mention) => {
    const username = mention.substring(1).toLowerCase().trim(); // Remove @ and lowercase
    
    // Find matching user by name (case-insensitive)
    const matchedUser = users.find(
      (u) => u.name?.toLowerCase() === username || u.name?.toLowerCase().includes(username)
    );
    
    if (matchedUser) {
      mentionedIds.add(matchedUser.id);
    }
  });

  return Array.from(mentionedIds);
}

/**
 * Format mention text for display (highlight @mentions).
 * Converts @usernames to styled spans.
 */
