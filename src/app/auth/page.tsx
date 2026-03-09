'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  isBiometricAvailable,
  getBiometryType,
  biometryLabel,
  hasLoginCredentials,
  getLoginCredentials,
  deleteLoginCredentials,
  storeLoginCredentials,
} from '@/lib/biometric';

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
  const inviteParam = searchParams.get('invite') || '';
  const { user, loading, createUser } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const joinFlowActive = returnTo.startsWith('/join/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(inviteParam);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometryType, setBiometryType] = useState('');
  const [biometricLoading, setBiometricLoading] = useState(false);
  // Post-login Face ID opt-in prompt
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);
  const [holdRedirect, setHoldRedirect] = useState(false);

  // Redirect if already signed in (but not when showing biometric prompt)
  useEffect(() => {
    if (!loading && user && !showBiometricPrompt && !holdRedirect) {
      router.replace(returnTo);
    }
  }, [loading, user, router, returnTo, showBiometricPrompt, holdRedirect]);

  // Check if stored biometric credentials exist (show Face ID button, but don't auto-trigger)
  useEffect(() => {
    if (loading || user) return;
    let canceled = false;
    (async () => {
      const available = await isBiometricAvailable();
      if (!available || canceled) return;
      const hasCreds = await hasLoginCredentials();
      if (!hasCreds || canceled) return;
      const type = await getBiometryType();
      if (canceled) return;
      setBiometryType(type);
      setBiometricReady(true);
    })();
    return () => { canceled = true; };
  }, [loading, user]);

  if (!loading && user && !showBiometricPrompt && !holdRedirect) {
    return null;
  }

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError('');
    try {
      const creds = await getLoginCredentials();
      if (creds) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: creds.username,
          password: creds.password,
        });
        if (signInError) {
          setError(signInError.message);
          if (signInError.message.toLowerCase().includes('invalid')) {
            await deleteLoginCredentials();
            setBiometricReady(false);
          }
        } else {
          router.push(returnTo);
        }
      }
    } catch { /* user canceled */ }
    setBiometricLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    setHoldRedirect(true);

    if (mode === 'signup') {
      // If returnTo points to /join/, skip invite in createUser — the join page handles it
      const codeForSignup = joinFlowActive ? undefined : (inviteCode || undefined);
      const { error: signUpErr, teamId } = await createUser(email, password, codeForSignup);
      setSubmitting(false);
      if (signUpErr) {
        setError(signUpErr.message);
        setHoldRedirect(false);
        return;
      }
      // After sign-up, auto-sign in
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        setError(signInErr.message);
        setHoldRedirect(false);
        return;
      }
      setHoldRedirect(false);
      // If joined via createUser (manual invite code), go to team page; otherwise use returnTo
      router.push(teamId ? `/teams/${teamId}` : returnTo);
      return;
    }

    // Sign-in mode
    // Set session persistence based on Remember Me
    if (!rememberMe) {
      window.addEventListener('beforeunload', () => {
        supabase.auth.signOut();
      }, { once: true });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      setHoldRedirect(false);
      return;
    }

    // After successful login, check if we should offer Face ID enrollment
    const available = await isBiometricAvailable();
    const hasCreds = await hasLoginCredentials();
    console.log('[AUTH] biometric check:', { available, hasCreds });
    if (available && !hasCreds) {
      const type = await getBiometryType();
      console.log('[AUTH] showing biometric prompt, type:', type);
      setBiometryType(type);
      setPendingCredentials({ email, password });
      setShowBiometricPrompt(true);
      return; // don't navigate yet — wait for user choice
    }

    console.log('[AUTH] skipping biometric prompt, redirecting');
    // If already enrolled or not available, just go
    setHoldRedirect(false);
    router.push(returnTo);
  };

  const handleEnableBiometric = async () => {
    if (pendingCredentials) {
      await storeLoginCredentials(pendingCredentials.email, pendingCredentials.password);
    }
    setShowBiometricPrompt(false);
    setHoldRedirect(false);
    router.push(returnTo);
  };

  const handleSkipBiometric = () => {
    setShowBiometricPrompt(false);
    setHoldRedirect(false);
    router.push(returnTo);
  };

  // ── Face ID enrollment prompt (shown after successful password login) ──
  if (showBiometricPrompt) {
    return (
      <div className="kb-root">
        <style>{authStyles}</style>
        <div className="kb-auth-container">
          <div className="kb-auth-card" style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: 'rgba(99, 102, 241, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 3H5a2 2 0 0 0-2 2v2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <path d="M17 21h2a2 2 0 0 0 2-2v-2" />
                <path d="M9 9.5v1" strokeWidth="2" />
                <path d="M15 9.5v1" strokeWidth="2" />
                <path d="M12 9.5v3.5l-1.5 1.5" />
                <path d="M8 17c1.33.67 2.67 1 4 1s2.67-.33 4-1" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f9fafb', margin: '0 0 8px' }}>
              Enable {biometryLabel(biometryType)}?
            </h2>
            <p style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 28px', lineHeight: 1.5 }}>
              Sign in faster next time using {biometryLabel(biometryType)} instead of your password.
            </p>
            <button
              className="kb-btn kb-btn-primary"
              onClick={handleEnableBiometric}
              style={{ width: '100%', padding: 12, fontSize: 15, marginBottom: 12 }}
            >
              Enable {biometryLabel(biometryType)}
            </button>
            <button
              className="kb-btn"
              onClick={handleSkipBiometric}
              style={{ width: '100%', padding: 12, fontSize: 14, color: '#9ca3af', background: 'transparent' }}
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kb-root">
      <style>{authStyles}</style>
      <div className="kb-auth-container">
        <div className="kb-auth-card">
          <h1 className="kb-auth-title">GSD Boards</h1>
          <p className="kb-auth-subtitle">{mode === 'signin' ? 'Sign in to your account' : 'Create your account'}</p>

          {inviteParam && (
            <div className="kb-invite-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#e5e7eb' }}>You&apos;ve been invited to a team</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Sign in or create an account to join</div>
              </div>
            </div>
          )}

          <div className="kb-auth-toggle">
            <button className={`kb-auth-toggle-btn${mode === 'signin' ? ' active' : ''}`} onClick={() => setMode('signin')} type="button">Sign In</button>
            <button className={`kb-auth-toggle-btn${mode === 'signup' ? ' active' : ''}`} onClick={() => setMode('signup')} type="button">Sign Up</button>
          </div>

          {biometricReady && (
            <>
              <button
                className="kb-biometric-btn"
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                type="button"
              >
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3H5a2 2 0 0 0-2 2v2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <path d="M17 21h2a2 2 0 0 0 2-2v-2" />
                  <path d="M9 9.5v1" strokeWidth="2" />
                  <path d="M15 9.5v1" strokeWidth="2" />
                  <path d="M12 9.5v3.5l-1.5 1.5" />
                  <path d="M8 17c1.33.67 2.67 1 4 1s2.67-.33 4-1" />
                </svg>
                <span>{biometricLoading ? 'Verifying...' : `Sign in with ${biometryLabel(biometryType)}`}</span>
              </button>
              <div className="kb-auth-divider"><span>or</span></div>
            </>
          )}

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
            {mode === 'signup' && (
              <div className="kb-form-group">
                <label className="kb-label">Invite Code (optional)</label>
                <input
                  className="kb-input"
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="Paste invite code to join a team"
                />
              </div>
            )}
            {mode === 'signin' && (
              <label className="kb-remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="kb-checkbox"
                />
                <span>Remember me</span>
              </label>
            )}
            {error && <p className="kb-auth-error">{error}</p>}
            <button
              className="kb-btn kb-btn-primary kb-auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (mode === 'signin' ? 'Signing in...' : 'Creating account...') : (mode === 'signin' ? 'Sign In' : 'Create Account')}
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
  .kb-biometric-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    border-radius: 16px;
    border: 1px solid #2a2d3a;
    background: rgba(99, 102, 241, 0.08);
    color: #818cf8;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    width: 100%;
    margin-bottom: 0;
  }
  .kb-biometric-btn:hover {
    background: rgba(99, 102, 241, 0.15);
    border-color: #4f46e5;
  }
  .kb-biometric-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .kb-auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
    color: #4b5563;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .kb-auth-divider::before,
  .kb-auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #2a2d3a;
  }

  /* ── Responsive ── */
  @media (max-width: 480px) {
    .kb-auth-card { padding: 24px 20px; }
    .kb-auth-title { font-size: 20px; }
    .kb-input { font-size: 16px; }
  }
  .kb-remember-me {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #9ca3af;
    cursor: pointer;
    margin-bottom: 8px;
  }
  .kb-checkbox {
    width: 16px;
    height: 16px;
    accent-color: #6366f1;
  }
  .kb-invite-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 10px;
    margin-bottom: 20px;
  }
`;
