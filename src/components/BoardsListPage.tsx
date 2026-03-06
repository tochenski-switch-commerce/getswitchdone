'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
/* AUTH: Replace with your auth hook */
import { useAuth } from '@/contexts/AuthContext';
import { useProjectBoard } from '@/hooks/useProjectBoard';
import InboxPanel from '@/components/InboxPanel';
import {
  Plus,
  LayoutDashboard,
  Trash2,
  Archive,
  Calendar,
  FolderKanban,
  Globe,
  Lock,
  User,
  Edit3,
  X,
  Check,
  FileText,
  Bell,
  Copy,
  getBoardIcon,
  BOARD_ICONS,
  ICON_COLORS,
  DEFAULT_ICON_COLOR,
} from '@/components/BoardIcons';
import type { BoardIconKey } from '@/components/BoardIcons';

function BoardsListPage() {
  const { user, loading: authLoading, profile, signOut, updateProfileName } = useAuth();
  const router = useRouter();
  const { boards, fetchBoards, createBoard, deleteBoard, duplicateBoard, loading, error,
    notifications, fetchNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, clearAllNotifications,
  } = useProjectBoard();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState<BoardIconKey>('folder-kanban');
  const [newIconColor, setNewIconColor] = useState(DEFAULT_ICON_COLOR);
  const [newIconHex, setNewIconHex] = useState('');
  const overlayMouseDown = useRef<EventTarget | null>(null);
  const [creating, setCreating] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    await updateProfileName(nameInput);
    setSavingName(false);
    setEditingName(false);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth?returnTo=%2Fboards');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchBoards();
      fetchNotifications();
    }
  }, [user, fetchBoards, fetchNotifications]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const board = await createBoard(newTitle, newDesc, newIcon, newIconColor);
    setCreating(false);
    if (board) {
      setNewTitle('');
      setNewDesc('');
      setNewIcon('folder-kanban');
      setNewIconColor(DEFAULT_ICON_COLOR);
      setNewIconHex('');
      setShowCreate(false);
      router.push(`/boards/${board.id}`);
    }
  };

  return (
    <div className="kb-root">
      <style>{boardsListStyles}</style>
      <div className="kb-container">
        {/* Header */}
        <div className="kb-header">
          <div className="kb-header-left">
            <FolderKanban size={28} style={{ color: '#818cf8' }} />
            <h1 className="kb-page-title">Project Boards</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="kb-btn kb-btn-ghost" onClick={() => router.push('/forms')}>
              <FileText size={16} />
              Forms
            </button>
            <button className="kb-btn kb-btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              New Board
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className="kb-btn-icon"
                onClick={() => setShowInbox(!showInbox)}
                title="Inbox"
                style={{ position: 'relative' }}
              >
                <Bell size={18} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span style={{
                    position: 'absolute', top: 0, right: 0, width: 8, height: 8,
                    borderRadius: '50%', background: '#ef4444',
                  }} />
                )}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <button
                className="kb-user-avatar-btn"
                onClick={() => { setShowUserMenu(!showUserMenu); if (!showUserMenu && profile) setNameInput(profile.name); }}
                title={profile?.name || user?.email || 'Account'}
              >
                {profile?.name ? profile.name.charAt(0).toUpperCase() : <User size={16} />}
              </button>
              {showUserMenu && (
                <>
                  <div className="kb-click-away" onClick={() => { setShowUserMenu(false); setEditingName(false); }} />
                  <div className="kb-user-dropdown">
                    <div className="kb-user-dropdown-header">
                      <div className="kb-user-dropdown-email">{user?.email}</div>
                    </div>
                    <div className="kb-user-dropdown-section">
                      <div className="kb-user-dropdown-label">Display Name (@handle)</div>
                      {editingName ? (
                        <div className="kb-user-name-edit">
                          <input
                            className="kb-input"
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            placeholder="Your display name"
                            autoFocus
                            maxLength={40}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                            style={{ fontSize: 13, padding: '7px 10px' }}
                          />
                          <button className="kb-btn kb-btn-primary" onClick={handleSaveName} disabled={savingName || !nameInput.trim()} style={{ padding: '6px 12px', fontSize: 12 }}>
                            <Check size={12} /> Save
                          </button>
                          <button className="kb-btn kb-btn-ghost" onClick={() => setEditingName(false)} style={{ padding: '6px 10px', fontSize: 12 }}>
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="kb-user-name-display">
                          <span className="kb-user-name-value">{profile?.name || <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Not set</span>}</span>
                          <button className="kb-btn-icon" onClick={() => { setEditingName(true); setNameInput(profile?.name || ''); }} title="Edit name">
                            <Edit3 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="kb-user-dropdown-divider" />
                    <button
                      className="kb-user-dropdown-item danger"
                      onClick={async () => { await signOut(); router.replace('/auth'); }}
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="kb-modal-overlay"
            onMouseDown={e => { overlayMouseDown.current = e.target; }}
            onClick={e => { if (e.target === e.currentTarget && overlayMouseDown.current === e.currentTarget) setShowCreate(false); }}
          >
            <div className="kb-modal">
              <h2 className="kb-modal-title">Create New Board</h2>
              <div className="kb-form-group">
                <label className="kb-label">Board Title</label>
                <input
                  className="kb-input"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Website Redesign"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="kb-form-group">
                <label className="kb-label">Icon</label>
                <div className="kb-icon-grid">
                  {BOARD_ICONS.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      className={`kb-icon-option${newIcon === key ? ' selected' : ''}`}
                      onClick={() => setNewIcon(key)}
                      title={label}
                      type="button"
                    >
                      <Icon size={18} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="kb-form-group">
                <label className="kb-label">Icon Color</label>
                <div className="kb-icon-color-grid">
                  {ICON_COLORS.map(({ value, label }) => (
                    <button
                      key={value}
                      className={`kb-color-swatch${newIconColor === value ? ' selected' : ''}`}
                      style={{ backgroundColor: value }}
                      onClick={() => setNewIconColor(value)}
                      title={label}
                      type="button"
                    />
                  ))}
                </div>
                <div className="kb-hex-row">
                  <span className="kb-hex-label">#</span>
                  <input
                    className="kb-hex-input"
                    value={newIconHex}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                      setNewIconHex(v);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && /^[0-9a-fA-F]{3,6}$/.test(newIconHex)) {
                        e.preventDefault();
                        const hex = newIconHex.length === 3 ? newIconHex.split('').map(c => c + c).join('') : newIconHex;
                        setNewIconColor(`#${hex}`);
                        setNewIconHex('');
                      }
                    }}
                    placeholder="hex e.g. ff6b6b"
                    maxLength={6}
                  />
                  <button
                    className="kb-btn kb-btn-primary"
                    style={{ padding: '5px 10px', fontSize: 11 }}
                    disabled={!/^[0-9a-fA-F]{3,6}$/.test(newIconHex)}
                    onClick={() => {
                      const hex = newIconHex.length === 3 ? newIconHex.split('').map(c => c + c).join('') : newIconHex;
                      setNewIconColor(`#${hex}`);
                      setNewIconHex('');
                    }}
                    type="button"
                  >
                    Apply
                  </button>
                </div>
              </div>
              <div className="kb-form-group">
                <label className="kb-label">Description (optional)</label>
                <textarea
                  className="kb-textarea"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Brief description of this board..."
                  rows={3}
                />
              </div>
              {error && (
                <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 8px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>
              )}
              <div className="kb-modal-actions">
                <button className="kb-btn kb-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="kb-btn kb-btn-primary" onClick={handleCreate} disabled={creating || !newTitle.trim()}>
                  {creating ? 'Creating...' : 'Create Board'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Board grid */}
        {loading && boards.length === 0 ? (
          <div className="kb-loading">
            <div className="kb-spinner" />
            <p>Loading boards...</p>
          </div>
        ) : boards.length === 0 ? (
          <div className="kb-empty">
            <LayoutDashboard size={48} style={{ color: '#4b5563', marginBottom: '16px' }} />
            <h3 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No boards yet</h3>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '20px' }}>Create your first project board to get started.</p>
            <button className="kb-btn kb-btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              Create Board
            </button>
          </div>
        ) : (
          <div className="kb-board-grid">
            {boards.map(board => (
              <div
                key={board.id}
                className="kb-board-card"
                onClick={() => router.push(`/boards/${board.id}`)}
              >
                <div className="kb-board-card-header">
                  {React.createElement(getBoardIcon(board.icon), { size: 20, style: { color: board.icon_color || DEFAULT_ICON_COLOR } })}
                  <h3 className="kb-board-card-title">{board.title}</h3>
                  {board.is_public && (
                    <span className="kb-visibility-badge public"><Globe size={10} /> Public</span>
                  )}
                </div>
                {board.user_id !== user?.id && (
                  <div className="kb-shared-by"><User size={11} /> Shared board</div>
                )}
                {board.description && (
                  <p className="kb-board-card-desc">{board.description}</p>
                )}
                <div className="kb-board-card-footer">
                  <span className="kb-board-card-date">
                    <Calendar size={12} />
                    {new Date(board.created_at).toLocaleDateString()}
                  </span>
                  {board.user_id === user?.id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <button
                        className="kb-btn-icon"
                        onClick={async e => {
                          e.stopPropagation();
                          setDuplicatingId(board.id);
                          const dup = await duplicateBoard(board.id);
                          setDuplicatingId(null);
                          if (dup) router.push(`/boards/${dup.id}`);
                        }}
                        title="Duplicate board"
                        disabled={duplicatingId === board.id}
                        style={duplicatingId === board.id ? { opacity: 0.5 } : undefined}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="kb-btn-icon kb-btn-icon-danger"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm('Delete this board? This cannot be undone.')) {
                            deleteBoard(board.id);
                          }
                        }}
                        title="Delete board"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInbox && (
        <InboxPanel
          notifications={notifications}
          onClose={() => setShowInbox(false)}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
          onDelete={deleteNotification}
          onClearAll={clearAllNotifications}
          onNavigate={(boardId) => router.push(`/boards/${boardId}`)}
        />
      )}
    </div>
  );
}

