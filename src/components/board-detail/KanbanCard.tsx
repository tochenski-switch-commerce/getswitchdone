'use client';

import React from 'react';
import type { BoardCard, CardPriority } from '@/types/board-types';
import {
  MessageSquare, CheckSquare, CalendarDays,
  User, Bell, Check,
} from '@/components/BoardIcons';
import { PRIORITY_CONFIG } from './helpers';

function formatTime12Short(val: string): string {
  if (!val) return '';
  const [h, m] = val.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function KanbanCard({
  card,
  onClick,
  isDragging,
  onPriorityChange,
  hasAlert,
}: {
  card: BoardCard;
  onClick: () => void;
  isDragging?: boolean;
  onPriorityChange?: (priority: CardPriority | null) => void;
  hasAlert?: boolean;
}) {
  const pri = card.priority ? PRIORITY_CONFIG[card.priority] : null;
  const labels = card.labels || [];
  const comments = card.comments || [];
  const checklists = card.checklists || [];
  const completedCount = checklists.filter(c => c.is_completed).length;

  const now = new Date();
  const nowMidnight = new Date(now);
  nowMidnight.setHours(0, 0, 0, 0);
  const dueDate = card.due_date ? new Date(card.due_date + 'T00:00:00') : null;
  const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - nowMidnight.getTime()) / 86400000) : null;
  // Time-aware overdue: if due today with a time, check if the time has passed
  const isOverdue = daysUntilDue !== null && (
    daysUntilDue < 0 ||
    (daysUntilDue === 0 && card.due_time && (() => {
      const [h, m] = card.due_time!.split(':').map(Number);
      return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
    })())
  );
  const isDueSoon = !isOverdue && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 2;

  return (
    <div
      className={`kb-card ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      draggable
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <p className="kb-card-title" style={{ flex: 1 }}>{card.title}</p>
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
              <span>{isOverdue ? 'Overdue' : isDueSoon ? (daysUntilDue === 0 ? 'Today' : daysUntilDue === 1 ? 'Tomorrow' : 'In 2 days') : new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{card.due_time ? ` ${formatTime12Short(card.due_time)}` : ''}</span>
            )}
          </span>
        )}

        {/* Right side: comment/checklist counts */}
        <span className="kb-card-counts">
          {comments.length > 0 && (
            <span className="kb-card-count"><MessageSquare size={10} /> {comments.length}</span>
          )}
          {checklists.length > 0 && (
            <span className={`kb-card-count ${completedCount === checklists.length ? 'done' : ''}`}>
              <CheckSquare size={10} /> {completedCount}/{checklists.length}
            </span>
          )}
        </span>
      </div>

      {/* Assignees */}
      {((card.assignees && card.assignees.length > 0) || card.assignee) && (
        <div className="kb-card-assignee">
          <User size={10} />
          {(card.assignees && card.assignees.length > 0 ? card.assignees : card.assignee ? [card.assignee] : []).map((name, i) => (
            <span key={name}>{i > 0 && ', '}@{name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(KanbanCard);
