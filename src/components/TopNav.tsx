'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { setBadgeCount } from '@/lib/badge';
import { Bell, LogOut, Settings } from '@/components/BoardIcons';
import type { Notification } from '@/types/board-types';
import dynamic from 'next/dynamic';

const InboxPanel = dynamic(() => import('@/components/InboxPanel'), { ssr: false });

const tabs = [
  { label: 'Boards', href: '/boards' },
  { label: 'Teams', href: '/teams' },
  { label: 'Forms', href: '/forms' },
] as const;

export default function TopNav() {
  const { user, profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) {
      setNotifications(data || []);
      const unread = (data || []).filter((n: Notification) => !n.is_read).length;
      setBadgeCount(unread);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markNotificationRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
  }, [user]);

  // Only show on authenticated pages (not auth page, not public form, not join)
  if (!user || pathname === '/auth' || pathname.startsWith('/f/') || pathname.startsWith('/join/')) {
    return null;
  }

  // Determine active tab — match on prefix
  const activeHref = tabs.find(t => pathname === t.href || pathname.startsWith(t.href + '/'))?.href;

  const initial = (profile?.name?.[0] || user.email?.[0] || '?').toUpperCase();

  return (
    <>
      <style>{`
        .kb-top-nav {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 6px 12px;
          background: #0f1117;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
        }
        .kb-nav-tab {
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          background: transparent;
          color: #6b7280;
        }
        .kb-nav-tab:hover {
          background: rgba(255,255,255,0.05);
          color: #d1d5db;
        }
        .kb-nav-tab.active {
          background: #fa420f;
          color: #fff;
        }
        .kb-nav-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .kb-top-nav .kb-btn-icon {
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
        .kb-top-nav .kb-btn-icon:hover { background: #1f2937 !important; color: #e5e7eb !important; }
        .kb-nav-profile-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #fa420f;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-left: 4px;
        }
        .kb-nav-profile-btn:hover { background: #e03a0d; }
        .kb-profile-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          min-width: 200px;
          background: #1a1d27;
          border: 1px solid #2a2d3a;
          border-radius: 12px;
          padding: 6px;
          z-index: 1000;
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }
        .kb-profile-info {
          padding: 8px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 4px;
        }
        .kb-profile-name {
          color: #e5e7eb;
          font-size: 13px;
          font-weight: 600;
        }
        .kb-profile-email {
          color: #6b7280;
          font-size: 11px;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .kb-profile-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #d1d5db;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .kb-profile-dropdown-item:hover { background: rgba(255,255,255,0.06); }
        .kb-profile-dropdown-item.danger { color: #ef4444; }
        .kb-profile-dropdown-item.danger:hover { background: rgba(239,68,68,0.1); }
        .kb-profile-backdrop { position: fixed; inset: 0; z-index: 999; }
      `}</style>
      <nav className="kb-top-nav">
        {tabs.map(t => (
          <button
            key={t.href}
            className={`kb-nav-tab${activeHref === t.href ? ' active' : ''}`}
            onClick={() => router.push(t.href)}
          >
            {t.label}
          </button>
        ))}

        <div className="kb-nav-right">
          {/* Inbox bell — same as was in board toolbar */}
          <button
            className="kb-btn-icon"
            onClick={() => { setShowInbox(!showInbox); setShowProfile(false); }}
            title="Inbox"
            style={{ position: 'relative' }}
          >
            <Bell size={16} />
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2, width: 7, height: 7,
                borderRadius: '50%', background: '#ef4444',
              }} />
            )}
          </button>

          {/* Profile */}
          <div style={{ position: 'relative' }}>
            <button
              className="kb-nav-profile-btn"
              onClick={() => { setShowProfile(!showProfile); setShowInbox(false); }}
              title={profile?.name || user.email || 'Profile'}
            >
              {initial}
            </button>
            {showProfile && (
              <>
                <div className="kb-profile-backdrop" onClick={() => setShowProfile(false)} />
                <div className="kb-profile-dropdown">
                  <div className="kb-profile-info">
                    {profile?.name && <div className="kb-profile-name">{profile.name}</div>}
                    <div className="kb-profile-email">{user.email}</div>
                  </div>
                  <button
                    className="kb-profile-dropdown-item"
                    onClick={() => { setShowProfile(false); router.push('/profile'); }}
                  >
                    <Settings size={14} /> Profile & Settings
                  </button>
                  <button
                    className="kb-profile-dropdown-item danger"
                    onClick={async () => { setShowProfile(false); await signOut(); router.push('/auth'); }}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {showInbox && (
        <InboxPanel
          notifications={notifications}
          onClose={() => setShowInbox(false)}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
          onDelete={deleteNotification}
          onClearAll={clearAllNotifications}
          onNavigate={(boardId, cardId) => {
            setShowInbox(false);
            router.push(`/boards/${boardId}?card=${cardId}`);
          }}
        />
      )}
    </>
  );
}
