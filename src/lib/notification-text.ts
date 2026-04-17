const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : `&${entity};`;
    }

    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : `&${entity};`;
    }

    return HTML_ENTITY_MAP[entity] ?? `&${entity};`;
  });
}

export function normalizeNotificationText(input: string | undefined | null): string {
  if (!input) return '';

  // Remove any HTML tags first, then decode entities, and normalize whitespace.
  const withoutTags = input.replace(/<[^>]*>/g, ' ');
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
}
