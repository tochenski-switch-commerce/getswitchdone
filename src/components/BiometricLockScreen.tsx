'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { isBiometricAvailable, isBiometricLockEnabled, verifyBiometric } from '@/lib/biometric';

function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Full-screen lock overlay that appears when the app resumes (if biometric lock is enabled).
 * Shows a blurred overlay and prompts for Face ID / Touch ID.
 */
export default function BiometricLockScreen() {
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);

  const attemptUnlock = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    const success = await verifyBiometric();
    if (success) {
      setLocked(false);
    }
    setChecking(false);
  }, [checking]);

  useEffect(() => {
    if (!isNative()) return;

    let removeListener: (() => void) | null = null;

    try {
      const handleResume = async () => {
        try {
          const available = await isBiometricAvailable();
          if (available && isBiometricLockEnabled()) {
            setLocked(true);
            setTimeout(async () => {
              try {
                const success = await verifyBiometric();
                if (success) setLocked(false);
              } catch { /* ignore */ }
            }, 300);
          }
        } catch { /* ignore */ }
      };

      const cap = (window as any).Capacitor;
      const appPlugin = cap?.Plugins?.App;

      if (appPlugin?.addListener) {
        const result = appPlugin.addListener('appStateChange', (state: { isActive: boolean }) => {
          if (state.isActive) handleResume();
        });
        // handle both Promise and direct return
        if (result && typeof result.then === 'function') {
          result.then((handle: any) => {
            removeListener = () => handle?.remove?.();
          }).catch(() => {});
        } else if (result && typeof result.remove === 'function') {
          removeListener = () => result.remove();
        }
      }
    } catch { /* ignore biometric setup errors */ }

    return () => {
      try { removeListener?.(); } catch { /* ignore */ }
    };
  }, []);

  if (!locked) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'rgba(15, 17, 23, 0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
    }}>
      {/* Lock icon */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 16,
        background: 'rgba(129, 140, 248, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>
          GSD Boards is Locked
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
          Authenticate to continue
        </p>
      </div>

      <button
        onClick={attemptUnlock}
        disabled={checking}
        style={{
          padding: '12px 32px',
          borderRadius: 12,
          border: 'none',
          background: '#4f46e5',
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          opacity: checking ? 0.6 : 1,
          transition: 'opacity 0.15s ease',
        }}
      >
        {checking ? 'Verifying...' : 'Unlock'}
      </button>
    </div>
  );
}
