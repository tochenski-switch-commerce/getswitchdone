'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Listens for Home Screen Quick Actions (3D Touch / long-press)
 * dispatched from native iOS via window CustomEvent.
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

    window.addEventListener('quickAction', handler);
    return () => window.removeEventListener('quickAction', handler);
  }, [router]);

  return null;
}
