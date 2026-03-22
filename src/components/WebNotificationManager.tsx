'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface PushPayload {
  title?: string;
  body?: string;
  board_id?: string;
  card_id?: string;
}

interface ToastState {
  visible: boolean;
  payload: PushPayload | null;
}

export default function WebNotificationManager() {
  const [toast, setToast] = useState<ToastState>({ visible: false, payload: null });
  const unreadCount = useRef(0);
  const originalFaviconHref = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Capture the original favicon href on mount
  useEffect(() => {
    const link = document.querySelector("link[rel='icon'][sizes='32x32']") as HTMLLinkElement | null;
    if (link) originalFaviconHref.current = link.href;
  }, []);

  const clearBadge = useCallback(() => {
    unreadCount.current = 0;
    document.title = 'Lumio';
    const link = document.querySelector("link[rel='icon'][sizes='32x32']") as HTMLLinkElement | null;
    if (link && originalFaviconHref.current) link.href = originalFaviconHref.current;
    if ('clearAppBadge' in navigator) (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => {});
  }, []);

  const incrementBadge = useCallback(() => {
    unreadCount.current += 1;
    const count = unreadCount.current;

    // Title badge
    document.title = `(${count}) Lumio`;

    // Favicon badge — draw a numbered dot over the icon
    const link = document.querySelector("link[rel='icon'][sizes='32x32']") as HTMLLinkElement | null;
    if (link) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        // Use the original href so we always draw on the clean icon, not a previous badge
        img.src = originalFaviconHref.current || link.href;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 32, 32);
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(24, 8, 9, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(count > 9 ? '9+' : String(count), 24, 8);
          link.href = canvas.toDataURL('image/png');
        };
      }
    }

    // App Badge API — shows on OS dock/taskbar when installed as PWA
    if ('setAppBadge' in navigator) {
      (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count).catch(() => {});
    }
  }, []);

  // Clear badge when user returns to this tab
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && unreadCount.current > 0) {
        clearBadge();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [clearBadge]);

  // Listen for messages from the service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator) || (window as Window & { Capacitor?: unknown }).Capacitor) return;

    const onMessage = (event: MessageEvent) => {
      const { type, payload, url } = event.data ?? {};

      if (type === 'PUSH_RECEIVED') {
        // App is active — show in-app toast
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ visible: true, payload });
        toastTimer.current = setTimeout(() => setToast({ visible: false, payload: null }), 5000);
      }

      if (type === 'PUSH_BADGE') {
        // App is in a background tab — increment badge indicators
        incrementBadge();
      }

      if (type === 'PUSH_NAVIGATE') {
        // User clicked a native notification that focused this tab
        router.push(url);
        clearBadge();
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [incrementBadge, clearBadge, router]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  if (!toast.visible || !toast.payload) return null;

  const { payload } = toast;
  const isClickable = !!payload.board_id;

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setToast({ visible: false, payload: null });
  };

  const handleClick = () => {
    if (!isClickable) return;
    setToast({ visible: false, payload: null });
    if (payload.board_id && payload.card_id) {
      router.push(`/boards/${payload.board_id}?card=${payload.card_id}`);
    } else if (payload.board_id) {
      router.push(`/boards/${payload.board_id}`);
    }
  };

  return (
    <>
      <style>{`
        @keyframes pushToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div
        onClick={handleClick}
        role={isClickable ? 'button' : undefined}
        style={{
          position: 'fixed',
          top: 'calc(16px + env(safe-area-inset-top))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#1a1d2e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          maxWidth: 360,
          width: 'calc(100vw - 32px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          cursor: isClickable ? 'pointer' : 'default',
          animation: 'pushToastIn 0.25s ease',
        }}
      >
        {/* Bell icon */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'rgba(255,107,53,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2, lineHeight: 1.3 }}>
            {payload.title || 'Lumio'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {payload.body || 'New notification'}
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="Dismiss notification"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
            padding: 4,
            flexShrink: 0,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </>
  );
}
