'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/hooks/useTeams';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Users, Trash2, Edit3, Check, X, Copy, UserMinus, LogOut, Calendar,
  getBoardIcon, DEFAULT_ICON_COLOR,
  StickyNote, Bold, Italic, Underline, Strikethrough, Heading, ListBullet, ListOrdered, LinkIcon,
} from '@/components/BoardIcons';
import type { Team, ProjectBoard } from '@/types/board-types';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const {
    teams, members, invites, error,
    fetchTeams, fetchMembers, fetchInvites,
    createInvite, removeMember, updateMemberRole, transferOwnership, leaveTeam, deleteTeam, renameTeam, getMyRole, updateTeamNotes,
  } = useTeams();

  const [team, setTeam] = useState<Team | null>(null);
  const [myRole, setMyRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [teamBoards, setTeamBoards] = useState<ProjectBoard[]>([]);

  // ── Notes panel ──
  const [showNotePanel, setShowNotePanel] = useState(false);
  const noteRef = useRef<HTMLDivElement>(null);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth?returnTo=/teams/${teamId}`);
    }
  }, [authLoading, user, router, teamId]);

  const fetchTeamBoards = useCallback(async () => {
    const { data } = await supabase
      .from('project_boards')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (data) setTeamBoards(data);
  }, [teamId]);

  useEffect(() => {
    if (user && teamId) {
      fetchTeams();
      fetchMembers(teamId);
      fetchInvites(teamId);
      fetchTeamBoards();
      getMyRole(teamId).then(setMyRole);
    }
  }, [user, teamId, fetchTeams, fetchMembers, fetchInvites, fetchTeamBoards, getMyRole]);

  useEffect(() => {
    const t = teams.find(t => t.id === teamId);
    if (t) { setTeam(t); setNameInput(t.name); }
  }, [teams, teamId]);

  // Sync note content when team loads (only on team id change, not on every notes save)
  useEffect(() => {
    if (team?.notes != null && noteRef.current) {
      const html = team.notes;
      if (html && !/<[a-z][\s\S]*>/i.test(html)) {
        noteRef.current.innerHTML = html.replace(/\n/g, '<br>');
      } else {
        noteRef.current.innerHTML = html || '';
      }
    }
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up autosave timer on unmount
  useEffect(() => {
    return () => {
      if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    };
  }, []);

  const saveNoteNow = useCallback(() => {
    if (!noteRef.current || !team) return;
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    const html = noteRef.current.innerHTML;
    if (html !== (team.notes || '')) {
      updateTeamNotes(teamId, html);
    }
  }, [team, teamId, updateTeamNotes]);

  const handleNoteInput = useCallback(() => {
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(saveNoteNow, 1500);
  }, [saveNoteNow]);

  const execNoteCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    noteRef.current?.focus();
  };

  const insertNoteLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return;
        document.execCommand('createLink', false, parsed.href);
      } catch { /* invalid URL — ignore */ }
    }
    noteRef.current?.focus();
  };

  const closeNotePanel = useCallback(() => {
    saveNoteNow();
    setShowNotePanel(false);
  }, [saveNoteNow]);

  const handleRename = async () => {
    if (!nameInput.trim() || !teamId) return;
    await renameTeam(teamId, nameInput);
    setEditingName(false);
  };

  const getOrCreateActiveInvite = useCallback(async () => {
    let activeInvite = invites.find(i => i.is_active);
    if (!activeInvite) {
      const created = await createInvite(teamId);
      if (!created) return null;
      activeInvite = created;
    }
    return activeInvite;
  }, [invites, createInvite, teamId]);

  const handleCopyInviteLink = async () => {
    const activeInvite = await getOrCreateActiveInvite();
    if (!activeInvite) return;
    const url = `${window.location.origin}/join/${activeInvite.invite_code}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCopyInviteCode = async () => {
    const activeInvite = await getOrCreateActiveInvite();
    if (!activeInvite) return;
    await navigator.clipboard.writeText(activeInvite.invite_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRoleChange = async (userId: string, role: 'editor' | 'viewer') => {
    await updateMemberRole(teamId, userId, role);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the team?')) return;
    await removeMember(teamId, userId);
  };

  const handleTransferOwnership = async (userId: string, name: string) => {
    if (!confirm(`Transfer ownership to ${name}? You will become an editor and lose owner permissions.`)) return;
    await transferOwnership(teamId, userId);
    setMyRole('editor');
  };

  const handleLeave = async () => {
    if (!confirm('Leave this team? You will lose access to team boards.')) return;
    await leaveTeam(teamId);
    router.replace('/teams');
  };

  const handleDelete = async () => {
    if (!confirm('Delete this team? All invite links will be removed. Team boards will become personal boards.')) return;
    await deleteTeam(teamId);
    router.replace('/teams');
  };

  if (authLoading || !user) return null;

  const isOwner = myRole === 'owner';
  const canEditNotes = myRole === 'owner' || myRole === 'editor';
  const activeInviteCode = invites.find(i => i.is_active)?.invite_code ?? '';

  return (
    <div className="kb-root">
      <style>{detailStyles}</style>
      <div className="kb-container">
        {/* Header */}
        <div className="kb-header">
          <button className="kb-btn-icon" onClick={() => router.push('/teams')} title="Back to teams">
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingName && isOwner ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="kb-input"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false); }}
                  style={{ fontSize: 16, padding: '8px 12px', flex: 1, minWidth: 0 }}
                />
                <button className="kb-btn kb-btn-primary" onClick={handleRename} style={{ padding: '6px 12px' }}><Check size={14} /></button>
                <button className="kb-btn kb-btn-ghost" onClick={() => setEditingName(false)} style={{ padding: '6px 12px' }}><X size={14} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={24} style={{ color: '#818cf8', flexShrink: 0 }} />
                <h1 className="kb-page-title" style={{ margin: 0 }}>{team?.name || 'Team'}</h1>
                {isOwner && (
                  <button className="kb-btn-icon" onClick={() => { setEditingName(true); setNameInput(team?.name || ''); }} title="Rename team">
                    <Edit3 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={`kb-note-toggle${showNotePanel ? ' kb-note-toggle-active' : ''}`}
              onClick={() => setShowNotePanel(v => !v)}
              title="Team notes"
            >
              <StickyNote size={14} />
              <span>Notes</span>
            </button>
            {!isOwner && (
              <button className="kb-btn kb-btn-ghost kb-btn-danger" onClick={handleLeave}>
                <LogOut size={14} /> Leave
              </button>
            )}
            {isOwner && (
              <button className="kb-btn kb-btn-ghost kb-btn-danger" onClick={handleDelete}>
                <Trash2 size={14} /> Delete Team
              </button>
            )}
          </div>
        </div>

        {error && <p className="kb-error">{error}</p>}

        {/* Invite */}
        {isOwner && (
          <section className="kb-section">
            <div className="kb-invite-actions">
              <button
                className={`kb-copy-link-btn${linkCopied ? ' copied' : ''}`}
                onClick={handleCopyInviteLink}
              >
                <Copy size={16} />
                <span>{linkCopied ? 'Link Copied!' : 'Copy Invite Link'}</span>
              </button>
              <button
                className={`kb-copy-code-btn${codeCopied ? ' copied' : ''}`}
                onClick={handleCopyInviteCode}
              >
                <Copy size={16} />
                <span>{codeCopied ? 'Code Copied!' : 'Copy Invite Code'}</span>
              </button>
            </div>
            <div className="kb-invite-code-readout">
              <span className="kb-invite-code-label">Invite Code</span>
              <code className="kb-invite-code-value">{activeInviteCode || 'No active code yet'}</code>
            </div>
          </section>
        )}

        {/* Team Boards */}
        <section className="kb-section">
          <h2 className="kb-section-title">Boards ({teamBoards.length})</h2>
          {teamBoards.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6b7280' }}>No boards in this team yet.</p>
          ) : (
            <div className="kb-board-grid">
              {teamBoards.map(board => {
                const Icon = getBoardIcon(board.icon);
                return (
                  <div
                    key={board.id}
                    className="kb-board-card"
                    onClick={() => router.push(`/boards/${board.id}`)}
                  >
                    <div className="kb-board-card-header">
                      <Icon size={20} style={{ color: board.icon_color || DEFAULT_ICON_COLOR }} />
                      <h3 className="kb-board-card-title">{board.title}</h3>
                    </div>
                    {board.description && (
                      <p className="kb-board-card-desc">{board.description}</p>
                    )}
                    <div className="kb-board-card-footer">
                      <span className="kb-board-card-date">
                        <Calendar size={12} />
                        {new Date(board.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Members Section */}
        <section className="kb-section">
          <h2 className="kb-section-title">Members ({members.length})</h2>
          <div className="kb-member-list">
            {members.map(m => {
              const isMe = m.user_id === user.id;
              const isMemberOwner = m.role === 'owner';

              return (
                <div key={m.user_id} className="kb-member-row">
                  <div className="kb-member-avatar">
                    {(m.user_profiles?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kb-member-name">
                      {m.user_profiles?.name || 'Unnamed'}
                      {isMe && <span style={{ color: '#6b7280', fontWeight: 400 }}> (you)</span>}
                    </div>
                    {isMemberOwner ? (
                      <span className="kb-role-badge owner">owner</span>
                    ) : isOwner && !isMe ? (
                      <select
                        className="kb-role-select"
                        value={m.role}
                        onChange={e => handleRoleChange(m.user_id, e.target.value as 'editor' | 'viewer')}
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`kb-role-badge ${m.role}`}>{m.role}</span>
                    )}
                  </div>
                  {isOwner && !isMe && !isMemberOwner && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="kb-btn-icon kb-btn-icon-transfer"
                        onClick={() => handleTransferOwnership(m.user_id, m.user_profiles?.name || 'this member')}
                        title="Transfer ownership"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      <button className="kb-btn-icon kb-btn-icon-danger" onClick={() => handleRemoveMember(m.user_id)} title="Remove member">
                        <UserMinus size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Note Panel (slide-in from right) ── */}
      <div className={`kb-note-panel${showNotePanel ? ' open' : ''}`}>
        <div className="kb-note-header">
          <div className="kb-note-header-title">
            <StickyNote size={16} />
            Team Notes
          </div>
          <button className="kb-note-close-btn" onClick={closeNotePanel} title="Close notes">
            <X size={18} />
          </button>
        </div>
        {canEditNotes && (
          <div className="kb-note-toolbar">
            <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('bold'); }} title="Bold"><Bold size={14} /></button>
            <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('italic'); }} title="Italic"><Italic size={14} /></button>
            <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('underline'); }} title="Underline"><Underline size={14} /></button>
            <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('strikeThrough'); }} title="Strikethrough"><Strikethrough size={14} /></button>
            <div className="kb-note-tool-sep" />
            <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('formatBlock', '<h3>'); }} title="Heading"><Heading size={14} /></button>
            <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('insertUnorderedList'); }} title="Bullet list"><ListBullet size={14} /></button>
            <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('insertOrderedList'); }} title="Numbered list"><ListOrdered size={14} /></button>
            <div className="kb-note-tool-sep" />
            <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); insertNoteLink(); }} title="Insert link"><LinkIcon size={14} /></button>
          </div>
        )}
        <div className="kb-note-body">
          <div
            ref={noteRef}
            className="kb-note-editable"
            contentEditable={canEditNotes}
            suppressContentEditableWarning
            onInput={canEditNotes ? handleNoteInput : undefined}
            onBlur={canEditNotes ? saveNoteNow : undefined}
            onClick={e => {
              const target = e.target as HTMLElement;
              const anchor = target.closest('a');
              if (anchor && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                window.open(anchor.href, '_blank', 'noopener,noreferrer');
              }
            }}
          />
        </div>
        {!canEditNotes && (
          <div className="kb-note-readonly-hint">
            <span>Viewers can read but not edit team notes.</span>
          </div>
        )}
      </div>
    </div>
  );
}

