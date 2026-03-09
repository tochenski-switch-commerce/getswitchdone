'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const tabs = [
  { label: 'Boards', href: '/boards' },
  { label: 'Teams', href: '/teams' },
  { label: 'Forms', href: '/forms' },
] as const;

export default function TopNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Only show on authenticated pages (not auth page, not public form, not join)
  if (!user || pathname === '/auth' || pathname.startsWith('/f/') || pathname.startsWith('/join/')) {
    return null;
  }

  // Determine active tab — match on prefix
  const activeHref = tabs.find(t => pathname === t.href || pathname.startsWith(t.href + '/'))?.href;

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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
          background: #2563eb;
          color: #fff;
        }
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
      </nav>
    </>
  );
}
