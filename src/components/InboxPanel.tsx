'use client';

import React from 'react';
import type { Notification } from '@/types/board-types';
import { Bell, X, MessageSquare, User, Clock, AlertCircle, Check, Trash2, Mail, AtSign } from '@/components/BoardIcons';
import { hapticLight, hapticHeavy, hapticSuccess } from '@/lib/haptics';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  comment:        { icon: <MessageSquare size={14} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  assignment:     { icon: <User size={14} />,          color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  due_soon:       { icon: <Clock size={14} />,         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  overdue:        { icon: <AlertCircle size={14} />,   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  email_unrouted: { icon: <Mail size={14} />,          color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
  mention:        { icon: <AtSign size={14} />,        color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
};

function stripHtml(html: string): string {
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
  return html.replace(/<[^>]*>/g, '');
}

function timeAgo(dateStr: string): string {
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

export default function InboxPanel({
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onClearAll,
  onNavigate,
}: {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onNavigate?: (boardId: string, cardId: string) => void;
}) {
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <div className="kb-inbox-backdrop" onClick={onClose} />
      <div className="kb-inbox-panel">
        <style>{inboxStyles}</style>

        {/* Header */}
        <div className="kb-inbox-header">
          <div className="kb-inbox-header-left">
            <Bell size={18} style={{ color: '#818cf8' }} />
            <span className="kb-inbox-title">Inbox</span>
            {unreadCount > 0 && (
              <span className="kb-inbox-badge">{unreadCount}</span>
            )}
          </div>
          <div className="kb-inbox-header-actions">
            {unreadCount > 0 && (
              <button className="kb-inbox-action-btn" onClick={() => { hapticSuccess(); onMarkAllRead(); }} title="Mark all as read">
                <Check size={14} /> Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button className="kb-inbox-action-btn kb-inbox-action-danger" onClick={() => { hapticHeavy(); onClearAll(); }} title="Clear all">
                <Trash2 size={14} /> Clear all
              </button>
            )}
            <button className="kb-btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* Notification list */}
        <div className="kb-inbox-list">
          {notifications.length === 0 ? (
            <div className="kb-inbox-empty">
              <Bell size={32} style={{ color: '#374151', marginBottom: 8 }} />
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map(n => {
              const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.comment;
              return (
                <div
                  key={n.id}
                  className={`kb-inbox-item ${n.is_read ? 'kb-inbox-item-read' : ''}`}
                  onClick={() => {
                    if (!n.is_read) onMarkRead(n.id);
                    if (onNavigate && n.board_id && n.card_id) onNavigate(n.board_id, n.card_id);
                  }}
                >
                  <div className="kb-inbox-item-icon" style={{ background: config.bg, color: config.color }}>
                    {config.icon}
                  </div>
                  <div className="kb-inbox-item-content">
                    <div className="kb-inbox-item-title">{n.title}</div>
                    {n.body && <div className="kb-inbox-item-body">{stripHtml(n.body)}</div>}
                    <div className="kb-inbox-item-time">{timeAgo(n.created_at)}</div>
                  </div>
                  <div className="kb-inbox-item-actions">
                    {!n.is_read && (
                      <button
                        className="kb-inbox-item-btn"
                      onClick={e => { e.stopPropagation(); hapticLight(); onMarkRead(n.id); }}
                        title="Mark as read"
                      >
                        <Check size={12} />
                      </button>
                    )}
                    <button
                      className="kb-inbox-item-btn kb-inbox-item-btn-danger"
                      onClick={e => { e.stopPropagation(); hapticHeavy(); onDelete(n.id); }}
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

const inboxStyles = `
  .kb-inbox-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
  }
  .kb-inbox-panel {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 8px);
    right: 8px;
    width: 400px;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - env(safe-area-inset-top, 0px) - 16px);
    background: #141620;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .kb-inbox-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #2a2d3a;
  }
  .kb-inbox-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .kb-inbox-title {
    font-size: 15px;
    font-weight: 700;
    color: #f9fafb;
  }
  .kb-inbox-badge {
    background: #ef4444;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }
  .kb-inbox-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .kb-inbox-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    background: none;
    border: none;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .kb-inbox-action-btn:hover {
    background: #1f2937;
    color: #e5e7eb;
  }
  .kb-inbox-action-danger:hover {
    background: rgba(239,68,68,0.12);
    color: #ef4444;
  }
  .kb-inbox-list {
    overflow-y: auto;
    flex: 1;
    max-height: 500px;
  }
  .kb-inbox-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    color: #6b7280;
    font-size: 13px;
  }
  .kb-inbox-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.12s;
    border-bottom: 1px solid #1e2130;
  }
  .kb-inbox-item:hover {
    background: #1a1d27;
  }
  .kb-inbox-item-read {
    opacity: 0.55;
  }
  .kb-inbox-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .kb-inbox-item-content {
    flex: 1;
    min-width: 0;
  }
  .kb-inbox-item-title {
    font-size: 13px;
    font-weight: 600;
    color: #e5e7eb;
    line-height: 1.35;
  }
  .kb-inbox-item-body {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 2px;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kb-inbox-item-time {
    font-size: 11px;
    color: #6b7280;
    margin-top: 3px;
  }
  .kb-inbox-item-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .kb-inbox-item:hover .kb-inbox-item-actions {
    opacity: 1;
  }
  .kb-inbox-item-btn {
    background: none;
    border: none;
    padding: 4px;
    border-radius: 6px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kb-inbox-item-btn:hover {
    background: #1f2937;
    color: #e5e7eb;
  }
  .kb-inbox-item-btn-danger:hover {
    background: rgba(239,68,68,0.12);
    color: #ef4444;
  }
`;
