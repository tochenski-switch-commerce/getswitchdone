'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/boards';
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    if (!loading && user) {
      router.replace(returnTo);
    }
  }, [loading, user, router, returnTo]);

  if (!loading && user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Set session persistence based on Remember Me
    if (!rememberMe) {
      // When not remembering, we still sign in but the session won't persist across browser closes
      // Supabase stores tokens in localStorage by default; we clear on window close
      window.addEventListener('beforeunload', () => {
        supabase.auth.signOut();
      }, { once: true });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
    } else {
      router.push(returnTo);
    }
  };

  return (
    <div className="kb-root">
      <style>{authStyles}</style>
      <div className="kb-auth-container">
        <div className="kb-auth-card">
          <h1 className="kb-auth-title">GSD Boards</h1>
          <p className="kb-auth-subtitle">Sign in to your account</p>

          <form onSubmit={handleSubmit}>
            <div className="kb-form-group">
              <label className="kb-label">Email</label>
              <input
                className="kb-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>
            <div className="kb-form-group">
              <label className="kb-label">Password</label>
              <input
                className="kb-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <label className="kb-remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="kb-checkbox"
              />
              <span>Remember me</span>
            </label>
            {error && <p className="kb-auth-error">{error}</p>}
            <button
              className="kb-btn kb-btn-primary kb-auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const authStyles = `
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
  .kb-auth-toggle {
    display: flex;
    gap: 0;
    margin-bottom: 24px;
    background: #0f1117;
    border-radius: 10px;
    padding: 3px;
  }
  .kb-auth-toggle-btn {
    flex: 1;
    padding: 8px 0;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    background: transparent;
    color: #6b7280;
  }
  .kb-auth-toggle-btn.active {
    background: #2563eb;
    color: #fff;
  }
  .kb-form-group {
    margin-bottom: 16px;
  }
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
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
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
    background: #6366f1;
    color: #fff;
  }
  .kb-btn-primary:hover {
    background: #4f46e5;
  }
  .kb-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .kb-auth-submit {
    width: 100%;
    margin-top: 8px;
    padding: 12px;
  }
  .kb-auth-error {
    font-size: 13px;
    color: #ef4444;
    margin: 0 0 8px;
    padding: 8px 12px;
    background: rgba(239,68,68,0.1);
    border-radius: 8px;
    border: 1px solid rgba(239,68,68,0.2);
  }

  /* ── Responsive ── */
  @media (max-width: 480px) {
    .kb-auth-card { padding: 24px 20px; }
    .kb-auth-title { font-size: 20px; }
    .kb-input { font-size: 16px; }
  }
`;
