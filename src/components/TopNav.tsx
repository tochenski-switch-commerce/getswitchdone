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
        {/* Lumio wordmark + flame */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="-1 0 851 290"
          style={{ height: 18, width: 'auto', marginRight: 8, flexShrink: 0 }}
          aria-label="Lumio"
        >
          {/* O — shifted up 3.891 units so its bottom aligns with the i stem (y=284.098) */}
          <path fillRule="evenodd" fill="white" transform="translate(0, -3.891)" d="M836.649,243.604 C828.405,257.165 817.226,267.951 803.100,275.964 C788.974,283.982 772.961,287.989 755.072,287.989 C737.177,287.989 721.169,283.982 707.043,275.964 C692.918,267.951 681.733,257.104 673.494,243.427 C665.251,229.756 661.134,214.427 661.134,197.451 C661.134,180.713 665.195,165.622 673.318,152.183 C681.440,138.744 692.564,128.078 706.690,120.176 C720.816,112.280 736.940,108.329 755.072,108.329 C772.729,108.329 788.676,112.219 802.923,119.1000 C817.165,127.780 828.405,138.451 836.649,152.006 C844.887,165.567 849.009,180.713 849.009,197.451 C849.009,214.665 844.887,230.049 836.649,243.604 ZM788.621,177.116 C785.321,171.104 780.791,166.390 775.024,162.969 C769.253,159.554 762.604,157.841 755.072,157.841 C747.534,157.841 740.824,159.554 734.942,162.969 C729.055,166.390 724.464,171.164 721.169,177.293 C717.870,183.426 716.225,190.262 716.225,197.805 C716.225,205.823 717.870,212.957 721.169,219.201 C724.464,225.451 729.055,230.226 734.942,233.525 C740.824,236.829 747.534,238.476 755.072,238.476 C762.604,238.476 769.313,236.829 775.201,233.525 C781.083,230.226 785.619,225.451 788.797,219.201 C791.976,212.957 793.565,205.823 793.565,197.805 C793.565,190.024 791.915,183.128 788.621,177.116 Z" />
          {/* L, U, M, i (flame + stem) */}
          <path fill="white" d="M607.665,85.002 C599.884,85.002 593.331,82.269 587.998,76.798 C582.665,71.331 580.028,64.768 579.998,57.107 C579.941,42.541 586.944,32.765 592.177,28.186 C589.274,44.173 605.779,44.594 601.191,31.580 C594.742,10.187 607.500,0.000 607.500,0.000 C607.500,0.000 608.726,13.316 627.498,37.416 C631.946,43.126 634.998,49.231 634.998,57.107 C634.998,64.768 632.498,71.331 627.498,76.798 C622.498,82.269 615.883,85.002 607.665,85.002 ZM491.959,189.321 C491.959,183.425 490.900,178.297 488.781,173.937 C486.662,169.571 483.605,166.212 479.599,163.858 C475.598,161.498 470.892,160.321 465.473,160.321 C457.472,160.321 451.170,162.913 446.579,168.101 C441.989,173.285 439.693,180.358 439.693,189.321 L439.693,287.993 L439.283,287.993 L385.308,287.993 L384.898,287.993 L384.898,189.321 C384.898,183.425 383.839,178.297 381.720,173.937 C379.601,169.571 376.544,166.212 372.538,163.858 C368.538,161.498 363.831,160.321 358.412,160.321 C350.411,160.321 344.110,162.913 339.519,168.101 C334.928,173.285 332.633,180.358 332.633,189.321 L332.633,287.993 L278.248,287.993 L278.248,188.614 C278.248,173.522 281.603,160.260 288.313,148.827 C295.022,137.388 304.381,128.431 316.388,121.949 C328.395,115.467 342.405,112.223 358.412,112.223 C373.951,112.223 387.900,115.528 400.260,122.126 C404.440,124.356 408.295,126.871 411.842,129.655 C415.390,126.787 419.254,124.213 423.448,121.949 C435.455,115.467 449.465,112.223 465.473,112.223 C481.011,112.223 494.961,115.528 507.321,122.126 C519.681,128.724 529.277,137.742 536.103,149.181 C542.934,160.614 546.344,173.760 546.344,188.614 L546.344,287.993 L491.959,287.993 L491.959,189.321 ZM210.814,278.263 C198.807,284.745 184.797,287.989 168.789,287.989 C153.251,287.989 139.302,284.684 126.941,278.086 C114.581,271.488 104.986,262.470 98.160,251.031 C91.329,239.598 87.918,226.451 87.918,211.598 L87.918,112.219 L142.303,112.219 L142.303,210.890 C142.303,216.787 143.363,221.915 145.482,226.275 C147.601,230.640 150.657,233.1000 154.664,236.354 C158.664,238.714 163.371,239.891 168.789,239.891 C176.790,239.891 183.092,237.299 187.683,232.110 C192.274,226.927 194.569,219.854 194.569,210.890 L194.569,112.219 L248.954,112.219 L248.954,211.598 C248.954,226.689 245.599,239.951 238.889,251.385 C232.179,262.823 222.821,271.781 210.814,278.263 ZM-0.015,27.340 L54.369,27.340 L54.369,284.098 L-0.015,284.098 L-0.015,27.340 ZM634.648,284.098 L580.263,284.098 L580.263,112.219 L634.648,112.219 L634.648,284.098 Z" />
        </svg>

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
