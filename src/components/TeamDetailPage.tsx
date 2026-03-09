'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/hooks/useTeams';
import { ArrowLeft, Users, Trash2, Edit3, Check, X, Copy, UserMinus, LogOut } from '@/components/BoardIcons';
import type { Team, TeamMember, TeamInvite } from '@/types/board-types';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const {
    teams, members, invites, loading, error,
    fetchTeams, fetchMembers, fetchInvites,
    createInvite, revokeInvite, removeMember, updateMemberRole, leaveTeam, deleteTeam, renameTeam, getMyRole,
  } = useTeams();

  const [team, setTeam] = useState<Team | null>(null);
  const [myRole, setMyRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth?returnTo=/teams/${teamId}`);
    }
  }, [authLoading, user, router, teamId]);

  useEffect(() => {
    if (user && teamId) {
      fetchTeams();
      fetchMembers(teamId);
      fetchInvites(teamId);
      getMyRole(teamId).then(setMyRole);
    }
  }, [user, teamId, fetchTeams, fetchMembers, fetchInvites, getMyRole]);

  useEffect(() => {
    const t = teams.find(t => t.id === teamId);
    if (t) { setTeam(t); setNameInput(t.name); }
  }, [teams, teamId]);

  const handleRename = async () => {
    if (!nameInput.trim() || !teamId) return;
    await renameTeam(teamId, nameInput);
    setEditingName(false);
  };

  const handleCopyInviteLink = async () => {
    // Re-use an existing active invite, or create one on the fly
    let activeInvite = invites.find(i => i.is_active);
    if (!activeInvite) {
      const created = await createInvite(teamId);
      if (!created) return;
      activeInvite = created;
    }
    const url = `${window.location.origin}/join/${activeInvite.invite_code}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleRoleChange = async (userId: string, role: 'editor' | 'viewer') => {
    await updateMemberRole(teamId, userId, role);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the team?')) return;
    await removeMember(teamId, userId);
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
          <div style={{ display: 'flex', gap: 8 }}>
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

        {/* Invite Link */}
        {isOwner && (
          <section className="kb-section">
            <button
              className={`kb-copy-link-btn${linkCopied ? ' copied' : ''}`}
              onClick={handleCopyInviteLink}
            >
              <Copy size={16} />
              <span>{linkCopied ? 'Link Copied!' : 'Copy Invite Link'}</span>
            </button>
          </section>
        )}

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
                    <button className="kb-btn-icon kb-btn-icon-danger" onClick={() => handleRemoveMember(m.user_id)} title="Remove member">
                      <UserMinus size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
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

  /* ── Mobile ── */
  @media (max-width: 480px) {
    .kb-container { padding: 16px 12px 80px; }
    .kb-page-title { font-size: 18px; }
    .kb-header { gap: 8px; margin-bottom: 24px; }
    .kb-member-row { padding: 10px 12px; gap: 10px; }
    .kb-member-avatar { width: 32px; height: 32px; font-size: 13px; }
    .kb-member-name { font-size: 13px; }
    .kb-copy-link-btn { padding: 12px 16px; font-size: 13px; }
    .kb-btn { padding: 8px 12px; font-size: 12px; }
  }
`;