const detailStyles = `
  .kb-root {
    min-height: 100vh;
    background: #0f1117 !important;
    color: #e5e7eb !important;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  }
  .kb-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px 16px 100px;
  }
  .kb-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 32px;
    flex-wrap: wrap;
  }
  .kb-page-title {
    font-size: 22px;
    font-weight: 700;
    color: #f9fafb;
  }
  .kb-btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .kb-btn-icon:hover { background: rgba(255,255,255,0.08); color: #e5e7eb; }
  .kb-btn-icon-danger:hover { background: rgba(239,68,68,0.15); color: #ef4444; }
  .kb-btn-icon-transfer { color: #6b7280; }
  .kb-btn-icon-transfer:hover { background: rgba(234,179,8,0.15); color: #eab308; }
  .kb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    outline: none;
  }
  .kb-btn-primary { background: #6366f1; color: #fff; }
  .kb-btn-primary:hover { background: #4f46e5; }
  .kb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .kb-btn-ghost { background: transparent; color: #9ca3af; border: 1px solid #374151; }
  .kb-btn-ghost:hover { background: rgba(255,255,255,0.05); }
  .kb-btn-danger { color: #ef4444 !important; border-color: rgba(239,68,68,0.3) !important; }
  .kb-btn-danger:hover { background: rgba(239,68,68,0.1) !important; }
  .kb-input {
    width: 100%;
    background: #0f1117;
    border: 1px solid #374151;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 16px;
    color: #e5e7eb;
    outline: none;
    box-sizing: border-box;
  }
  .kb-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
  .kb-error {
    font-size: 13px;
    color: #ef4444;
    margin: 0 0 16px;
    padding: 8px 12px;
    background: rgba(239,68,68,0.1);
    border-radius: 8px;
    border: 1px solid rgba(239,68,68,0.2);
  }
  .kb-section {
    margin-bottom: 36px;
  }
  .kb-section-title {
    font-size: 15px;
    font-weight: 700;
    color: #e5e7eb;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 16px;
  }
  .kb-member-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kb-member-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
  }
  .kb-member-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #2563eb;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .kb-member-name {
    font-size: 14px;
    font-weight: 600;
    color: #f9fafb;
    margin-bottom: 2px;
  }
  .kb-role-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .kb-role-badge.owner { background: rgba(234,179,8,0.15); color: #eab308; }
  .kb-role-badge.editor { background: rgba(99,102,241,0.15); color: #818cf8; }
  .kb-role-badge.viewer { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .kb-role-select {
    appearance: none;
    background: #0f1117 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 6px 28px 6px 10px;
    font-size: 13px;
    font-weight: 600;
    color: #e5e7eb;
    cursor: pointer;
    outline: none;
    min-height: 32px;
    transition: border-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .kb-role-select:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
  .kb-role-select option { background: #1a1d27; color: #e5e7eb; }
  .kb-invite-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
  }
  .kb-copy-link-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px 20px;
    background: rgba(99, 102, 241, 0.08);
    border: 1px dashed rgba(99, 102, 241, 0.35);
    border-radius: 10px;
    color: #818cf8;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-copy-link-btn:hover { background: rgba(99, 102, 241, 0.15); border-color: #6366f1; }
  .kb-copy-link-btn:active { transform: scale(0.98); }
  .kb-copy-link-btn.copied { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.35); color: #22c55e; }
  .kb-copy-code-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px 20px;
    background: rgba(59, 130, 246, 0.08);
    border: 1px dashed rgba(59, 130, 246, 0.35);
    border-radius: 10px;
    color: #60a5fa;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-copy-code-btn:hover { background: rgba(59, 130, 246, 0.15); border-color: #3b82f6; }
  .kb-copy-code-btn:active { transform: scale(0.98); }
  .kb-copy-code-btn.copied { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.35); color: #22c55e; }
  .kb-invite-code-readout {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #2a2d3a;
    background: rgba(17, 24, 39, 0.6);
  }
  .kb-invite-code-label {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .kb-invite-code-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 12px;
    color: #cbd5e1;
    background: rgba(51, 65, 85, 0.45);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 6px;
    padding: 4px 8px;
    white-space: nowrap;
  }

  .kb-board-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
  .kb-board-card {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 12px;
    padding: 18px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-board-card:hover {
    border-color: #6366f1;
    background: #1e2130;
    transform: translateY(-1px);
  }
  .kb-board-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .kb-board-card-title {
    font-size: 15px;
    font-weight: 600;
    color: #f9fafb;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kb-board-card-desc {
    font-size: 12px;
    color: #6b7280;
    margin: 0 0 10px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .kb-board-card-footer {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .kb-board-card-date {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #4b5563;
    font-weight: 500;
  }

  /* ── Notes toggle button ── */
  .kb-note-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid #3b3f54;
    background: #1e2235;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .kb-note-toggle:hover { background: #262b44; color: #cbd5e1; border-color: #4b5068; }
  .kb-note-toggle-active {
    background: rgba(99, 102, 241, 0.15) !important;
    color: #a5b4fc !important;
    border-color: rgba(99, 102, 241, 0.4) !important;
  }
  .kb-note-toggle-active:hover { background: rgba(99, 102, 241, 0.25) !important; }

  /* ── Note Panel ── */
  .kb-note-panel {
    position: fixed;
    top: 64px;
    right: 0;
    bottom: 0;
    width: 400px;
    background: #1a1d2e;
    border-left: 1px solid #2a2d3a;
    display: flex;
    flex-direction: column;
    z-index: 900;
    transform: translateX(100%);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: -4px 0 24px rgba(0,0,0,0.3);
  }
  .kb-note-panel.open { transform: translateX(0); }
  .kb-note-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #2a2d3a;
    flex-shrink: 0;
  }
  .kb-note-header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    color: #e2e8f0;
  }
  .kb-note-close-btn {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 32px !important;
    height: 32px !important;
    border-radius: 8px !important;
    border: 1px solid #3b3f54 !important;
    background: #1e2235 !important;
    color: #94a3b8 !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
    flex-shrink: 0 !important;
    padding: 0 !important;
  }
  .kb-note-close-btn:hover {
    background: #ef4444 !important;
    border-color: #ef4444 !important;
    color: #fff !important;
  }
  .kb-note-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid #2a2d3a;
    background: rgba(15, 17, 23, 0.5);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .kb-note-tool-btn {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 32px !important;
    height: 32px !important;
    border-radius: 6px !important;
    border: none !important;
    background: transparent !important;
    color: #94a3b8 !important;
    cursor: pointer !important;
    transition: all 0.12s ease !important;
    padding: 0 !important;
  }
  .kb-note-tool-btn:hover {
    background: rgba(99, 102, 241, 0.15) !important;
    color: #a5b4fc !important;
  }
  .kb-note-tool-btn:active {
    background: rgba(99, 102, 241, 0.25) !important;
    color: #c7d2fe !important;
  }
  .kb-note-tool-sep {
    width: 1px;
    height: 20px;
    background: #2a2d3a;
    margin: 0 4px;
    flex-shrink: 0;
  }
  .kb-note-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
  .kb-note-editable {
    min-height: 100%;
    outline: none;
    color: #e2e8f0;
    font-size: 14px;
    line-height: 1.7;
    word-break: break-word;
    caret-color: #818cf8;
  }
  .kb-note-editable:empty::before {
    content: 'Start typing your notes...';
    color: #4b5068;
    font-style: italic;
    pointer-events: none;
  }
  .kb-note-editable h3 {
    font-size: 17px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 16px 0 8px 0;
    line-height: 1.3;
  }
  .kb-note-editable h3:first-child { margin-top: 0; }
  .kb-note-editable a {
    color: #818cf8;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: text;
    position: relative;
  }
  .kb-note-editable a:hover { color: #a5b4fc; cursor: pointer; }
  .kb-note-editable a:hover::after {
    content: '⌘ click to open';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #1e2235;
    color: #94a3b8;
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid #3b3f54;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10;
    font-style: normal;
    font-weight: 500;
    text-decoration: none;
    line-height: 1.4;
  }
  .kb-note-editable ul {
    padding-left: 24px;
    margin: 8px 0;
    list-style-type: disc !important;
  }
  .kb-note-editable ol {
    padding-left: 24px;
    margin: 8px 0;
    list-style-type: decimal !important;
  }
  .kb-note-editable li { margin: 2px 0; display: list-item !important; }
  .kb-note-editable blockquote {
    border-left: 3px solid #6366f1;
    padding-left: 12px;
    margin: 8px 0;
    color: #94a3b8;
    font-style: italic;
  }
  .kb-note-editable s { color: #64748b; }
  .kb-note-readonly-hint {
    padding: 10px 16px;
    font-size: 12px;
    color: #4b5563;
    border-top: 1px solid #2a2d3a;
    flex-shrink: 0;
    text-align: center;
  }

  /* ── Mobile ── */
  @media (max-width: 480px) {
    .kb-container { padding: 16px 12px 80px; }
    .kb-page-title { font-size: 18px; }
    .kb-header { gap: 8px; margin-bottom: 24px; }
    .kb-member-row { padding: 10px 12px; gap: 10px; }
    .kb-member-avatar { width: 32px; height: 32px; font-size: 13px; }
    .kb-member-name { font-size: 13px; }
    .kb-invite-actions { grid-template-columns: minmax(0, 1fr); }
    .kb-copy-link-btn { padding: 12px 16px; font-size: 13px; }
    .kb-copy-code-btn { padding: 12px 16px; font-size: 13px; }
    .kb-invite-code-readout { padding: 8px 10px; }
    .kb-invite-code-label { font-size: 11px; }
    .kb-invite-code-value { font-size: 11px; }
    .kb-btn { padding: 8px 12px; font-size: 12px; }
    .kb-note-panel { width: 100%; top: auto; height: 65vh; transform: translateY(100%); }
    .kb-note-panel.open { transform: translateY(0); }
    .kb-note-toggle span { display: none; }
  }
`;
