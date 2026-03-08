'use client';

import { useEffect, useState } from 'react';

/**
 * Global error catcher — captures uncaught errors and unhandled promise rejections
 * and shows them in a debug overlay. Temporary — remove after debugging.
 */
export default function ErrorCatcher() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      setError(`ERROR: ${event.message}\n\nFile: ${event.filename}:${event.lineno}:${event.colno}\n\nStack: ${event.error?.stack || 'N/A'}`);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? `${reason.message}\n\n${reason.stack}` : String(reason);
      setError(`UNHANDLED REJECTION: ${msg}`);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!error) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      background: 'rgba(0,0,0,0.92)',
      color: '#ff6b6b',
      padding: '60px 16px 16px',
      fontFamily: 'monospace',
      fontSize: 12,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Debug Error Catcher
      </div>
      {error}
      <button
        onClick={() => setError(null)}
        style={{
          display: 'block', marginTop: 16, padding: '8px 16px',
          background: '#333', color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 14, cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
