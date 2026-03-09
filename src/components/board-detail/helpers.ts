import React from 'react';
import type { CardPriority, CustomFieldType, RepeatRule } from '@/types/board-types';

/* ═══════════════════════════════════════════════════════════
   Regex patterns
   ═══════════════════════════════════════════════════════════ */
export const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;
export const MENTION_REGEX = /@"([^"]+)"|@(\S+)/g;

/* ═══════════════════════════════════════════════════════════
   Text rendering helpers
   ═══════════════════════════════════════════════════════════ */
export function linkifyText(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      React.createElement('a', {
        key: i,
        href: part,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'kb-link',
      }, part)
    ) : (
      React.createElement('span', { key: i }, part)
    )
  );
}

export function renderCommentText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(MENTION_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...linkifyText(text.slice(lastIndex, match.index)));
    }
    const name = match[1] || match[2];
    nodes.push(
      React.createElement('span', { key: `m-${match.index}`, className: 'kb-mention' }, `@${name}`)
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(...linkifyText(text.slice(lastIndex)));
  }
  return nodes;
}

export function renderRichText(text: string): React.ReactNode[] {
  return text.split('\n').map((line, lineIdx, arr) => {
    const parts: React.ReactNode[] = [];
    const urlRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>"']+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = urlRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(React.createElement('span', { key: `${lineIdx}-t-${key++}` }, line.slice(lastIndex, match.index)));
      }
      if (match[1]) {
        parts.push(React.createElement('a', { key: `${lineIdx}-a-${key++}`, href: match[3], target: '_blank', rel: 'noopener noreferrer', className: 'kb-link' }, match[2]));
      } else if (match[4]) {
        parts.push(React.createElement('a', { key: `${lineIdx}-a-${key++}`, href: match[4], target: '_blank', rel: 'noopener noreferrer', className: 'kb-link' }, match[4]));
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(React.createElement('span', { key: `${lineIdx}-e-${key++}` }, line.slice(lastIndex)));
    }
    if (parts.length === 0) parts.push(React.createElement('span', { key: `${lineIdx}-empty` }, ' '));
    return React.createElement(React.Fragment, { key: lineIdx }, ...parts, lineIdx < arr.length - 1 ? React.createElement('br') : null);
  });
}

/* ═══════════════════════════════════════════════════════════
   Rich text sanitization
   ═══════════════════════════════════════════════════════════ */
export function sanitizeRichText(html: string): string {
  if (!html) return '';
  // If plain text (no HTML tags), convert newlines to <br>
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?\/?>|<\/embed>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*\S+/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/data\s*:/gi, 'blocked:');
}

/* ═══════════════════════════════════════════════════════════
   Priority config
   ═══════════════════════════════════════════════════════════ */
export const PRIORITY_CONFIG: Record<CardPriority, { label: string; color: string; bg: string }> = {
  low:    { label: 'Low',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  high:   { label: 'High',   color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

export const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0,
  high:   1,
  medium: 2,
  low:    3,
  none:   4,
};

/* ═══════════════════════════════════════════════════════════
   Field types
   ═══════════════════════════════════════════════════════════ */
export const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text',        label: 'Text' },
  { value: 'number',      label: 'Number' },
  { value: 'date',        label: 'Date' },
  { value: 'checkbox',    label: 'Checkbox' },
  { value: 'dropdown',    label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
];

/* ═══════════════════════════════════════════════════════════
   Email helpers
   ═══════════════════════════════════════════════════════════ */
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?\/?>|<\/embed>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*\S+/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/data\s*:/gi, 'blocked:');
}

export function emailTimeAgo(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const secs = Math.floor((now - d) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ═══════════════════════════════════════════════════════════
   Label colors
   ═══════════════════════════════════════════════════════════ */
export const LABEL_COLORS: { hex: string; name: string }[] = [
  { hex: '#ef4444', name: 'Red' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#84cc16', name: 'Lime' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#0ea5e9', name: 'Sky' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#8b5cf6', name: 'Violet' },
  { hex: '#a855f7', name: 'Purple' },
  { hex: '#d946ef', name: 'Fuchsia' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#f43f5e', name: 'Rose' },
  { hex: '#78716c', name: 'Stone' },
  { hex: '#64748b', name: 'Slate' },
];

/* ═══════════════════════════════════════════════════════════
   Repeat helpers
   ═══════════════════════════════════════════════════════════ */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Compute the next occurrence date from today for a given repeat rule. */
export function getNextRepeatDate(rule: RepeatRule): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (rule.interval === 'daily') {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (rule.interval === 'weekly' && rule.days.length > 0) {
    const today = now.getDay();
    const sorted = [...rule.days].sort((a, b) => a - b);
    // Find the next day >= today (but not today itself)
    for (const d of sorted) {
      if (d > today) {
        const next = new Date(now);
        next.setDate(next.getDate() + (d - today));
        return next;
      }
    }
    // Wrap to next week
    const next = new Date(now);
    next.setDate(next.getDate() + (7 - today + sorted[0]));
    return next;
  }

  if (rule.interval === 'monthly' && rule.days.length > 0) {
    const dayOfMonth = rule.days[0];
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
    if (thisMonth > now) return thisMonth;
    // Next month
    return new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
  }

  // Fallback
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  return next;
}

/** Format the next repeat date as a friendly string. */
export function formatNextDate(rule: RepeatRule): string {
  const next = getNextRepeatDate(rule);
  if (rule.endDate) {
    const end = new Date(rule.endDate + 'T00:00:00');
    if (next > end) return 'Series ended';
  }
  return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Human-readable repeat summary, e.g. "Every Monday" or "Daily". */
export function formatRepeatSummary(rule: RepeatRule): string {
  if (rule.interval === 'daily') return 'Daily';
  if (rule.interval === 'weekly') {
    if (rule.days.length === 0) return 'Weekly';
    if (rule.days.length === 7) return 'Every day';
    if (rule.days.length === 5 && [1,2,3,4,5].every(d => rule.days.includes(d))) return 'Weekdays';
    if (rule.days.length === 2 && [0,6].every(d => rule.days.includes(d))) return 'Weekends';
    const names = [...rule.days].sort((a, b) => a - b).map(d => DAY_NAMES[d]);
    if (names.length === 1) return `Every ${DAY_NAMES_FULL[rule.days[0]]}`;
    return `Every ${names.join(', ')}`;
  }
  if (rule.interval === 'monthly') {
    if (rule.days.length === 0) return 'Monthly';
    return `Monthly on the ${ordinal(rule.days[0])}`;
  }
  return 'Repeating';
}
