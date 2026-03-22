'use client';

import { useState, useEffect, useCallback } from 'react';

export type WebPushState = 'unsupported' | 'loading' | 'default' | 'granted' | 'denied';

export function useWebPush(userId: string | undefined) {
  const [state, setState] = useState<WebPushState>('loading');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !(window as Window & { Capacitor?: unknown }).Capacitor;

  // Load current state on mount
  useEffect(() => {
    if (!isSupported) {
      setState('unsupported');
      return;
    }

    const permission = Notification.permission;
    if (permission === 'denied') {
      setState('denied');
      return;
    }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SW not ready')), 5000)
    );

    Promise.race([navigator.serviceWorker.ready, timeout])
      .then(async (reg) => {
        const existing = await (reg as ServiceWorkerRegistration).pushManager.getSubscription();
        setSubscription(existing);
        setState(existing ? 'granted' : 'default');
      })
      .catch(() => {
        // SW not ready in time — still allow the user to try subscribing
        setState('default');
      });
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !userId) return;
    setState('loading');

    try {
      // Ensure the SW is registered — register it now if it isn't yet
      let reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
        // Wait for it to become active
        await new Promise<void>((resolve) => {
          if (reg!.active) { resolve(); return; }
          reg!.addEventListener('updatefound', () => {
            reg!.installing?.addEventListener('statechange', function () {
              if (this.state === 'activated') resolve();
            });
          });
          // Fallback timeout
          setTimeout(resolve, 3000);
        });
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription: sub.toJSON() }),
      });

      setSubscription(sub);
      setState('granted');
    } catch {
      // User dismissed the prompt or permission was blocked
      setState(Notification.permission === 'denied' ? 'denied' : 'default');
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async () => {
    if (!subscription || !userId) return;
    setState('loading');

    try {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, endpoint: subscription.endpoint }),
      });

      await subscription.unsubscribe();
      setSubscription(null);
      setState('default');
    } catch {
      setState('granted');
    }
  }, [subscription, userId]);

  return { state, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
