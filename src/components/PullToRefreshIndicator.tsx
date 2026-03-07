'use client';

import React from 'react';

/**
 * Visual pull-to-refresh indicator.
 * Sits at the top of the page and shows a spinner when pulling/refreshing.
 */
export default function PullToRefreshIndicator({
  pulling,
  pullDistance,
  refreshing,
}: {
  pulling: boolean;
  pullDistance: number;
  refreshing: boolean;
}) {
  if (!pulling && pullDistance === 0) return null;

  const progress = Math.min(pullDistance / 70, 1);
  const opacity = Math.max(0.3, progress);
  const rotation = refreshing ? undefined : pullDistance * 4;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      zIndex: 10000,
      paddingTop: `calc(env(safe-area-inset-top, 0px) + ${Math.min(pullDistance, 80)}px)`,
      transition: refreshing ? 'padding-top 0.2s ease' : 'none',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: '#1a1d2a',
        border: '1px solid #2a2d3a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transform: `scale(${0.5 + progress * 0.5})`,
        transition: refreshing ? 'transform 0.2s ease' : 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#818cf8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: rotation !== undefined ? `rotate(${rotation}deg)` : undefined,
            animation: refreshing ? 'ptr-spin 0.8s linear infinite' : 'none',
          }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
      {refreshing && (
        <style>{`
          @keyframes ptr-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      )}
    </div>
  );
}
