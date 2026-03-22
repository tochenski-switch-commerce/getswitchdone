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
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(
    searchParams.get('tab') === 'signup' ? 'signup' : 'signin'
  );
  const joinFlowActive = returnTo.startsWith('/join/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(inviteParam);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometryType, setBiometryType] = useState('');
  const [biometricLoading, setBiometricLoading] = useState(false);
  // Post-login Face ID opt-in prompt
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);
  const [pendingDestination, setPendingDestination] = useState(returnTo);
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
      // Offer Face ID enrollment after sign-up too
      const available = await isBiometricAvailable();
      if (available) {
        const type = await getBiometryType();
        setBiometryType(type);
        setPendingCredentials({ email, password });
        setPendingDestination(teamId ? `/teams/${teamId}` : returnTo);
        setShowBiometricPrompt(true);
        return;
      }
      setHoldRedirect(false);
      // If joined via createUser (manual invite code), go to team page; otherwise use returnTo
      router.push(teamId ? `/teams/${teamId}` : returnTo);
      return;
    }

    // Sign-in mode
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
    if (available && !hasCreds) {
      const type = await getBiometryType();
      setBiometryType(type);
      setPendingCredentials({ email, password });
      setPendingDestination(returnTo);
      setShowBiometricPrompt(true);
      return; // don't navigate yet — wait for user choice
    }

    // If already enrolled or not available, just go
    setHoldRedirect(false);
    router.push(returnTo);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Something went wrong. Please try again.');
    } else {
      setForgotSuccess(true);
    }
  };

  const handleEnableBiometric = async () => {
    if (pendingCredentials) {
      await storeLoginCredentials(pendingCredentials.email, pendingCredentials.password);
    }
    setShowBiometricPrompt(false);
    setHoldRedirect(false);
    router.push(pendingDestination);
  };

  const handleSkipBiometric = () => {
    setShowBiometricPrompt(false);
    setHoldRedirect(false);
    router.push(pendingDestination);
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
              background: 'rgba(250, 66, 15, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fa420f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

  // ── Forgot password view ──
  if (mode === 'forgot') {
    return (
      <div className="kb-root">
        <style>{authStyles}</style>
        <div className="kb-auth-container">
          <div className="kb-auth-card">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'rgba(250, 66, 15, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fa420f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h1 className="kb-auth-title" style={{ marginBottom: 0 }}>Forgot password?</h1>
            </div>
            {forgotSuccess ? (
              <>
                <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
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
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#f9fafb', margin: '0 0 8px' }}>Check your email</p>
                  <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5, margin: '0 0 24px' }}>
                    We sent a password reset link to <strong style={{ color: '#e5e7eb' }}>{email}</strong>.
                  </p>
                </div>
                <button
                  className="kb-btn"
                  onClick={() => { setMode('signin'); setForgotSuccess(false); }}
                  style={{ width: '100%', padding: 12, fontSize: 14, color: '#9ca3af', background: 'transparent' }}
                  type="button"
                >
                  Back to Sign In
                </button>
              </>
            ) : (
              <>
                <p className="kb-auth-subtitle">Enter your email and we&apos;ll send a reset link</p>
                <form onSubmit={handleForgotPassword}>
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
                  {error && <p className="kb-auth-error">{error}</p>}
                  <button
                    className="kb-btn kb-btn-primary kb-auth-submit"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
                <button
                  className="kb-btn"
                  onClick={() => { setMode('signin'); setError(''); }}
                  style={{ width: '100%', padding: 10, fontSize: 13, color: '#6b7280', background: 'transparent', marginTop: 8 }}
                  type="button"
                >
                  Back to Sign In
                </button>
              </>
            )}
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
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-1 0 851 290"
              style={{ height: 32, width: 'auto', marginBottom: 16 }}
              aria-label="Lumio"
            >
              <path fillRule="evenodd" fill="white" transform="translate(0, -3.891)" d="M836.649,243.604 C828.405,257.165 817.226,267.951 803.100,275.964 C788.974,283.982 772.961,287.989 755.072,287.989 C737.177,287.989 721.169,283.982 707.043,275.964 C692.918,267.951 681.733,257.104 673.494,243.427 C665.251,229.756 661.134,214.427 661.134,197.451 C661.134,180.713 665.195,165.622 673.318,152.183 C681.440,138.744 692.564,128.078 706.690,120.176 C720.816,112.280 736.940,108.329 755.072,108.329 C772.729,108.329 788.676,112.219 802.923,119.1000 C817.165,127.780 828.405,138.451 836.649,152.006 C844.887,165.567 849.009,180.713 849.009,197.451 C849.009,214.665 844.887,230.049 836.649,243.604 ZM788.621,177.116 C785.321,171.104 780.791,166.390 775.024,162.969 C769.253,159.554 762.604,157.841 755.072,157.841 C747.534,157.841 740.824,159.554 734.942,162.969 C729.055,166.390 724.464,171.164 721.169,177.293 C717.870,183.426 716.225,190.262 716.225,197.805 C716.225,205.823 717.870,212.957 721.169,219.201 C724.464,225.451 729.055,230.226 734.942,233.525 C740.824,236.829 747.534,238.476 755.072,238.476 C762.604,238.476 769.313,236.829 775.201,233.525 C781.083,230.226 785.619,225.451 788.797,219.201 C791.976,212.957 793.565,205.823 793.565,197.805 C793.565,190.024 791.915,183.128 788.621,177.116 Z" />
              <path fill="white" d="M607.665,85.002 C599.884,85.002 593.331,82.269 587.998,76.798 C582.665,71.331 580.028,64.768 579.998,57.107 C579.941,42.541 586.944,32.765 592.177,28.186 C589.274,44.173 605.779,44.594 601.191,31.580 C594.742,10.187 607.500,0.000 607.500,0.000 C607.500,0.000 608.726,13.316 627.498,37.416 C631.946,43.126 634.998,49.231 634.998,57.107 C634.998,64.768 632.498,71.331 627.498,76.798 C622.498,82.269 615.883,85.002 607.665,85.002 ZM491.959,189.321 C491.959,183.425 490.900,178.297 488.781,173.937 C486.662,169.571 483.605,166.212 479.599,163.858 C475.598,161.498 470.892,160.321 465.473,160.321 C457.472,160.321 451.170,162.913 446.579,168.101 C441.989,173.285 439.693,180.358 439.693,189.321 L439.693,287.993 L439.283,287.993 L385.308,287.993 L384.898,287.993 L384.898,189.321 C384.898,183.425 383.839,178.297 381.720,173.937 C379.601,169.571 376.544,166.212 372.538,163.858 C368.538,161.498 363.831,160.321 358.412,160.321 C350.411,160.321 344.110,162.913 339.519,168.101 C334.928,173.285 332.633,180.358 332.633,189.321 L332.633,287.993 L278.248,287.993 L278.248,188.614 C278.248,173.522 281.603,160.260 288.313,148.827 C295.022,137.388 304.381,128.431 316.388,121.949 C328.395,115.467 342.405,112.223 358.412,112.223 C373.951,112.223 387.900,115.528 400.260,122.126 C404.440,124.356 408.295,126.871 411.842,129.655 C415.390,126.787 419.254,124.213 423.448,121.949 C435.455,115.467 449.465,112.223 465.473,112.223 C481.011,112.223 494.961,115.528 507.321,122.126 C519.681,128.724 529.277,137.742 536.103,149.181 C542.934,160.614 546.344,173.760 546.344,188.614 L546.344,287.993 L491.959,287.993 L491.959,189.321 ZM210.814,278.263 C198.807,284.745 184.797,287.989 168.789,287.989 C153.251,287.989 139.302,284.684 126.941,278.086 C114.581,271.488 104.986,262.470 98.160,251.031 C91.329,239.598 87.918,226.451 87.918,211.598 L87.918,112.219 L142.303,112.219 L142.303,210.890 C142.303,216.787 143.363,221.915 145.482,226.275 C147.601,230.640 150.657,233.1000 154.664,236.354 C158.664,238.714 163.371,239.891 168.789,239.891 C176.790,239.891 183.092,237.299 187.683,232.110 C192.274,226.927 194.569,219.854 194.569,210.890 L194.569,112.219 L248.954,112.219 L248.954,211.598 C248.954,226.689 245.599,239.951 238.889,251.385 C232.179,262.823 222.821,271.781 210.814,278.263 ZM-0.015,27.340 L54.369,27.340 L54.369,284.098 L-0.015,284.098 L-0.015,27.340 ZM634.648,284.098 L580.263,284.098 L580.263,112.219 L634.648,112.219 L634.648,284.098 Z" />
            </svg>
          </div>
          <p className="kb-auth-subtitle">{mode === 'signin' ? 'Sign in to your account' : 'Create your account'}</p>

          {inviteParam && (
            <div className="kb-invite-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fa420f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <label className="kb-label" style={{ marginBottom: 0 }}>Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setError(''); setMode('forgot'); }}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#fa420f', cursor: 'pointer' }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
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
    background: #fa420f;
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
  .kb-btn-primary:hover {
    background: #e03a0d;
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
    background: rgba(250, 66, 15, 0.08);
    color: #fa420f;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    width: 100%;
    margin-bottom: 0;
  }
  .kb-biometric-btn:hover {
    background: rgba(250, 66, 15, 0.15);
    border-color: #fa420f;
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
    accent-color: #fa420f;
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
