'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/hooks/useTeams';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradeBanner from '@/components/UpgradeBanner';
import { Plus, Users, X, ArrowLeft } from '@/components/BoardIcons';

export default function TeamsListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { teams, loading, error, fetchTeams, createTeam, fetchTeamMemberCounts } = useTeams();
  const { canUseTeams, showPaywall } = useSubscription();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth?returnTo=/teams');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) fetchTeams();
  }, [user, fetchTeams]);

  useEffect(() => {
    if (teams.length > 0) {
      fetchTeamMemberCounts(teams.map(t => t.id)).then(setMemberCounts);
    }
  }, [teams, fetchTeamMemberCounts]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const team = await createTeam(newName);
    setCreating(false);
    if (team) {
      setNewName('');
      setShowCreate(false);
      router.push(`/teams/${team.id}`);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="kb-root">
      <style>{teamsStyles}</style>
      <div className="kb-container">
        <div className="kb-header">
          <div className="kb-header-left">
            <Users size={28} style={{ color: '#818cf8' }} />
            <h1 className="kb-page-title">Teams</h1>
          </div>
          <button className="kb-btn kb-btn-primary" onClick={() => {
            if (!canUseTeams) { showPaywall(); return; }
            setShowCreate(true);
          }}>
            <Plus size={16} />
            New Team
          </button>
        </div>

        {!canUseTeams && (
          <UpgradeBanner message="Teams are a Pro feature. Upgrade to collaborate with others." />
        )}

        {showCreate && (
          <div className="kb-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
            <div className="kb-modal">
              <h2 className="kb-modal-title">Create New Team</h2>
              <div className="kb-form-group">
                <label className="kb-label">Team Name</label>
                <input
                  className="kb-input"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Design Team"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              {error && <p className="kb-error">{error}</p>}
              <div className="kb-modal-actions">
                <button className="kb-btn kb-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="kb-btn kb-btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && teams.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 100, background: '#1a1d21', borderRadius: 12, opacity: 0.7 - i * 0.1 }} />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="kb-empty">
            <Users size={48} style={{ color: '#4b5563', marginBottom: 16 }} />
            <h3 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No teams yet</h3>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>Create a team to collaborate with others.</p>
            <button className="kb-btn kb-btn-primary" onClick={() => {
              if (!canUseTeams) { showPaywall(); return; }
              setShowCreate(true);
            }}>
              <Plus size={16} /> Create Team
            </button>
          </div>
        ) : (
          <div className="kb-team-grid">
            {teams.map(team => (
              <div key={team.id} className="kb-team-card" onClick={() => router.push(`/teams/${team.id}`)}>
                <div className="kb-team-card-header">
                  <Users size={20} style={{ color: '#818cf8' }} />
                  <h3 className="kb-team-card-title">{team.name}</h3>
                </div>
                <div className="kb-team-card-footer">
                  <span className="kb-member-badge">
                    {memberCounts[team.id] || 1} member{(memberCounts[team.id] || 1) !== 1 ? 's' : ''}
                  </span>
                  <span className="kb-team-card-date">
                    Created {new Date(team.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const teamsStyles = `
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
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .kb-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .kb-page-title {
    font-size: 22px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }
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
  .kb-btn-primary {
    background: #6366f1;
    color: #fff;
  }
  .kb-btn-primary:hover { background: #4f46e5; }
  .kb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .kb-btn-ghost {
    background: transparent;
    color: #9ca3af;
    border: 1px solid #374151;
  }
  .kb-btn-ghost:hover { background: rgba(255,255,255,0.05); }
  .kb-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .kb-modal {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 16px;
    padding: 28px 24px;
    max-width: 420px;
    width: 100%;
  }
  .kb-modal-title {
    font-size: 18px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0 0 20px;
  }
  .kb-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }
  .kb-form-group { margin-bottom: 16px; }
  .kb-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }
  .kb-input {
    width: 100%;
    background: #0f1117;
    border: 1px solid #374151;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px;
    color: #e5e7eb;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }
  .kb-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
  .kb-error {
    font-size: 13px;
    color: #ef4444;
    margin: 0 0 8px;
    padding: 8px 12px;
    background: rgba(239,68,68,0.1);
    border-radius: 8px;
    border: 1px solid rgba(239,68,68,0.2);
  }
  .kb-empty {
    text-align: center;
    padding: 64px 0;
  }
  .kb-team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .kb-team-card {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 12px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-team-card:hover {
    border-color: #4f46e5;
    background: #1e2130;
  }
  .kb-team-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .kb-team-card-title {
    font-size: 16px;
    font-weight: 600;
    color: #f9fafb;
    margin: 0;
  }
  .kb-team-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .kb-member-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #818cf8;
    background: rgba(99,102,241,0.1);
    padding: 3px 10px;
    border-radius: 999px;
    font-weight: 600;
  }
  .kb-team-card-date {
    font-size: 12px;
    color: #6b7280;
  }
`;
