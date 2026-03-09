import React from 'react';
import type { CardPriority, CustomFieldType, RepeatRule, RepeatUnit } from '@/types/board-types';

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

function addUnits(date: Date, every: number, unit: RepeatUnit): Date {
  const d = new Date(date);
  if (unit === 'days') d.setDate(d.getDate() + every);
  else if (unit === 'weeks') d.setDate(d.getDate() + every * 7);
  else if (unit === 'months') d.setMonth(d.getMonth() + every);
  return d;
}

/** Compute the next occurrence date after today, anchored to startDate. */
export function getNextRepeatDate(rule: RepeatRule, startDate: string): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const anchor = new Date(startDate + 'T00:00:00');

  // Step forward from anchor by (every * unit) until we're past today
  let next = new Date(anchor);
  while (next <= now) {
    next = addUnits(next, rule.every, rule.unit);
  }
  return next;
}

/** Format the next repeat date as a friendly string. */
export function formatNextDate(rule: RepeatRule, startDate: string): string {
  if (!startDate) return 'Set a start date';
  const next = getNextRepeatDate(rule, startDate);
  if (rule.endDate) {
    const end = new Date(rule.endDate + 'T00:00:00');
    if (next > end) return 'Series ended';
  }
  return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const UNIT_LABELS: Record<RepeatUnit, [string, string]> = {
  days: ['day', 'days'],
  weeks: ['week', 'weeks'],
  months: ['month', 'months'],
};

/** Human-readable repeat summary, e.g. "Every 2 weeks" or "Every day". */
export function formatRepeatSummary(rule: RepeatRule): string {
  const [singular, plural] = UNIT_LABELS[rule.unit];
  if (rule.every === 1) return `Every ${singular}`;
  return `Every ${rule.every} ${plural}`;
}
