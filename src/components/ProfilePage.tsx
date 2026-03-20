'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/hooks/useTeams';
import { supabase } from '@/lib/supabase';
import {
  User, Mail, Key, Bell, Shield, Users, LogOut, Trash2,
  Check, X, Eye, EyeOff, LinkIcon, AlertCircle, Settings,
  ArrowLeft, Sparkles,
} from '@/components/BoardIcons';
import { useSubscription } from '@/hooks/useSubscription';
export default function ProfilePage() {
  const { user, profile, signOut, updatePassword, updateProfileName, loading: authLoading } = useAuth();
  const router = useRouter();
  const { teams, fetchTeams, leaveTeam, joinTeam } = useTeams();
  const { isProUser: isPro, status: subStatus, currentPeriodEnd, isStaffGrant, showPaywall, refresh: refreshSub } = useSubscription();
  // ── Display name ──
  const [name, setName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Email ──
  const [email, setEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Password ──
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwShow, setPwShow] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Notifications ──
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [dueSoonNotifs, setDueSoonNotifs] = useState(true);
  const [commentNotifs, setCommentNotifs] = useState(true);
  const [assignNotifs, setAssignNotifs] = useState(true);

  // ── Teams ──
  const [joinLink, setJoinLink] = useState('');
  const [joining, setJoining] = useState(false);
  const [teamMsg, setTeamMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Danger zone ──
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Init ──
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth?returnTo=/profile');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (profile) setName(profile.name);
    if (user?.email) setEmail(user.email);
  }, [profile, user]);

  useEffect(() => {
    if (user) fetchTeams();
  }, [user, fetchTeams]);

  // Check push permission state
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  // ── Handlers ──
  const handleSaveName = async () => {
    if (!name.trim()) return;
    setNameSaving(true);
    setNameMsg(null);

    // Check uniqueness (case-insensitive)
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .ilike('name', name.trim())
      .neq('id', user!.id)
      .limit(1);
    if (existing && existing.length > 0) {
      setNameMsg({ type: 'err', text: 'That username is already taken.' });
      setNameSaving(false);
      return;
    }

    const { error } = await updateProfileName(name.trim());
    setNameSaving(false);
    setNameMsg(error
      ? { type: 'err', text: error.message }
      : { type: 'ok', text: 'Name updated.' });
  };

  const handleSaveEmail = async () => {
    if (!email.trim()) return;
    setEmailSaving(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setEmailSaving(false);
    setEmailMsg(error
      ? { type: 'err', text: error.message }
      : { type: 'ok', text: 'Confirmation email sent. Check your inbox.' });
  };

  const handleSavePassword = async () => {
    if (pw.length < 6) {
      setPwMsg({ type: 'err', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (pw !== pwConfirm) {
      setPwMsg({ type: 'err', text: 'Passwords do not match.' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    const { error } = await updatePassword(pw);
    setPwSaving(false);
    if (error) {
      setPwMsg({ type: 'err', text: error.message });
    } else {
      setPwMsg({ type: 'ok', text: 'Password updated.' });
      setPw('');
      setPwConfirm('');
    }
  };

  const handleJoinTeam = async () => {
    if (!joinLink.trim()) return;
    setJoining(true);
    setTeamMsg(null);
    // Extract code from URL or raw code
    const code = joinLink.trim().split('/join/').pop()?.split('?')[0] || joinLink.trim();
    const teamId = await joinTeam(code);
    setJoining(false);
    if (teamId) {
      setTeamMsg({ type: 'ok', text: 'Joined team successfully!' });
      setJoinLink('');
      fetchTeams();
    } else {
      setTeamMsg({ type: 'err', text: 'Invalid or expired invite link.' });
    }
  };

  const handleLeaveTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Leave "${teamName}"? You'll need a new invite to rejoin.`)) return;
    await leaveTeam(teamId);
    fetchTeams();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    setDeleteMsg(null);
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      // Fallback: try calling the API route
      try {
        const res = await fetch('/api/account/delete', { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
      } catch (e: any) {
        setDeleteMsg({ type: 'err', text: e.message || 'Failed to delete account.' });
        setDeleting(false);
        return;
      }
    }
    await signOut();
    router.push('/auth');
  };

  if (authLoading || !user) return null;

  return (
    <div className="pf-root">
      <style>{profileStyles}</style>
      <div className="pf-container">
        {/* Header */}
        <div className="pf-header">
          <button className="pf-back" onClick={() => router.back()}>
            <ArrowLeft size={18} />
          </button>
          <div className="pf-header-icon">
            <Settings size={28} style={{ color: '#818cf8' }} />
          </div>
          <h1 className="pf-title">Profile & Settings</h1>
        </div>

        {/* ── Subscription ── */}
        <section className="pf-section">
          <div className="pf-section-header">
            <Sparkles size={18} style={{ color: '#818cf8' }} />
            <h2 className="pf-section-title">Subscription</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: isPro ? 'rgba(99,102,241,0.2)' : 'rgba(107,114,128,0.2)',
              color: isPro ? '#a5b4fc' : '#9ca3af',
            }}>
              {isPro ? 'Pro' : 'Free'}
            </span>
            {isStaffGrant && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>Staff grant</span>
            )}
            {subStatus === 'canceled' && (
              <span style={{ fontSize: 12, color: '#f59e0b' }}>Cancels at period end</span>
            )}
          </div>
          {isPro && currentPeriodEnd && !isStaffGrant && (
            <p className="pf-hint" style={{ marginBottom: 8 }}>
              {subStatus === 'canceled' ? 'Access until' : 'Renews'}: {new Date(currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!isPro && (
              <button className="pf-btn pf-btn-primary" onClick={showPaywall}>
                Upgrade to Pro
              </button>
            )}
          </div>
        </section>

        {/* ── Display Name ── */}
        <section className="pf-section">
          <div className="pf-section-header">
            <User size={18} style={{ color: '#818cf8' }} />
            <h2 className="pf-section-title">Display Name</h2>
          </div>
          <p className="pf-hint">Your name shown on cards, comments, and teams. Must be unique.</p>
          <div className="pf-row">
            <input
              className="pf-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter a display name"
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
            />
            <button
              className="pf-btn pf-btn-primary"
              onClick={handleSaveName}
              disabled={nameSaving || name.trim() === (profile?.name || '')}
            >
              {nameSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {nameMsg && <p className={`pf-msg ${nameMsg.type}`}>{nameMsg.text}</p>}
        </section>

        {/* ── Email ── */}
        <section className="pf-section">
          <div className="pf-section-header">
            <Mail size={18} style={{ color: '#818cf8' }} />
            <h2 className="pf-section-title">Email Address</h2>
          </div>
          <p className="pf-hint">A confirmation will be sent to your new email address.</p>
          <div className="pf-row">
            <input
              className="pf-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={e => e.key === 'Enter' && handleSaveEmail()}
            />
            <button
              className="pf-btn pf-btn-primary"
              onClick={handleSaveEmail}
              disabled={emailSaving || email.trim() === (user.email || '')}
            >
              {emailSaving ? 'Saving…' : 'Update Email'}
            </button>
          </div>
          {emailMsg && <p className={`pf-msg ${emailMsg.type}`}>{emailMsg.text}</p>}
        </section>

        {/* ── Password ── */}
        <section className="pf-section">
          <div className="pf-section-header">
            <Key size={18} style={{ color: '#818cf8' }} />
            <h2 className="pf-section-title">Change Password</h2>
          </div>
          <div className="pf-field">
            <label className="pf-label">New Password</label>
            <div className="pf-input-wrap">
              <input
                className="pf-input"
                type={pwShow ? 'text' : 'password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="New password (min 6 chars)"
              />
              <button className="pf-eye" onClick={() => setPwShow(!pwShow)} type="button">
                {pwShow ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="pf-field">
            <label className="pf-label">Confirm Password</label>
            <input
              className="pf-input"
              type={pwShow ? 'text' : 'password'}
              value={pwConfirm}
              onChange={e => setPwConfirm(e.target.value)}
              placeholder="Confirm new password"
              onKeyDown={e => e.key === 'Enter' && handleSavePassword()}
            />
          </div>
          <button
            className="pf-btn pf-btn-primary"
            onClick={handleSavePassword}
            disabled={pwSaving || pw.length < 6}
            style={{ marginTop: 8 }}
          >
            {pwSaving ? 'Updating…' : 'Update Password'}
          </button>
          {pwMsg && <p className={`pf-msg ${pwMsg.type}`}>{pwMsg.text}</p>}
        </section>

        {/* ── Notification Preferences ── */}
        <section className="pf-section">
          <div className="pf-section-header">
            <Bell size={18} style={{ color: '#818cf8' }} />
            <h2 className="pf-section-title">Notification Preferences</h2>
          </div>
          <div className="pf-toggles">
            <ToggleRow label="Push Notifications" checked={pushEnabled} onChange={async (v) => {
              if (v && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                const perm = await Notification.requestPermission();
                setPushEnabled(perm === 'granted');
              } else {
                setPushEnabled(v);
              }
            }} />
            <ToggleRow label="Email Notifications" checked={emailNotifs} onChange={setEmailNotifs} />
            <ToggleRow label="Due Soon Reminders" checked={dueSoonNotifs} onChange={setDueSoonNotifs} />
            <ToggleRow label="Comment Notifications" checked={commentNotifs} onChange={setCommentNotifs} />
            <ToggleRow label="Assignment Notifications" checked={assignNotifs} onChange={setAssignNotifs} />
          </div>
        </section>

        {/* ── Teams ── */}
        <section className="pf-section">
          <div className="pf-section-header">
            <Users size={18} style={{ color: '#818cf8' }} />
            <h2 className="pf-section-title">Teams</h2>
          </div>

          {teams.length === 0 ? (
            <p className="pf-hint">You're not in any teams yet.</p>
          ) : (
            <div className="pf-team-list">
              {teams.map(t => (
                <div key={t.id} className="pf-team-row">
                  <div
                    className="pf-team-info"
                    onClick={() => router.push(`/teams/${t.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Users size={16} style={{ color: '#6366f1' }} />
                    <span className="pf-team-name">{t.name}</span>
                  </div>
                  <button
                    className="pf-btn pf-btn-ghost pf-btn-sm"
                    onClick={() => handleLeaveTeam(t.id, t.name)}
                  >
                    Leave
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="pf-hint" style={{ marginTop: 16 }}>Join a team by pasting an invite link:</p>
          <div className="pf-row">
            <input
              className="pf-input"
              value={joinLink}
              onChange={e => setJoinLink(e.target.value)}
              placeholder="Paste invite link or code"
              onKeyDown={e => e.key === 'Enter' && handleJoinTeam()}
            />
            <button
              className="pf-btn pf-btn-primary"
              onClick={handleJoinTeam}
              disabled={joining || !joinLink.trim()}
            >
              {joining ? 'Joining…' : 'Join'}
            </button>
          </div>
          {teamMsg && <p className={`pf-msg ${teamMsg.type}`}>{teamMsg.text}</p>}
        </section>

        {/* ── Sign Out ── */}
        <section className="pf-section">
          <button
            className="pf-btn pf-btn-ghost"
            style={{ gap: 8 }}
            onClick={async () => { await signOut(); router.push('/auth'); }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </section>

        {/* ── Danger Zone ── */}
        <section className="pf-section pf-danger-zone">
          <div className="pf-section-header">
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
            <h2 className="pf-section-title" style={{ color: '#ef4444' }}>Danger Zone</h2>
          </div>
          <p className="pf-hint">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <div className="pf-field">
            <label className="pf-label">Type <strong>DELETE</strong> to confirm</label>
            <input
              className="pf-input"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
          </div>
          <button
            className="pf-btn pf-btn-danger"
            onClick={handleDeleteAccount}
            disabled={deleting || deleteConfirm !== 'DELETE'}
          >
            <Trash2 size={14} />
            {deleting ? 'Deleting…' : 'Delete My Account'}
          </button>
          {deleteMsg && <p className={`pf-msg err`}>{deleteMsg.text}</p>}
        </section>
      </div>
    </div>
  );
}

/* ── Toggle row sub-component ── */
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="pf-toggle-row">
      <span className="pf-toggle-label">{label}</span>
      <button
        className={`pf-toggle ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
        type="button"
        role="switch"
        aria-checked={checked}
      >
        <span className="pf-toggle-thumb" />
      </button>
    </div>
  );
}

/* ── Styles ── */
const profileStyles = `
  .pf-root {
    min-height: 100vh;
    background: #0f1117;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  }
  .pf-container {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 16px 120px;
  }
  .pf-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 32px;
  }
  .pf-back {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    transition: all 0.15s;
  }
  .pf-back:hover { background: rgba(255,255,255,0.06); color: #e5e7eb; }
  .pf-header-icon { display: flex; align-items: center; }
  .pf-title {
    font-size: 22px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }

  /* Sections */
  .pf-section {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .pf-section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .pf-section-title {
    font-size: 15px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0;
  }
  .pf-hint {
    font-size: 12.5px;
    color: #6b7280;
    margin: 0 0 12px;
    line-height: 1.4;
  }

  /* Inputs */
  .pf-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .pf-field { margin-bottom: 12px; }
  .pf-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    margin-bottom: 6px;
  }
  .pf-input {
    flex: 1;
    min-width: 0;
    background: #111318;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 14px;
    color: #e5e7eb;
    outline: none;
    transition: border-color 0.15s;
  }
  .pf-input:focus { border-color: #6366f1; }
  .pf-input::placeholder { color: #4b5563; }
  .pf-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .pf-input-wrap .pf-input { padding-right: 40px; }
  .pf-eye {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    display: flex;
  }
  .pf-eye:hover { color: #d1d5db; }

  /* Buttons */
  .pf-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    outline: none;
    white-space: nowrap;
  }
  .pf-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .pf-btn-primary { background: #6366f1; color: #fff; }
  .pf-btn-primary:hover:not(:disabled) { background: #4f46e5; }
  .pf-btn-ghost {
    background: transparent;
    color: #9ca3af;
    border: 1px solid #374151;
  }
  .pf-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.05); color: #e5e7eb; }
  .pf-btn-danger { background: #dc2626; color: #fff; }
  .pf-btn-danger:hover:not(:disabled) { background: #b91c1c; }
  .pf-btn-sm { padding: 6px 12px; font-size: 12px; }

  /* Messages */
  .pf-msg {
    font-size: 12.5px;
    margin: 8px 0 0;
    font-weight: 500;
  }
  .pf-msg.ok { color: #34d399; }
  .pf-msg.err { color: #f87171; }

  /* Toggles */
  .pf-toggles { display: flex; flex-direction: column; gap: 2px; }
  .pf-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .pf-toggle-row:last-child { border-bottom: none; }
  .pf-toggle-label {
    font-size: 14px;
    color: #d1d5db;
  }
  .pf-toggle {
    position: relative;
    width: 44px;
    height: 24px;
    border-radius: 12px;
    background: #374151;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
    padding: 0;
    flex-shrink: 0;
  }
  .pf-toggle.on { background: #6366f1; }
  .pf-toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .pf-toggle.on .pf-toggle-thumb { transform: translateX(20px); }

  /* Teams */
  .pf-team-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 4px;
  }
  .pf-team-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255,255,255,0.02);
    transition: background 0.15s;
  }
  .pf-team-row:hover { background: rgba(255,255,255,0.04); }
  .pf-team-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .pf-team-name {
    font-size: 14px;
    font-weight: 600;
    color: #e5e7eb;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Danger zone */
  .pf-danger-zone {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.04);
  }
`;
