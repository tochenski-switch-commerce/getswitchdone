'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayData, toDateStr } from '@/hooks/useTodayData';
import type { TodayCard, TodayBoard } from '@/hooks/useTodayData';
import { PRIORITY_CONFIG } from '@/components/board-detail/helpers';
import FlameLoader from '@/components/FlameLoader';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import type { CardPriority } from '@/types/board-types';
import { getBoardIcon, DEFAULT_ICON_COLOR } from '@/components/BoardIcons';
import { Check, X, Plus, Square, SquareCheck, MessageSquare, RotateCcw, Star, CircleCheck, Flame } from 'lucide-react';

// ─── date/time helpers ───────────────────────────────────────────────────────

const TODAY = toDateStr(new Date());
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr);
  return `${h % 12 || 12}:${mStr} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDueDate(dateStr: string, dueTime?: string | null): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - now.getTime()) / 86400000);
  if (diff === 0) return dueTime ? `Today, ${formatTime(dueTime)}` : 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff < -1) return `${MONTHS[m - 1]} ${d}`;
  if (diff === 1) return 'Tomorrow';
  return `${MONTHS[m - 1]} ${d}`;
}

function formatOnDeckDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - now.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return `${DAYS[date.getDay()]}, ${MONTHS[m - 1]} ${d}`;
}

function dueDateColor(dateStr: string): string {
  if (dateStr < TODAY) return '#ef4444';
  if (dateStr === TODAY) return '#fa420f';
  return '#6b7280';
}

function getGreeting(name: string | null): { line1: string; line2: string } {
  const h = new Date().getHours();
  const time = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const first = name?.split(' ')[0] ?? null;
  return {
    line1: `Good ${time}${first ? `, ${first}` : ''}`,
    line2: '',
  };
}

function getStatusMessage(overdueCount: number, dueTodayCount: number, completedTodayCount: number): string {
  if (overdueCount > 0 && dueTodayCount > 0) {
    return `${overdueCount} overdue · ${dueTodayCount} due today`;
  }
  if (overdueCount > 0) {
    return `${overdueCount} card${overdueCount > 1 ? 's' : ''} overdue`;
  }
  if (dueTodayCount > 0) {
    return `${dueTodayCount} card${dueTodayCount > 1 ? 's' : ''} due today`;
  }
  if (completedTodayCount > 0) {
    return "You're all caught up. Great work today.";
  }
  return "Nothing due today. A clean slate.";
}

// ─── Starred Boards ───────────────────────────────────────────────────────────

function StarredBoardsSection({ boards }: { boards: TodayBoard[] }) {
  const router = useRouter();
  if (boards.length === 0) return null;

  return (
    <div className="td-starred-section">
      <div className="td-focused-header" style={{ marginBottom: 10 }}>
        <Star size={13} fill="#f59e0b" stroke="#f59e0b" strokeWidth={1} />
        <span style={{ color: '#f59e0b' }}>Starred</span>
      </div>
      <div className="td-starred-chips">
        {boards.map(board => {
          const Icon = getBoardIcon(board.icon);
          const color = board.iconColor || DEFAULT_ICON_COLOR;
          return (
            <button
              key={board.id}
              className="td-starred-chip"
              onClick={() => { hapticLight(); router.push(`/boards/${board.id}`); }}
            >
              <span className="td-starred-chip-icon" style={{ color }}>
                <Icon size={13} />
              </span>
              <span className="td-starred-chip-title">{board.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Focus Card ──────────────────────────────────────────────────────────────

function FocusCard({ card, onComplete, onUnfocus }: { card: TodayCard; onComplete: (id: string) => void; onUnfocus?: (id: string) => void }) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const priority = card.priority as CardPriority | null;
  const pc = priority ? PRIORITY_CONFIG[priority] : null;
  const isOverdue = card.dueDate && card.dueDate < TODAY;

  const handleDone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (completing) return;
    setCompleting(true);
    hapticSuccess();
    onComplete(card.id);
  }, [card.id, completing, onComplete]);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    router.push(`/boards/${card.boardId}?card=${card.id}`);
  }, [card.boardId, card.id, router]);

  return (
    <div
      className="td-focus-card"
      style={{ borderLeftColor: pc?.color ?? '#fa420f' }}
    >
      <div className="td-focus-meta">
        <div className="td-focus-labels">
          <span className="td-focus-eyebrow">Focus</span>
          {pc && (
            <span className="td-focus-priority" style={{ color: pc.color, background: pc.bg }}>
              {pc.label}
            </span>
          )}
        </div>
        <span className="td-focus-board">{card.boardTitle}</span>
      </div>

      <button className="td-focus-title" onClick={handleOpen}>{card.title}</button>

      {card.dueDate && (
        <p className="td-focus-due" style={{ color: dueDateColor(card.dueDate) }}>
          {isOverdue ? 'Was due ' : ''}{formatDueDate(card.dueDate, card.dueTime)}
        </p>
      )}

      <div className="td-focus-actions">
        <button
          className={`td-focus-done-btn${completing ? ' completing' : ''}`}
          onClick={handleDone}
        >
          <Check size={14} strokeWidth={2.5} />
          Mark done
        </button>
        {onUnfocus && (
          <button
            className="td-focus-unfocus-btn"
            onClick={e => { e.stopPropagation(); onUnfocus(card.id); }}
            title="Remove from focus"
          >
            <X size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const [width, setWidth] = useState(0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = total > 0 && done >= total;

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);

  if (total === 0) return null;

  const barColor = isComplete
    ? 'linear-gradient(90deg, #16a34a, #22c55e)'
    : 'linear-gradient(90deg, #fa420f, #f97316)';

  const motivational = isComplete
    ? "All done today!"
    : pct >= 70 ? "Almost there!"
    : pct >= 40 ? "Making progress"
    : "Let's get started";

  return (
    <div className="td-progress-area">
      <div className="td-progress-header">
        <span className="td-progress-label">
          <strong>{done}</strong> of <strong>{total}</strong> done today
        </span>
        <span className="td-progress-motivational">{motivational}</span>
      </div>
      <div className="td-progress-track">
        <div
          className={`td-progress-fill${isComplete ? ' td-progress-fill-complete' : ''}`}
          style={{ width: `${width}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// ─── Quick Capture ────────────────────────────────────────────────────────────

