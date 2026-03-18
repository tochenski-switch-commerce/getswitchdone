'use client';

import React from 'react';
import { Sparkles } from '@/components/BoardIcons';
import { useSubscription } from '@/hooks/useSubscription';

interface UpgradeBannerProps {
  message: string;
}

export default function UpgradeBanner({ message }: UpgradeBannerProps) {
  const { showPaywall } = useSubscription();

  return (
    <div
      onClick={showPaywall}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: 10,
        cursor: 'pointer',
        marginBottom: 12,
      }}
    >
      <Sparkles size={16} style={{ color: '#818cf8' }} />
      <span style={{ color: '#c7d2fe', fontSize: 13, flex: 1 }}>{message}</span>
      <span style={{
        color: '#818cf8', fontSize: 12, fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        Upgrade
      </span>
    </div>
  );
}