/* AUTH: Wrap with your own auth guard in layout/middleware */
export default BoardsListPage;

const boardsListStyles = `
  .kb-root {
    min-height: 100vh;
    background: #0f1117 !important;
    color: #e5e7eb !important;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  }
  .kb-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 16px 100px;
  }
  .kb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }
  .kb-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .kb-page-title {
    font-size: 24px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 !important;
  }

  /* Buttons */
  .kb-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    outline: none;
    white-space: nowrap;
  }
  .kb-btn-primary {
    background: #6366f1 !important;
    color: #fff !important;
  }
  .kb-btn-primary:hover {
    background: #4f46e5 !important;
    transform: translateY(-1px);
  }
  .kb-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  .kb-btn-ghost {
    background: transparent !important;
    color: #9ca3af !important;
    border: 1px solid #374151 !important;
  }
  .kb-btn-ghost:hover {
    background: #1f2937 !important;
    color: #e5e7eb !important;
  }
  .kb-btn-icon {
    background: none !important;
    border: none;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kb-btn-icon:hover {
    background: #1f2937 !important;
    color: #e5e7eb !important;
  }
  .kb-btn-icon-danger:hover {
    background: rgba(239, 68, 68, 0.15) !important;
    color: #ef4444 !important;
  }

  /* Board grid */
  .kb-board-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  .kb-board-card {
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .kb-board-card:hover {
    border-color: #6366f1;
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3), 0 8px 24px rgba(0,0,0,0.3);
    transform: translateY(-2px);
  }
  .kb-board-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .kb-board-card-title {
    font-size: 16px !important;
    font-weight: 600 !important;
    color: #f9fafb !important;
    margin: 0 !important;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kb-visibility-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .kb-visibility-badge.public {
    background: rgba(34,197,94,0.12) !important;
    color: #22c55e;
    border: 1px solid rgba(34,197,94,0.25);
  }
  .kb-shared-by {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #818cf8;
    margin-bottom: 6px;
  }
  .kb-board-card-desc {
    font-size: 13px !important;
    color: #9ca3af !important;
    margin: 0 0 12px 0 !important;
    line-height: 1.4 !important;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .kb-board-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .kb-board-card-date {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #6b7280;
  }

  /* Modal */
  .kb-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50000;
    padding: 16px;
  }
  .kb-modal {
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 16px;
    padding: 28px;
    max-width: 480px;
    width: 100%;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }
  .kb-modal-title {
    font-size: 18px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 0 20px 0 !important;
  }
  .kb-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }

  /* Form */
  .kb-form-group { margin-bottom: 16px; }
  .kb-label {
    display: block;
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #9ca3af !important;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px !important;
  }
  .kb-input, .kb-textarea, .kb-select {
    width: 100%;
    background: #0f1117 !important;
    border: 1px solid #374151 !important;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px !important;
    color: #e5e7eb !important;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }
  .kb-input:focus, .kb-textarea:focus, .kb-select:focus {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
  }
  .kb-textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  /* Loading / Empty */
  .kb-loading, .kb-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    text-align: center;
  }
  .kb-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #374151;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: kb-spin 0.8s linear infinite;
    margin-bottom: 16px;
  }
  @keyframes kb-spin {
    to { transform: rotate(360deg); }
  }

  /* User menu */
  .kb-user-avatar-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #2a2d3a;
    border: 2px solid #374151;
    color: #e5e7eb;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-user-avatar-btn:hover {
    border-color: #6366f1;
    background: #1e293b;
  }
  .kb-click-away {
    position: fixed;
    inset: 0;
    z-index: 49999;
  }
  .kb-user-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 12px;
    width: 280px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    z-index: 50000;
    overflow: hidden;
  }
  .kb-user-dropdown-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid #2a2d3a;
  }
  .kb-user-dropdown-email {
    font-size: 12px;
    color: #9ca3af;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kb-user-dropdown-section {
    padding: 12px 16px;
  }
  .kb-user-dropdown-label {
    font-size: 10px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .kb-user-name-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .kb-user-name-value {
    font-size: 14px;
    color: #e5e7eb;
    font-weight: 600;
  }
  .kb-user-name-edit {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .kb-user-name-edit .kb-input {
    flex: 1;
    min-width: 0;
  }
  .kb-user-dropdown-divider {
    height: 1px;
    background: #2a2d3a;
  }
  .kb-user-dropdown-item {
    display: block;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: none;
    color: #e5e7eb;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .kb-user-dropdown-item:hover {
    background: #1f2937;
  }
  .kb-user-dropdown-item.danger {
    color: #ef4444;
  }
  .kb-user-dropdown-item.danger:hover {
    background: rgba(239,68,68,0.1);
  }

  /* Icon picker grid */
  .kb-icon-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .kb-icon-option {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1.5px solid #2a2d3a;
    background: #1a1d27 !important;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.12s ease;
    padding: 0;
  }
  .kb-icon-option:hover {
    border-color: #6366f1;
    color: #e5e7eb;
    background: #23263a !important;
  }
  .kb-icon-option.selected {
    border-color: #818cf8;
    background: rgba(99,102,241,0.18) !important;
    color: #818cf8;
    box-shadow: 0 0 0 1px rgba(99,102,241,0.3);
  }
  .kb-icon-color-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .kb-color-swatch {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: all 0.12s ease;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
    outline: none;
  }
  .kb-color-swatch:hover {
    transform: scale(1.15);
    border-color: rgba(255,255,255,0.4);
  }
  .kb-color-swatch.selected {
    border-color: #fff;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.25);
    transform: scale(1.15);
  }
  .kb-hex-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
  }
  .kb-hex-label {
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
  }
  .kb-hex-input {
    flex: 1;
    background: #0f1117;
    border: 1px solid #2a2d3a;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 12px;
    font-family: monospace;
    padding: 5px 8px;
    outline: none;
    min-width: 0;
  }
  .kb-hex-input:focus {
    border-color: #6366f1;
  }
  .kb-hex-input::placeholder {
    color: #4b5563;
  }
`;
