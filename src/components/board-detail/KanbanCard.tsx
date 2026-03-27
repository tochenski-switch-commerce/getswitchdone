'use client';

import type { BoardCard, CardPriority } from '@/types/board-types';
import {
  MessageSquare, CheckSquare, CalendarDays,
  User, Bell, ChevronRight, Repeat, Clock,
} from '@/components/BoardIcons';
import { PRIORITY_CONFIG, formatRepeatSummary } from './helpers';

export default function KanbanCard({
  card,
  onClick,
  isDragging,
  onPriorityChange,
  hasAlert,
  onMoveToNext,
  onToggleComplete,
  isSnoozed,
}: {
  card: BoardCard;
  onClick: () => void;
  isDragging?: boolean;
  onPriorityChange?: (priority: CardPriority | null) => void;
  hasAlert?: boolean;
  onMoveToNext?: () => void;
  onToggleComplete?: () => void;
  isSnoozed?: boolean;
}) {
  const pri = card.priority ? PRIORITY_CONFIG[card.priority] : null;
  const labels = card.labels || [];
  const comments = card.comments || [];
  const checklists = card.checklists || [];
  const completedCount = checklists.filter(c => c.is_completed).length;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dueDate = card.due_date ? new Date(card.due_date + 'T00:00:00') : null;
  const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000) : null;
  const isOverdue = !card.is_complete && daysUntilDue !== null && daysUntilDue < 0;
  const isDueSoon = !card.is_complete && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 2;

  const nextChecklistDue = !card.is_complete
    ? (checklists
        .filter(c => !c.is_completed && c.due_date)
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0] ?? null)
    : null;
  const clDueDate = nextChecklistDue?.due_date
    ? (() => { const d = new Date(nextChecklistDue.due_date!); d.setHours(0, 0, 0, 0); return d; })()
    : null;
  const clDaysUntilDue = clDueDate ? Math.ceil((clDueDate.getTime() - now.getTime()) / 86400000) : null;
  const isClOverdue = clDaysUntilDue !== null && clDaysUntilDue < 0;
  const isClDueSoon = clDaysUntilDue !== null && clDaysUntilDue >= 0 && clDaysUntilDue <= 2;

  return (
    <div
      className={`kb-card ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      draggable
      style={isSnoozed ? { opacity: 0.5, borderStyle: 'dashed' } : card.is_complete ? { opacity: 0.55 } : undefined}
    >
      {/* Priority select + Labels row */}
      {(pri || labels.length > 0) && (
        <div className="kb-card-labels">
          {pri && (
            <select
              className="kb-card-priority-select"
              value={card.priority || ''}
              style={{ color: pri.color, background: pri.bg, borderColor: pri.color }}
              onClick={e => e.stopPropagation()}
              onChange={e => {
                e.stopPropagation();
                const val = e.target.value || null;
                onPriorityChange?.(val as CardPriority | null);
              }}
            >
              <option value="">No Priority</option>
              {(Object.keys(PRIORITY_CONFIG) as CardPriority[]).map(p => (
                <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
          )}
          {labels.map(l => (
            <span key={l.id} className="kb-card-label" style={{ background: l.color }} title={l.name}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {onToggleComplete && (
          <button
            onClick={e => { e.stopPropagation(); onToggleComplete(); }}
            title={card.is_complete ? 'Mark incomplete' : 'Mark complete'}
            style={{
              flexShrink: 0,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: card.is_complete ? '#22c55e' : '#4b5563',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {card.is_complete ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22c55e" />
                <polyline points="8 12 11 15 16 9" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
              </svg>
            )}
          </button>
        )}
        <p
          className="kb-card-title"
          style={{
            flex: 1,
            textDecoration: card.is_complete ? 'line-through' : undefined,
            color: card.is_complete ? '#6b7280' : undefined,
          }}
        >
          {card.title}
        </p>
        {card.is_focused && (
          <span title="Focused on Today" style={{ display: 'flex', alignItems: 'center', color: '#fa420f', flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </span>
        )}
        {isSnoozed && (
          <span title={`Snoozed until ${new Date(card.snoozed_until!).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`} style={{ display: 'flex', alignItems: 'center', color: '#9ca3af', flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </span>
        )}
        {hasAlert && (
          <span className="kb-card-alert" title="You have unread notifications for this card">
            <Bell size={12} />
          </span>
        )}
      </div>

      {/* Metadata row */}
      <div className="kb-card-meta">
        {/* Dates */}
        {(card.start_date || card.due_date) && (
          <span className={`kb-card-dates ${isOverdue ? 'overdue' : ''} ${isDueSoon ? 'due-soon' : ''}`}>
            <CalendarDays size={10} />
            {card.start_date && (
              <span>{new Date(card.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            )}
            {card.start_date && card.due_date && <span className="kb-card-date-sep">→</span>}
            {card.due_date && (
              <span>{isOverdue ? 'Overdue' : isDueSoon ? (daysUntilDue === 0 ? 'Today' : daysUntilDue === 1 ? 'Tomorrow' : 'In 2 days') : new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            )}
          </span>
        )}

        {/* Next checklist item due date */}
        {clDueDate && (
          <span
            className={`kb-card-dates ${isClOverdue ? 'overdue' : ''} ${isClDueSoon ? 'due-soon' : ''}`}
            title={`Next checklist item due: ${nextChecklistDue!.title}`}
          >
            <CheckSquare size={10} />
            <span>
              {isClOverdue
                ? 'Task overdue'
                : isClDueSoon
                ? (clDaysUntilDue === 0 ? 'Task today' : clDaysUntilDue === 1 ? 'Task tomorrow' : 'Task in 2 days')
                : clDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </span>
        )}

        {/* Repeat badge */}
        {card.repeat_rule && (
          <span className="kb-card-repeat-front">
            <Repeat size={10} />
            {formatRepeatSummary(card.repeat_rule)}
          </span>
        )}

        {/* Right side: comment/checklist counts */}
        <span className="kb-card-counts">
          {comments.length > 0 && (
            <span className="kb-card-count"><MessageSquare size={10} /> {comments.length}</span>
          )}
          {checklists.length > 0 && (
            <span className={`kb-card-count ${completedCount === checklists.length ? 'done' : ''}`}>
              <CheckSquare size={10} /> {completedCount} of {checklists.length}
            </span>
          )}
        </span>
      </div>

      {/* Created / Updated dates */}
      <div className="kb-card-timestamps">
        <Clock size={9} />
        <span title={`Created: ${new Date(card.created_at).toLocaleString()}`}>
          {new Date(card.created_at).toLocaleDateString('en-US', { month: 'numeric', day: '2-digit', year: '2-digit' })}
        </span>
        {card.updated_at !== card.created_at && (
          <span title={`Updated: ${new Date(card.updated_at).toLocaleString()}`} className="kb-card-updated">
            · {new Date(card.updated_at).toLocaleDateString('en-US', { month: 'numeric', day: '2-digit', year: '2-digit' })}
          </span>
        )}
      </div>

      {/* Assignee */}
      {card.assignee && (
        <div className="kb-card-assignee">
          <User size={10} />
          @{card.assignee}
        </div>
      )}

      {/* Move to next column */}
      {onMoveToNext && (
        <button
          className="kb-card-move-next"
          title="Move to next list"
          onClick={e => { e.stopPropagation(); onMoveToNext(); }}
        >
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
