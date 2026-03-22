'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);

  // Supabase emits PASSWORD_RECOVERY when the recovery link is processed
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.replace('/boards'), 2000);
    }
  };

  return (
    <div className="kb-root">
      <style>{resetStyles}</style>
      <div className="kb-auth-container">
        <div className="kb-auth-card">
          <h1 className="kb-auth-title">Lumio</h1>

          {success ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(34,197,94,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#f9fafb', margin: '0 0 8px' }}>Password updated</p>
              <p style={{ fontSize: 13, color: '#9ca3af' }}>Redirecting you to your boards…</p>
            </div>
          ) : !ready ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: 14, color: '#9ca3af' }}>Verifying reset link…</p>
            </div>
          ) : (
            <>
              <p className="kb-auth-subtitle">Choose a new password</p>
              <form onSubmit={handleSubmit}>
                <div className="kb-form-group">
                  <label className="kb-label">New Password</label>
                  <input
                    className="kb-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>
                <div className="kb-form-group">
                  <label className="kb-label">Confirm Password</label>
                  <input
                    className="kb-input"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                {error && <p className="kb-auth-error">{error}</p>}
                <button
                  className="kb-btn kb-btn-primary kb-auth-submit"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const resetStyles = `
  .kb-root {
    min-height: 100vh;
    background: #0f1117;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  }
  .kb-auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .kb-auth-card {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 16px;
    padding: 40px 32px;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }
  .kb-auth-title {
    font-size: 24px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0 0 4px;
    text-align: center;
  }
  .kb-auth-subtitle {
    font-size: 14px;
    color: #9ca3af;
    margin: 0 0 24px;
    text-align: center;
  }
  .kb-form-group { margin-bottom: 16px; }
  .kb-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }
  .kb-input {
    width: 100%;
    background: #0f1117;
    border: 1px solid #374151;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px;
    color: #e5e7eb;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }
  .kb-input:focus {
    border-color: #fa420f;
    box-shadow: 0 0 0 2px rgba(250,66,15,0.2);
  }
  .kb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    outline: none;
  }
  .kb-btn-primary {
    background: #fa420f;
    color: #fff;
  }
  .kb-btn-primary:hover { background: #e03a0d; }
  .kb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .kb-auth-submit { width: 100%; margin-top: 8px; padding: 12px; }
  .kb-auth-error {
    font-size: 13px;
    color: #ef4444;
    margin: 0 0 8px;
    padding: 8px 12px;
    background: rgba(239,68,68,0.1);
    border-radius: 8px;
    border: 1px solid rgba(239,68,68,0.2);
  }
  @media (max-width: 480px) {
    .kb-auth-card { padding: 24px 20px; }
    .kb-auth-title { font-size: 20px; }
    .kb-input { font-size: 16px; }
  }
`;
