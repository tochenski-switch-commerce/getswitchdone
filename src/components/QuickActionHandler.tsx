'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Listens for Home Screen Quick Actions (3D Touch / long-press)
 * and Widget deep links dispatched from native iOS via window CustomEvent.
 */
export default function QuickActionHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).Capacitor?.isNativePlatform?.()) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      switch (detail?.type) {
        case 'com.getswitchdone.boards.inbox':
          // Navigate to boards, open inbox via query param
          router.push('/boards?inbox=1');
          break;
        case 'com.getswitchdone.boards.boards':
          router.push('/boards');
          break;
      }
    };

    const deepLinkHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.route) {
        router.push(detail.route);
      }
    };

    window.addEventListener('quickAction', handler);
    window.addEventListener('widgetDeepLink', deepLinkHandler);
    return () => {
      window.removeEventListener('quickAction', handler);
      window.removeEventListener('widgetDeepLink', deepLinkHandler);
    };
  }, [router]);

  return null;
}