function QuickCapture({
  boards,
  onCreate,
}: {
  boards: TodayBoard[];
  onCreate: (boardId: string, title: string, dueDate?: string, labelId?: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [boardId, setBoardId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [labelId, setLabelId] = useState('');
  const [focused, setFocused] = useState(false);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boards.length > 0 && !boardId) {
      setBoardId(boards[0].id);
    }
  }, [boards, boardId]);

  // Reset label when board changes
  useEffect(() => {
    setLabelId('');
  }, [boardId]);

  // Keep focused=true while any child inside the container has focus
  const handleFocusIn = useCallback(() => setFocused(true), []);
  const handleFocusOut = useCallback((e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setFocused(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !boardId || adding) return;
    setAdding(true);
    hapticLight();
    await onCreate(boardId, title.trim(), dueDate || undefined, labelId || undefined);
    setTitle('');
    setDueDate('');
    setLabelId('');
    setAdding(false);
    inputRef.current?.focus();
  }, [title, boardId, dueDate, labelId, adding, onCreate]);

  const showExtras = focused || !!title;
  const currentBoard = boards.find(b => b.id === boardId);
  const boardLabels = currentBoard?.labels ?? [];

  return (
    <div
      ref={containerRef}
      className={`td-capture${focused ? ' focused' : ''}`}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
    >
      <div className="td-capture-icon">
        <Plus size={14} strokeWidth={2} />
      </div>
      <input
        ref={inputRef}
        className="td-capture-input"
        placeholder="Add a card..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        disabled={adding}
      />
      {showExtras && (
        <div className="td-capture-extras">
          <input
            type="date"
            className="td-capture-date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            title="Due date (optional)"
          />
          {boards.length > 1 && (
            <select
              className="td-capture-board"
              value={boardId}
              onChange={e => setBoardId(e.target.value)}
            >
              {boards.map(b => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          )}
          {boardLabels.length > 0 && (
            <select
              className="td-capture-label"
              value={labelId}
              onChange={e => setLabelId(e.target.value)}
              title="Label (optional)"
            >
              <option value="">No label</option>
              {boardLabels.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          <button
            className="td-capture-submit"
            onClick={handleSubmit}
            disabled={adding || !title.trim()}
          >
            {adding ? '...' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Card row ────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

interface TodayCardRowProps {
  card: TodayCard;
  onComplete: (id: string) => void;
  done?: boolean;
}

function TodayCardRow({ card, onComplete, done }: TodayCardRowProps) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const priority = card.priority as CardPriority | null;
  const pc = priority ? PRIORITY_CONFIG[priority] : null;

  const hasMeta = !done && (
    card.labels.length > 0 ||
    card.assigneeNames.length > 0 ||
    card.checklistTotal > 0 ||
    card.commentCount > 0
  );
  const hasDescription = !done && !!card.description?.trim();

  const handleComplete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (completing || done) return;
    setCompleting(true);
    hapticSuccess();
    onComplete(card.id);
  }, [card.id, completing, done, onComplete]);

  const handleRowClick = useCallback(() => {
    hapticLight();
    router.push(`/boards/${card.boardId}?card=${card.id}`);
  }, [card.boardId, card.id, router]);

  const checklistAllDone = card.checklistTotal > 0 && card.checklistDone === card.checklistTotal;

  return (
    <div
      className={`td-card-row${done ? ' td-card-row-done' : ''}`}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleRowClick()}
    >
      {/* Main row */}
      <div className="td-card-main">
        {done ? (
          <span className="td-done-check">
            <Check size={13} color="#22c55e" strokeWidth={2.5} />
          </span>
        ) : (
          pc ? (
            <span className="td-priority-pill" style={{ color: pc.color, background: pc.bg }}>
              {pc.label}
            </span>
          ) : (
            <span className="td-priority-dot" />
          )
        )}
        <span className={`td-card-title${done ? ' td-card-title-done' : ''}`}>{card.title}</span>
        <span className="td-board-chip">{card.boardTitle}</span>
        {card.dueDate && (
          <span className="td-due-date" style={{ color: done ? '#374151' : dueDateColor(card.dueDate) }}>
            {formatDueDate(card.dueDate, card.dueTime)}
          </span>
        )}
        {!done && (
          <button
            className={`td-complete-btn${completing ? ' completing' : ''}`}
            onClick={handleComplete}
            aria-label="Mark complete"
          >
            <Check size={13} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Description snippet */}
      {hasDescription && (
        <p className="td-card-desc">{card.description}</p>
      )}

      {/* Metadata row */}
      {hasMeta && (
        <div className="td-card-meta">
          {card.labels.map(l => (
            <span key={l.id} className="td-card-label" style={{ background: l.color }}>
              {l.name}
            </span>
          ))}
          {card.assigneeNames.map((name, i) => (
            <span key={i} className="td-assignee-badge" title={name}>
              {initials(name)}
            </span>
          ))}
          {card.checklistTotal > 0 && (
            <span
              className="td-meta-chip"
              style={{ color: checklistAllDone ? '#22c55e' : '#6b7280' }}
            >
              {checklistAllDone
                ? <SquareCheck size={11} strokeWidth={1.5} />
                : <Square size={11} strokeWidth={1.5} />}
              {card.checklistDone}/{card.checklistTotal}
            </span>
          )}
          {card.commentCount > 0 && (
            <span className="td-meta-chip" style={{ color: '#6b7280' }}>
              <MessageSquare size={11} strokeWidth={1.5} />
              {card.commentCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  count: number;
  cards: TodayCard[];
  onComplete: (id: string) => void;
  badgeColor: string;
  collapseAfter?: number;
  emptyMessage?: string;
  done?: boolean;
}

function TodaySection({ title, count, cards, onComplete, badgeColor, collapseAfter, emptyMessage, done }: SectionProps) {
  const [expanded, setExpanded] = useState(false);

  const shouldCollapse = collapseAfter !== undefined && cards.length > collapseAfter;
  const visible = shouldCollapse && !expanded ? cards.slice(0, collapseAfter) : cards;
  const hiddenCount = cards.length - (collapseAfter ?? cards.length);

  return (
    <div className="td-section">
      <div className="td-section-header">
        <h2 className="td-section-title">{title}</h2>
        {count > 0 && (
          <span className="td-section-badge" style={{ background: badgeColor }}>{count}</span>
        )}
      </div>
      {cards.length === 0 && emptyMessage ? (
        <p className="td-empty-section">{emptyMessage}</p>
      ) : (
        <>
          <div className="td-card-list">
            {visible.map(card => (
              <TodayCardRow key={card.id} card={card} onComplete={onComplete} done={done} />
            ))}
          </div>
          {shouldCollapse && (
            <button className="td-show-more" onClick={() => setExpanded(e => !e)}>
              {expanded ? 'Show less' : `Show ${hiddenCount} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── On Deck ─────────────────────────────────────────────────────────────────

function OnDeckSection({ cards }: { cards: TodayCard[] }) {
  const router = useRouter();
  if (cards.length === 0) return null;

  // Group by date
  const groups: { label: string; cards: TodayCard[] }[] = [];
  const seen = new Map<string, TodayCard[]>();
  for (const card of cards) {
    if (!card.dueDate) continue;
    if (!seen.has(card.dueDate)) seen.set(card.dueDate, []);
    seen.get(card.dueDate)!.push(card);
  }
  for (const [date, dateCards] of seen.entries()) {
    groups.push({ label: formatOnDeckDate(date), cards: dateCards });
  }

  return (
    <div className="td-section td-ondeck-section">
      <div className="td-section-header">
        <h2 className="td-section-title">On Deck</h2>
        <span className="td-section-badge" style={{ background: '#374151' }}>{cards.length}</span>
      </div>
      <div className="td-ondeck-groups">
        {groups.map(group => (
          <div key={group.label} className="td-ondeck-group">
            <span className="td-ondeck-day">{group.label}</span>
            <div className="td-ondeck-cards">
              {group.cards.map(card => {
                const priority = card.priority as CardPriority | null;
                const pc = priority ? PRIORITY_CONFIG[priority] : null;
                return (
                  <div
                    key={card.id}
                    className="td-ondeck-row"
                    onClick={() => { hapticLight(); router.push(`/boards/${card.boardId}?card=${card.id}`); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && router.push(`/boards/${card.boardId}?card=${card.id}`)}
                  >
                    {pc && (
                      <span className="td-ondeck-priority" style={{ background: pc.color }} />
                    )}
                    <span className="td-ondeck-title">{card.title}</span>
                    <span className="td-ondeck-board">{card.boardTitle}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Streak badge ─────────────────────────────────────────────────────────────

function StreakBadge({ days }: { days: number }) {
  if (days < 2) return null;
  return (
    <div className="td-streak">
      <Flame size={11} strokeWidth={1.5} fill="#fa420f" stroke="#fa420f" />
      <span>{days}-day streak</span>
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ num, label, color, show = true, active = false, onClick }: {
  num: number; label: string; color?: string; show?: boolean; active?: boolean; onClick?: () => void;
}) {
  if (!show) return null;
  const activeColor = color ?? '#6366f1';
  return (
    <div
      className={`td-stat-pill${active ? ' td-stat-pill-active' : ''}`}
      style={{
        borderColor: active ? activeColor : (color && num > 0) ? color + '55' : '#2a2d3a',
        background: active ? activeColor + '18' : '#1a1d27',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <span className="td-stat-num" style={{ color: (color && num > 0) ? color : '#9ca3af' }}>{num}</span>
      <span className="td-stat-label" style={{ color: active ? activeColor : undefined }}>{label}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type StatFilter = 'overdue' | 'dueToday' | 'doneToday' | 'assigned' | 'thisWeek' | null;

export default function TodayPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const {
    overdue, dueToday, myCards, onDeck, completedToday, focused,
    boards, starredBoards, stats, loading, error, refresh, markComplete, unfocusCard, toggleBoardStar, createCard,
  } = useTodayData();
  const [activeFilter, setActiveFilter] = useState<StatFilter>(null);

  const toggleFilter = useCallback((key: StatFilter) => {
    setActiveFilter(prev => prev === key ? null : key);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth?returnTo=/focus');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  // Refresh when the page becomes visible again (handles back-navigation from board cards
  // where Next.js router cache restores the page without remounting)
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, refresh]);

  if (authLoading || !user) {
    return (
      <div className="td-root">
        <style>{todayStyles}</style>
        <div className="td-loader"><FlameLoader delay={400} size={56} /></div>
      </div>
    );
  }

  const { line1 } = getGreeting(profile?.name ?? null);
  const statusMsg = getStatusMessage(stats.overdueCount, stats.dueTodayCount, stats.completedTodayCount);
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const autoFocusCard = focused.length === 0 ? (overdue[0] ?? dueToday[0] ?? null) : null;
  const progressTotal = stats.overdueCount + stats.dueTodayCount + stats.completedTodayCount;

  const isEmpty =
    overdue.length === 0 && dueToday.length === 0 &&
    myCards.length === 0 && completedToday.length === 0 && onDeck.length === 0 &&
    focused.length === 0;

  const handleCreate = useCallback(async (boardId: string, title: string, dueDate?: string, labelId?: string) => {
    await createCard(boardId, title, dueDate, labelId);
  }, [createCard]);

  return (
    <div className="td-root">
      <style>{todayStyles}</style>

      {/* ── Greeting banner ── */}
      <div className="td-banner">
        <div className="td-banner-inner">
          <div className="td-banner-left">
            <div className="td-greeting-row">
              <h1 className="td-greeting">{line1}</h1>
              <button
                className="td-refresh-btn"
                onClick={() => { hapticLight(); refresh(); }}
                disabled={loading}
                aria-label="Refresh"
              >
                <RotateCcw size={14} strokeWidth={1.5} className={loading ? 'spinning' : ''} />
              </button>
            </div>
            <p className="td-status-msg">{statusMsg}</p>
            <div className="td-date-row">
              <p className="td-date-label">{dateLabel}</p>
              <StreakBadge days={stats.streakDays} />
            </div>
          </div>
        </div>
        <ProgressBar done={stats.completedTodayCount} total={progressTotal} />
      </div>

      <div className="td-container">

        {/* ── Starred boards ── */}
        {!loading && <StarredBoardsSection boards={starredBoards} />}

        {/* ── User-focused cards ── */}
        {!loading && focused.length > 0 && (
          <div className="td-focused-section">
            <div className="td-focused-header">
              <Star size={13} fill="#fa420f" stroke="#fa420f" strokeWidth={1} />
              <span>Focus</span>
              <span className="td-focused-count">{focused.length}</span>
            </div>
            {focused.map(card => (
              <FocusCard key={card.id} card={card} onComplete={markComplete} onUnfocus={unfocusCard} />
            ))}
          </div>
        )}

        {/* ── Auto-focus card (when no user-focused cards) ── */}
        {!loading && autoFocusCard && (
          <FocusCard card={autoFocusCard} onComplete={markComplete} />
        )}

        {/* ── Stats ── */}
        <div className="td-stats-scroll">
          <div className="td-stats-row">
            <StatPill num={stats.overdueCount} label="Overdue" color="#ef4444" active={activeFilter === 'overdue'} onClick={() => toggleFilter('overdue')} />
            <StatPill num={stats.dueTodayCount} label="Due Today" color="#fa420f" active={activeFilter === 'dueToday'} onClick={() => toggleFilter('dueToday')} />
            <StatPill num={stats.completedTodayCount} label="Done Today" color="#22c55e" active={activeFilter === 'doneToday'} onClick={() => toggleFilter('doneToday')} />
            <StatPill num={stats.myCardsCount} label="Assigned" color="#6366f1" active={activeFilter === 'assigned'} onClick={() => toggleFilter('assigned')} />
            <StatPill num={stats.dueThisWeekCount} label="This Week" color="#6366f1" active={activeFilter === 'thisWeek'} onClick={() => toggleFilter('thisWeek')} />
            <StatPill num={stats.urgentCount} label="High Priority" color="#f97316" show={stats.urgentCount > 0} />
          </div>
        </div>

        {/* ── Quick capture ── */}
        {boards.length > 0 && (
          <QuickCapture boards={boards} onCreate={handleCreate} />
        )}

        {/* ── Error ── */}
        {error && <div className="td-error">{error}</div>}

        {/* ── Loading ── */}
        {loading && isEmpty && (
          <div className="td-loader-inline"><FlameLoader delay={0} size={40} /></div>
        )}

        {/* ── All clear ── */}
        {!loading && isEmpty && (
          <div className="td-all-clear">
            <div className="td-all-clear-ring">
              <CircleCheck size={52} color="#22c55e" strokeWidth={1.5} />
            </div>
            <p className="td-all-clear-title">All clear</p>
            <p className="td-all-clear-sub">No overdue cards, nothing due today, nothing assigned. Take a breath.</p>
          </div>
        )}

        {/* ── Card sections ── */}
        {!isEmpty && (
          <div className="td-sections">
            {(!activeFilter || activeFilter === 'overdue') && overdue.length > 0 && (
              <TodaySection
                title="Overdue"
                count={stats.overdueCount}
                cards={overdue}
                onComplete={markComplete}
                badgeColor="#ef4444"
                collapseAfter={10}
                emptyMessage="No overdue cards."
              />
            )}
            {(!activeFilter || activeFilter === 'dueToday') && dueToday.length > 0 && (
              <TodaySection
                title="Due Today"
                count={stats.dueTodayCount}
                cards={dueToday}
                onComplete={markComplete}
                badgeColor="#fa420f"
                emptyMessage="Nothing due today."
              />
            )}
            {(!activeFilter || activeFilter === 'assigned') && myCards.length > 0 && (
              <TodaySection
                title="Assigned to Me"
                count={myCards.length}
                cards={myCards}
                onComplete={markComplete}
                badgeColor="#6366f1"
                collapseAfter={8}
                emptyMessage="No assigned cards in the next 7 days."
              />
            )}
            {(!activeFilter || activeFilter === 'thisWeek') && (
              <OnDeckSection cards={onDeck} />
            )}
            {(!activeFilter || activeFilter === 'doneToday') && completedToday.length > 0 && (
              <TodaySection
                title="Completed Today"
                count={completedToday.length}
                cards={completedToday}
                onComplete={() => {}}
                badgeColor="#22c55e"
                collapseAfter={8}
                done
              />
            )}
            {activeFilter && (
              <button className="td-filter-clear" onClick={() => setActiveFilter(null)}>
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const todayStyles = `
  .td-root {
    min-height: 100vh;
    background: #0f1117;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  }

  .td-loader {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
  }

  /* ── Banner ── */
  .td-banner {
    background: linear-gradient(160deg, #12151f 0%, #0f1117 100%);
    border-bottom: 1px solid #1e2130;
    padding: 0 16px 20px;
  }

  .td-banner-inner {
    max-width: 900px;
    margin: 0 auto;
    padding-top: 22px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .td-banner-left {
    flex: 1;
    min-width: 0;
  }

  .td-greeting-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .td-greeting {
    font-size: 26px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .td-status-msg {
    font-size: 14px;
    color: #9ca3af;
    margin: 0 0 4px;
    font-weight: 400;
  }

  .td-date-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .td-date-label {
    font-size: 12px;
    color: #4b5563;
    margin: 0;
  }

  .td-streak {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #fa420f;
    background: rgba(250, 66, 15, 0.1);
    border: 1px solid rgba(250, 66, 15, 0.25);
    border-radius: 20px;
    padding: 2px 8px 2px 6px;
  }

  .td-refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: transparent;
    border: 1px solid #2a2d3a;
    border-radius: 8px;
    color: #4b5563;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .td-refresh-btn:hover { color: #9ca3af; border-color: #374151; }
  .td-refresh-btn:disabled { opacity: 0.4; cursor: default; }

  .spinning {
    animation: td-spin 0.8s linear infinite;
  }

  @keyframes td-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Progress ── */
  .td-progress-area {
    max-width: 900px;
    margin: 18px auto 0;
    padding: 0;
  }

  .td-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .td-progress-label {
    font-size: 12px;
    color: #6b7280;
  }

  .td-progress-label strong {
    color: #e5e7eb;
    font-weight: 600;
  }

  .td-progress-motivational {
    font-size: 11px;
    color: #4b5563;
    font-style: italic;
  }

  .td-progress-track {
    width: 100%;
    height: 5px;
    background: #1e2130;
    border-radius: 10px;
    overflow: hidden;
  }

  @keyframes td-shimmer {
    0%   { transform: translateX(-100%); opacity: 0; }
    20%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateX(350%); opacity: 0; }
  }

  .td-progress-fill {
    height: 100%;
    border-radius: 10px;
    position: relative;
    overflow: hidden;
    transition: width 0.9s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.4s ease;
  }

  .td-progress-fill::after {
    content: '';
    position: absolute;
    top: 0; left: 0; width: 30%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
    animation: td-shimmer 1.1s ease-out 0.7s 1 forwards;
    opacity: 0;
  }

  .td-progress-fill-complete {
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.45);
  }

  /* ── Container ── */
  .td-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px 16px 80px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Focus card ── */
  .td-focus-card {
    background: linear-gradient(135deg, #1a1d27 0%, #1c1f2e 100%);
    border: 1px solid #2a2d3a;
    border-left: 3px solid #fa420f;
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.25);
  }

  .td-focus-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .td-focus-labels {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .td-focus-eyebrow {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4b5563;
  }

  .td-focus-priority {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 4px;
  }

  .td-focus-board {
    font-size: 12px;
    color: #4b5563;
    background: #111318;
    border: 1px solid #1e2130;
    border-radius: 5px;
    padding: 2px 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  .td-focus-title {
    font-size: 17px;
    font-weight: 600;
    color: #f9fafb;
    margin: 0;
    padding: 0;
    line-height: 1.35;
    letter-spacing: -0.01em;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    display: block;
    width: 100%;
    transition: color 0.15s;
  }

  .td-focus-title:hover {
    color: #ffffff;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .td-focus-due {
    font-size: 12px;
    font-weight: 500;
    margin: 0;
  }

  .td-focus-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 2px;
  }

  .td-focus-done-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.3);
    border-radius: 8px;
    color: #22c55e;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .td-focus-done-btn:hover {
    background: rgba(34,197,94,0.18);
    border-color: rgba(34,197,94,0.5);
  }

  .td-focus-done-btn.completing {
    opacity: 0.6;
  }

.td-focus-unfocus-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    margin-left: auto;
    background: transparent;
    border: 1px solid #1e2130;
    border-radius: 7px;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .td-focus-unfocus-btn:hover {
    color: #6b7280;
    border-color: #2a2d3a;
    background: rgba(255,255,255,0.04);
  }

  /* ── Focused section wrapper ── */
  .td-focused-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .td-focused-header {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 2px;
  }

  .td-focused-header span:nth-child(2) {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #fa420f;
  }

  .td-focused-count {
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: #fa420f;
    border-radius: 10px;
    padding: 1px 7px;
    line-height: 1.5;
  }

  /* ── Starred boards ── */
  .td-starred-section {
    display: flex;
    flex-direction: column;
  }

  .td-starred-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .td-starred-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 12px 6px 10px;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 20px;
    color: #d1d5db;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .td-starred-chip:hover {
    background: #1e2130;
    border-color: #374151;
    color: #f9fafb;
  }

  .td-starred-chip-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .td-starred-chip-title {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }

  /* ── Stats ── */
  .td-stats-scroll {
    overflow-x: auto;
    scrollbar-width: none;
    padding: 4px 2px;
    margin: -4px -2px;
  }

  .td-stats-scroll::-webkit-scrollbar { display: none; }

  .td-stats-row {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .td-stat-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 14px 8px;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 12px;
    flex: 1;
    min-width: 0;
    transition: border-color 0.2s;
  }

  .td-stat-num {
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
  }

  .td-stat-label {
    font-size: 9px;
    color: #6b7280;
    white-space: nowrap;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .td-stat-pill-active {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }

  .td-filter-clear {
    display: block;
    margin: 8px auto 0;
    padding: 6px 16px;
    font-size: 12px;
    color: #6b7280;
    background: none;
    border: 1px solid #2a2d3a;
    border-radius: 20px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .td-filter-clear:hover {
    color: #e5e7eb;
    border-color: #4b5563;
  }

  /* ── Quick capture ── */
  .td-capture {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .td-capture.focused {
    border-color: #374151;
    box-shadow: 0 0 0 3px rgba(250,66,15,0.06);
  }

  .td-capture-icon {
    color: #4b5563;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .td-capture.focused .td-capture-icon {
    color: #fa420f;
  }

  .td-capture-input {
    flex: 1;
    min-width: 120px;
    background: transparent;
    border: none;
    outline: none;
    color: #e5e7eb;
    font-size: 14px;
    font-family: inherit;
  }

  .td-capture-input::placeholder {
    color: #374151;
  }

  .td-capture-extras {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    width: 100%;
  }

  .td-capture-board, .td-capture-label {
    background: #111318;
    border: 1px solid #2a2d3a;
    border-radius: 6px;
    color: #6b7280;
    font-size: 12px;
    padding: 5px 8px;
    outline: none;
    cursor: pointer;
    flex: 1;
    min-width: 80px;
    max-width: 160px;
  }

  .td-capture-submit {
    padding: 5px 14px;
    background: #fa420f;
    border: none;
    border-radius: 7px;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    margin-left: auto;
    transition: background 0.15s;
  }

  .td-capture-submit:hover { background: #e03a0d; }
  .td-capture-submit:disabled { opacity: 0.5; cursor: default; }

  .td-capture-date {
    background: #111318;
    border: 1px solid #2a2d3a;
    border-radius: 6px;
    color: #6b7280;
    font-size: 12px;
    padding: 5px 8px;
    outline: none;
    cursor: pointer;
    flex-shrink: 0;
    color-scheme: dark;
    font-family: inherit;
  }

  .td-capture-date:focus { border-color: #374151; }

  .td-capture-date::-webkit-calendar-picker-indicator {
    filter: invert(0.4);
    cursor: pointer;
  }

  /* ── Error ── */
  .td-error {
    padding: 10px 14px;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 8px;
    color: #ef4444;
    font-size: 13px;
  }

  .td-loader-inline {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
  }

  /* ── All clear ── */
  .td-all-clear {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 60px 24px;
  }

  .td-all-clear-ring { margin-bottom: 4px; }

  .td-all-clear-title {
    font-size: 17px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }

  .td-all-clear-sub {
    font-size: 13px;
    color: #4b5563;
    margin: 0;
    max-width: 280px;
    line-height: 1.6;
  }

  /* ── Sections ── */
  .td-sections {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .td-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .td-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .td-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4b5563;
    margin: 0;
  }

  .td-section-badge {
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    border-radius: 10px;
    padding: 1px 7px;
    line-height: 16px;
  }

  .td-empty-section {
    font-size: 13px;
    color: #374151;
    margin: 0;
    padding: 8px 0;
  }

  /* ── Card list ── */
  .td-card-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ── Card row ── */
  .td-card-row {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px 12px;
    background: #1a1d27;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    user-select: none;
  }

  .td-card-row:hover {
    background: #1e2130;
    border-color: #2a2d3a;
  }

  .td-card-row-done { opacity: 0.55; }
  .td-card-row-done:hover { opacity: 0.75; }

  .td-card-main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
  }

  .td-priority-pill {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .td-priority-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #2a2d3a;
    flex-shrink: 0;
  }

  .td-done-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .td-card-title {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: #e5e7eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .td-card-title-done {
    text-decoration: line-through;
    color: #374151;
  }

  .td-card-desc {
    font-size: 12px;
    color: #4b5563;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 14px;
    line-height: 1.4;
  }

  .td-card-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    padding-left: 14px;
  }

  .td-card-label {
    font-size: 10px;
    font-weight: 600;
    color: #fff;
    padding: 1px 6px;
    border-radius: 3px;
    white-space: nowrap;
    letter-spacing: 0.02em;
  }

  .td-assignee-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #2a2d3a;
    color: #9ca3af;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0;
    flex-shrink: 0;
  }

  .td-meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 500;
  }

  .td-board-chip {
    font-size: 11px;
    color: #4b5563;
    background: #111318;
    border: 1px solid #1e2130;
    border-radius: 5px;
    padding: 2px 7px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 110px;
    flex-shrink: 0;
  }

  .td-due-date {
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .td-complete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1.5px solid #2a2d3a;
    background: transparent;
    color: #374151;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .td-complete-btn:hover {
    border-color: #22c55e;
    color: #22c55e;
    background: rgba(34,197,94,0.07);
  }

  .td-complete-btn.completing {
    border-color: #22c55e;
    color: #22c55e;
  }

  /* ── Show more ── */
  .td-show-more {
    display: inline-flex;
    align-items: center;
    padding: 5px 11px;
    background: transparent;
    border: 1px solid #1e2130;
    border-radius: 6px;
    color: #4b5563;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 2px;
    transition: all 0.15s;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .td-show-more:hover {
    background: rgba(255,255,255,0.03);
    color: #6b7280;
  }

  /* ── On Deck ── */
  .td-ondeck-section {
    border-top: 1px solid #1a1d27;
    padding-top: 4px;
  }

  .td-ondeck-groups {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .td-ondeck-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .td-ondeck-day {
    font-size: 11px;
    font-weight: 600;
    color: #4b5563;
    padding: 0 2px 4px;
  }

  .td-ondeck-cards {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .td-ondeck-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #13151e;
    border: 1px solid transparent;
    border-radius: 7px;
    cursor: pointer;
    min-height: 38px;
    transition: background 0.1s, border-color 0.1s;
    user-select: none;
  }

  .td-ondeck-row:hover {
    background: #1a1d27;
    border-color: #1e2130;
  }

  .td-ondeck-priority {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .td-ondeck-title {
    flex: 1;
    font-size: 13px;
    font-weight: 400;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .td-ondeck-board {
    font-size: 11px;
    color: #374151;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Mobile ── */
  @media (max-width: 600px) {
    .td-greeting { font-size: 20px; }
    .td-status-msg { font-size: 13px; }

    .td-focus-title { font-size: 15px; }
    .td-focus-card { padding: 14px 16px; }

    .td-stats-scroll { overflow-x: visible; }
    .td-stats-row { flex-wrap: wrap; }
    .td-stat-pill { padding: 11px 6px; min-width: 0; flex: 1 1 calc(33.333% - 6px); }
    .td-stat-num { font-size: 18px; }
    .td-stat-label { font-size: 8px; }

    .td-board-chip { max-width: 72px; }
    .td-due-date { font-size: 10px; }

    .td-container { padding: 16px 12px 100px; gap: 14px; }
  }
`;
