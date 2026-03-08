'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Pull-to-refresh hook for iOS native shell.
 * Attaches touch handlers to the given scrollable element (or window).
 * Shows a spinner indicator and calls `onRefresh` when the pull threshold is met.
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const THRESHOLD = 70;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
      setPulling(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (!isNative()) return;

    let onTouchStart: ((e: TouchEvent) => void) | null = null;
    let onTouchMove: ((e: TouchEvent) => void) | null = null;
    let onTouchEnd: (() => void) | null = null;

    try {
      onTouchStart = (e: TouchEvent) => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop <= 0 && !refreshing) {
          startY.current = e.touches[0].clientY;
          isPulling.current = true;
        }
      };

      onTouchMove = (e: TouchEvent) => {
        if (!isPulling.current || refreshing) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;
        if (diff > 0) {
          const distance = Math.min(diff * 0.5, 120);
          setPullDistance(distance);
          setPulling(true);
        } else {
          setPullDistance(0);
          setPulling(false);
        }
      };

      onTouchEnd = () => {
        if (!isPulling.current) return;
        isPulling.current = false;
        if (pullDistance >= THRESHOLD && !refreshing) {
          handleRefresh();
        } else {
          setPullDistance(0);
          setPulling(false);
        }
      };

      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd, { passive: true });
    } catch { /* ignore */ }

    return () => {
      try {
        if (onTouchStart) window.removeEventListener('touchstart', onTouchStart);
        if (onTouchMove) window.removeEventListener('touchmove', onTouchMove);
        if (onTouchEnd) window.removeEventListener('touchend', onTouchEnd);
      } catch { /* ignore */ }
    };
  }, [pullDistance, refreshing, handleRefresh]);

  return { pulling: pulling || refreshing, pullDistance, refreshing };
}
