'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function JoinWatchPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'claiming' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    async function handle() {
      setStatus('checking');

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Not signed in — send to auth with returnTo so they come back after login
        router.replace(`/auth?returnTo=/join-watch/${token}`);
        return;
      }

      // Signed in — claim the invite
      setStatus('claiming');

      const res = await fetch('/api/cards/claim-watch-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ inviteToken: token }),
      });

      const json = await res.json();

      if (res.ok && json.ok) {
        setStatus('success');
        setMessage("You're now watching this card.");
        setTimeout(() => router.replace('/watching'), 1800);
      } else {
        setStatus('error');
        setMessage(json.error || 'Something went wrong. The invite may be invalid.');
      }
    }

    handle();
  }, [token, router]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 380,
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Lumio wordmark */}
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#fa420f', letterSpacing: '-0.02em' }}>lumio</span>
        </div>

        {(status === 'checking' || status === 'claiming') && (
          <>
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(255,255,255,0.08)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <p style={{ margin: 0, color: '#9ca3af', fontSize: 15 }}>
              {status === 'checking' ? 'Verifying your invite…' : 'Adding you as a watcher…'}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#f0f4ff' }}>
              Watching!
            </h2>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: 14 }}>{message}</p>
            <p style={{ margin: '10px 0 0', color: '#6b7280', fontSize: 13 }}>Redirecting you to your watching list…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#f0f4ff' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 20px', color: '#9ca3af', fontSize: 14 }}>{message}</p>
            <button
              onClick={() => router.replace('/')}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#d1d5db',
                fontSize: 14,
                padding: '10px 20px',
                cursor: 'pointer',
              }}
            >
              Go to Lumio
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
