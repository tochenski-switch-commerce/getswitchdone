'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/hooks/useTeams';
import { ArrowLeft, Users, Plus, Trash2, Edit3, Check, X, Copy, UserMinus, LogOut } from '@/components/BoardIcons';
import type { Team, TeamMember, TeamInvite } from '@/types/board-types';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const {
    teams, members, invites, loading, error,
    fetchTeams, fetchMembers, fetchInvites,
    createInvite, revokeInvite, removeMember, leaveTeam, deleteTeam, renameTeam, getMyRole,
  } = useTeams();

  const [team, setTeam] = useState<Team | null>(null);
  const [myRole, setMyRole] = useState<'owner' | 'member' | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const handleGenerateInvite = async () => {
    await createInvite(teamId);
  };

  const handleCopyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyInviteLink = (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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
                  style={{ fontSize: 18, padding: '6px 12px', maxWidth: 300 }}
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

        {/* Members Section */}
        <section className="kb-section">
          <h2 className="kb-section-title">Members ({members.length})</h2>
          <div className="kb-member-list">
            {members.map(m => (
              <div key={m.user_id} className="kb-member-row">
                <div className="kb-member-avatar">
                  {(m.user_profiles?.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kb-member-name">{m.user_profiles?.name || 'Unnamed'}</div>
                  <span className={`kb-role-badge ${m.role}`}>{m.role}</span>
                </div>
                {isOwner && m.user_id !== user.id && (
                  <button className="kb-btn-icon kb-btn-icon-danger" onClick={() => handleRemoveMember(m.user_id)} title="Remove member">
                    <UserMinus size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Invites Section (owner only) */}
        {isOwner && (
          <section className="kb-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="kb-section-title" style={{ margin: 0 }}>Invite Links</h2>
              <button className="kb-btn kb-btn-primary" onClick={handleGenerateInvite} style={{ padding: '6px 14px', fontSize: 12 }}>
                <Plus size={14} /> Generate Link
              </button>
            </div>
            {invites.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 13 }}>No invite links yet. Generate one to share with others.</p>
            ) : (
              <div className="kb-invite-list">
                {invites.map(inv => (
                  <div key={inv.id} className={`kb-invite-row${!inv.is_active ? ' revoked' : ''}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <code className="kb-invite-code">{inv.invite_code}</code>
                      <div className="kb-invite-meta">
                        Used {inv.use_count}{inv.max_uses ? ` / ${inv.max_uses}` : ''} times
                        {inv.expires_at && ` · Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                        {!inv.is_active && ' · Revoked'}
                      </div>
                    </div>
                    {inv.is_active && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="kb-btn kb-btn-ghost"
                          onClick={() => handleCopyInviteLink(inv.invite_code)}
                          title="Copy invite link"
                          style={{ padding: '5px 10px', fontSize: 11 }}
                        >
                          <Copy size={12} /> {copiedCode === inv.invite_code ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button
                          className="kb-btn kb-btn-ghost kb-btn-danger"
                          onClick={() => revokeInvite(inv.id)}
                          title="Revoke invite"
                          style={{ padding: '5px 10px', fontSize: 11 }}
                        >
                          <X size={12} /> Revoke
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
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
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
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
    font-size: 14px;
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
  .kb-role-badge.member { background: rgba(99,102,241,0.15); color: #818cf8; }
  .kb-invite-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kb-invite-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    flex-wrap: wrap;
  }
  .kb-invite-row.revoked { opacity: 0.5; }
  .kb-invite-code {
    font-family: 'SF Mono', SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    color: #818cf8;
    background: rgba(99,102,241,0.1);
    padding: 2px 8px;
    border-radius: 4px;
  }
  .kb-invite-meta {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
  }
`;
