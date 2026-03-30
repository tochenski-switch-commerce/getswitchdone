import type { BoardCard, BoardColumn, UserProfile } from '@/types/board-types';
import type { FullBoard } from '@/hooks/useProjectBoard';
import { PRIORITY_WEIGHT } from '@/components/board-detail/helpers';

// ── Date helpers ──────────────────────────────────────────────
export function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getSaturdayStr(todayStr: string): string {
  const d = new Date(todayStr + 'T00:00:00');
  const diff = 6 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function getMonthEndStr(todayStr: string): string {
  const d = new Date(todayStr + 'T00:00:00');
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

// ── Active (non-archived) cards ───────────────────────────────
function activeCards(board: FullBoard): BoardCard[] {
  return board.cards.filter(c => !c.is_archived);
}

// ── Summary ───────────────────────────────────────────────────
export interface SummaryMetrics {
  total: number;
  completed: number;
  completionPct: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  highPriorityCount: number;
}

export function computeSummary(board: FullBoard, todayStr: string): SummaryMetrics {
  const saturdayStr = getSaturdayStr(todayStr);
  const cards = activeCards(board);
  const total = cards.length;
  const completed = cards.filter(c => c.is_complete).length;
  const overdue = cards.filter(c => !c.is_complete && c.due_date && c.due_date < todayStr).length;
  const dueToday = cards.filter(c => !c.is_complete && c.due_date === todayStr).length;
  const dueThisWeek = cards.filter(c => !c.is_complete && c.due_date && c.due_date > todayStr && c.due_date <= saturdayStr).length;
  const highPriorityCount = cards.filter(c => !c.is_complete && (c.priority === 'high' || c.priority === 'urgent')).length;
  return {
    total,
    completed,
    completionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    overdue,
    dueToday,
    dueThisWeek,
    highPriorityCount,
  };
}

// ── Column Breakdown ──────────────────────────────────────────
export interface ColumnBreakdown {
  column: BoardColumn;
  total: number;
  completed: number;
  pct: number;
}

export function computeColumnBreakdown(board: FullBoard): ColumnBreakdown[] {
  const cards = activeCards(board);
  const countMap = new Map<string, { total: number; completed: number }>();

  for (const card of cards) {
    const entry = countMap.get(card.column_id) ?? { total: 0, completed: 0 };
    entry.total++;
    if (card.is_complete) entry.completed++;
    countMap.set(card.column_id, entry);
  }

  return board.columns
    .filter(col => col.column_type !== 'board_links')
    .sort((a, b) => a.position - b.position)
    .map(col => {
      const { total = 0, completed = 0 } = countMap.get(col.id) ?? {};
      return {
        column: col,
        total,
        completed,
        pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
}

// ── Priority Breakdown ────────────────────────────────────────
export interface PriorityBreakdown {
  urgent: number;
  high: number;
  medium: number;
  low: number;
  none: number;
  total: number;
}

export function computePriorityBreakdown(board: FullBoard): PriorityBreakdown {
  const cards = activeCards(board).filter(c => !c.is_complete);
  const breakdown: PriorityBreakdown = { urgent: 0, high: 0, medium: 0, low: 0, none: 0, total: 0 };
  for (const card of cards) {
    breakdown.total++;
    switch (card.priority) {
      case 'urgent': breakdown.urgent++; break;
      case 'high': breakdown.high++; break;
      case 'medium': breakdown.medium++; break;
      case 'low': breakdown.low++; break;
      default: breakdown.none++;
    }
  }
  return breakdown;
}

// ── Assignee Workload ─────────────────────────────────────────
export interface AssigneeWorkload {
  userId: string | null;
  name: string;
  total: number;
  completed: number;
  overdue: number;
  completionPct: number;
}

export function computeAssigneeWorkload(board: FullBoard, profiles: UserProfile[], todayStr: string): AssigneeWorkload[] {
  const cards = activeCards(board);
  const profileById = new Map(profiles.map(p => [p.id, p]));
  const map = new Map<string | null, { total: number; completed: number; overdue: number }>();

  const bump = (key: string | null, card: BoardCard) => {
    const entry = map.get(key) ?? { total: 0, completed: 0, overdue: 0 };
    entry.total++;
    if (card.is_complete) entry.completed++;
    else if (card.due_date && card.due_date < todayStr) entry.overdue++;
    map.set(key, entry);
  };

  for (const card of cards) {
    const assignees = (card.assignees && card.assignees.length > 0)
      ? card.assignees
      : (card.assignee ? [card.assignee] : []);

    if (assignees.length === 0) {
      bump(null, card);
    } else {
      for (const uid of assignees) bump(uid, card);
    }
  }

  // Merge by resolved name to handle legacy assignee strings vs UUID entries
  const byName = new Map<string, AssigneeWorkload>();
  let unassigned: AssigneeWorkload | null = null;

  for (const [userId, data] of map.entries()) {
    if (userId === null) {
      const totals = data;
      unassigned = {
        userId: null,
        name: 'Unassigned',
        ...totals,
        completionPct: totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0,
      };
      continue;
    }

    const name = profileById.get(userId)?.name ?? userId.slice(0, 8);
    const existing = byName.get(name);
    if (existing) {
      existing.total += data.total;
      existing.completed += data.completed;
      existing.overdue += data.overdue;
      existing.completionPct = existing.total > 0
        ? Math.round((existing.completed / existing.total) * 100)
        : 0;
    } else {
      byName.set(name, {
        userId,
        name,
        ...data,
        completionPct: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      });
    }
  }

  const result = Array.from(byName.values());
  result.sort((a, b) => b.total - a.total);
  if (unassigned) result.push(unassigned);
  return result;
}

// ── Timeline ──────────────────────────────────────────────────
export interface TimelineGroups {
  overdue: BoardCard[];
  today: BoardCard[];
  thisWeek: BoardCard[];
  thisMonth: BoardCard[];
  noDate: BoardCard[];
}

export function computeTimeline(board: FullBoard, todayStr: string): TimelineGroups {
  const saturdayStr = getSaturdayStr(todayStr);
  const monthEndStr = getMonthEndStr(todayStr);
  const cards = activeCards(board).filter(c => !c.is_complete);

  const byPriority = (a: BoardCard, b: BoardCard) =>
    (PRIORITY_WEIGHT[a.priority ?? 'none'] ?? 4) - (PRIORITY_WEIGHT[b.priority ?? 'none'] ?? 4);
  const byDate = (a: BoardCard, b: BoardCard) =>
    (a.due_date ?? '').localeCompare(b.due_date ?? '') || byPriority(a, b);

  const overdue: BoardCard[] = [];
  const today: BoardCard[] = [];
  const thisWeek: BoardCard[] = [];
  const thisMonth: BoardCard[] = [];
  const noDate: BoardCard[] = [];

  for (const card of cards) {
    if (!card.due_date) { noDate.push(card); continue; }
    if (card.due_date < todayStr) { overdue.push(card); continue; }
    if (card.due_date === todayStr) { today.push(card); continue; }
    if (card.due_date <= saturdayStr) { thisWeek.push(card); continue; }
    if (card.due_date <= monthEndStr) { thisMonth.push(card); continue; }
  }

  overdue.sort(byDate);
  today.sort(byPriority);
  thisWeek.sort(byDate);
  thisMonth.sort(byDate);
  noDate.sort(byPriority);

  return { overdue, today, thisWeek, thisMonth, noDate };
}

// ── Card Filter ───────────────────────────────────────────────
export function filterCards(
  cards: BoardCard[],
  searchText: string,
  priority: string,
  assigneeId: string,
  done: '' | 'yes' | 'no' = '',
): BoardCard[] {
  const text = searchText.trim().toLowerCase();
  return cards.filter(card => {
    if (card.is_archived) return false;
    if (text && !card.title.toLowerCase().includes(text)) return false;
    if (priority && card.priority !== priority) return false;
    if (done === 'yes' && !card.is_complete) return false;
    if (done === 'no' && card.is_complete) return false;
    if (assigneeId) {
      const assignees = (card.assignees && card.assignees.length > 0)
        ? card.assignees
        : (card.assignee ? [card.assignee] : []);
      if (!assignees.includes(assigneeId)) return false;
    }
    return true;
  });
}
