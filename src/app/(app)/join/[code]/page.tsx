'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Joining team…');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in — redirect to auth with returnTo so they come back here after sign-in/sign-up
      router.replace(`/auth?returnTo=/join/${encodeURIComponent(code)}&invite=${encodeURIComponent(code)}`);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data: teamId, error } = await supabase.rpc('use_team_invite', { code });
      if (cancelled) return;
      if (error) {
        setStatus('error');
        setMessage(error.message ?? 'Invalid or expired invite link.');
      } else if (teamId) {
        setStatus('success');
        setMessage("You've joined the team! Redirecting...");
        setTimeout(() => router.replace(`/teams/${teamId}`), 1200);
      } else {
        setStatus('error');
        setMessage('Invalid or expired invite link.');
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, code, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f1117',
      color: '#e5e7eb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
        padding: 32,
        background: '#1a1d27',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)',
        maxWidth: 360,
        width: '100%',
      }}>
        {status === 'loading' && (
          <div style={{ fontSize: 14, color: '#9ca3af' }}>{message}</div>
        )}
        {status === 'success' && (
          <div style={{ fontSize: 14, color: '#22c55e' }}>{message}</div>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 16 }}>{message}</div>
            <button
              onClick={() => router.push('/boards')}
              style={{
                padding: '8px 20px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Go to Boards
            </button>
          </>
        )}
      </div>
    </div>
  );
}
