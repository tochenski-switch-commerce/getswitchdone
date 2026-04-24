'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useWebPush } from '@/hooks/useWebPush';
import { Bell, Mail } from 'lucide-react';

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/boards';
  const { user, profile, loading: authLoading } = useAuth();
  const { state: pushState, subscribe: pushSubscribe } = useWebPush(user?.id);

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameChecking, setNameChecking] = useState(false);

  // Step 2
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabling, setPushEnabling] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Redirect if already fully set up
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth?returnTo=/onboarding${returnTo !== '/boards' ? `&innerReturn=${encodeURIComponent(returnTo)}` : ''}`);
    }
  }, [authLoading, user, router, returnTo]);

  useEffect(() => {
    if (profile?.name && profile.name.trim() !== '') {
      router.replace(returnTo);
    }
  }, [profile, router, returnTo]);

  if (authLoading || !user) return null;
  if (profile?.name && profile.name.trim() !== '') return null;

  const pushGranted = pushState === 'granted';
  const pushDenied = pushState === 'denied';
  const pushUnsupported = pushState === 'unsupported';

  const handleEnablePush = async () => {
    if (pushGranted || pushUnsupported || pushDenied) return;
    setPushEnabling(true);
    await pushSubscribe();
    setPushEnabling(false);
  };

  const handleNameContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Please enter a display name.'); return; }
    setNameError('');
    setNameChecking(true);

    // Check uniqueness (matches ProfilePage logic)
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .ilike('name', trimmed)
      .neq('id', user.id)
      .limit(1);

    setNameChecking(false);
    if (existing && existing.length > 0) {
      setNameError('That name is already taken. Try a different one.');
      return;
    }

    setStep(2);
  };

  const handleComplete = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ name: name.trim(), emailNotificationsEnabled: emailEnabled }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSubmitError(json.error || 'Something went wrong. Please try again.');
        return;
      }
      router.replace(returnTo);
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      color: '#e5e7eb',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <style>{onboardingStyles}</style>

      <div className="ob-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 0 851 290" style={{ height: 28, width: 'auto' }} aria-label="Lumio">
            <path fillRule="evenodd" fill="white" transform="translate(0, -3.891)" d="M836.649,243.604 C828.405,257.165 817.226,267.951 803.100,275.964 C788.974,283.982 772.961,287.989 755.072,287.989 C737.177,287.989 721.169,283.982 707.043,275.964 C692.918,267.951 681.733,257.104 673.494,243.427 C665.251,229.756 661.134,214.427 661.134,197.451 C661.134,180.713 665.195,165.622 673.318,152.183 C681.440,138.744 692.564,128.078 706.690,120.176 C720.816,112.280 736.940,108.329 755.072,108.329 C772.729,108.329 788.676,112.219 802.923,119.1000 C817.165,127.780 828.405,138.451 836.649,152.006 C844.887,165.567 849.009,180.713 849.009,197.451 C849.009,214.665 844.887,230.049 836.649,243.604 ZM788.621,177.116 C785.321,171.104 780.791,166.390 775.024,162.969 C769.253,159.554 762.604,157.841 755.072,157.841 C747.534,157.841 740.824,159.554 734.942,162.969 C729.055,166.390 724.464,171.164 721.169,177.293 C717.870,183.426 716.225,190.262 716.225,197.805 C716.225,205.823 717.870,212.957 721.169,219.201 C724.464,225.451 729.055,230.226 734.942,233.525 C740.824,236.829 747.534,238.476 755.072,238.476 C762.604,238.476 769.313,236.829 775.201,233.525 C781.083,230.226 785.619,225.451 788.797,219.201 C791.976,212.957 793.565,205.823 793.565,197.805 C793.565,190.024 791.915,183.128 788.621,177.116 Z" />
            <path fill="white" d="M607.665,85.002 C599.884,85.002 593.331,82.269 587.998,76.798 C582.665,71.331 580.028,64.768 579.998,57.107 C579.941,42.541 586.944,32.765 592.177,28.186 C589.274,44.173 605.779,44.594 601.191,31.580 C594.742,10.187 607.500,0.000 607.500,0.000 C607.500,0.000 608.726,13.316 627.498,37.416 C631.946,43.126 634.998,49.231 634.998,57.107 C634.998,64.768 632.498,71.331 627.498,76.798 C622.498,82.269 615.883,85.002 607.665,85.002 ZM491.959,189.321 C491.959,183.425 490.900,178.297 488.781,173.937 C486.662,169.571 483.605,166.212 479.599,163.858 C475.598,161.498 470.892,160.321 465.473,160.321 C457.472,160.321 451.170,162.913 446.579,168.101 C441.989,173.285 439.693,180.358 439.693,189.321 L439.693,287.993 L439.283,287.993 L385.308,287.993 L384.898,287.993 L384.898,189.321 C384.898,183.425 383.839,178.297 381.720,173.937 C379.601,169.571 376.544,166.212 372.538,163.858 C368.538,161.498 363.831,160.321 358.412,160.321 C350.411,160.321 344.110,162.913 339.519,168.101 C334.928,173.285 332.633,180.358 332.633,189.321 L332.633,287.993 L278.248,287.993 L278.248,188.614 C278.248,173.522 281.603,160.260 288.313,148.827 C295.022,137.388 304.381,128.431 316.388,121.949 C328.395,115.467 342.405,112.223 358.412,112.223 C373.951,112.223 387.900,115.528 400.260,122.126 C404.440,124.356 408.295,126.871 411.842,129.655 C415.390,126.787 419.254,124.213 423.448,121.949 C435.455,115.467 449.465,112.223 465.473,112.223 C481.011,112.223 494.961,115.528 507.321,122.126 C519.681,128.724 529.277,137.742 536.103,149.181 C542.934,160.614 546.344,173.760 546.344,188.614 L546.344,287.993 L491.959,287.993 L491.959,189.321 ZM210.814,278.263 C198.807,284.745 184.797,287.989 168.789,287.989 C153.251,287.989 139.302,284.684 126.941,278.086 C114.581,271.488 104.986,262.470 98.160,251.031 C91.329,239.598 87.918,226.451 87.918,211.598 L87.918,112.219 L142.303,112.219 L142.303,210.890 C142.303,216.787 143.363,221.915 145.482,226.275 C147.601,230.640 150.657,233.1000 154.664,236.354 C158.664,238.714 163.371,239.891 168.789,239.891 C176.790,239.891 183.092,237.299 187.683,232.110 C192.274,226.927 194.569,219.854 194.569,210.890 L194.569,112.219 L248.954,112.219 L248.954,211.598 C248.954,226.689 245.599,239.951 238.889,251.385 C232.179,262.823 222.821,271.781 210.814,278.263 ZM-0.015,27.340 L54.369,27.340 L54.369,284.098 L-0.015,284.098 L-0.015,27.340 ZM634.648,284.098 L580.263,284.098 L580.263,112.219 L634.648,112.219 L634.648,284.098 Z" />
          </svg>
        </div>

        {/* Step indicator */}
        <div className="ob-steps">
          <div className={`ob-step-dot${step >= 1 ? ' active' : ''}`} />
          <div className="ob-step-line" />
          <div className={`ob-step-dot${step >= 2 ? ' active' : ''}`} />
        </div>

        {/* ── Step 1: Name ── */}
        {step === 1 && (
          <>
            <h1 className="ob-title">Welcome to Lumio</h1>
            <p className="ob-subtitle">
              Let's get you set up in about a minute. First — what should we call you?
            </p>
            <div style={{ marginBottom: 6 }}>
              <label className="ob-label">Display Name</label>
              <input
                className="ob-input"
                type="text"
                placeholder="e.g. Jordan or Jordan Smith"
                value={name}
                onChange={e => { setName(e.target.value); setNameError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleNameContinue(); }}
                autoFocus
                maxLength={40}
              />
              {nameError && <p className="ob-error">{nameError}</p>}
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                This is how you'll appear to teammates. You can change it later in your profile.
              </p>
            </div>
            <button
              className="ob-btn-primary"
              onClick={handleNameContinue}
              disabled={nameChecking || !name.trim()}
              style={{ marginTop: 20 }}
            >
              {nameChecking ? 'Checking…' : 'Continue →'}
            </button>
          </>
        )}

        {/* ── Step 2: Notifications ── */}
        {step === 2 && (
          <>
            <h1 className="ob-title">Stay in the loop</h1>
            <p className="ob-subtitle">
              Choose how Lumio keeps you updated. You can fine-tune these any time in your profile.
            </p>

            {/* Push notifications */}
            {!pushUnsupported && (
              <div className="ob-notif-row">
                <div className="ob-notif-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
                  <Bell size={18} color="#818cf8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="ob-notif-title">Push notifications</p>
                  <p className="ob-notif-desc">
                    {pushDenied
                      ? 'Blocked in browser settings — enable in your browser to receive alerts.'
                      : 'Get alerts for assignments, comments, and due dates.'}
                  </p>
                </div>
                {!pushDenied && (
                  pushGranted ? (
                    <span className="ob-notif-badge enabled">Enabled</span>
                  ) : (
                    <button
                      className="ob-notif-enable-btn"
                      onClick={handleEnablePush}
                      disabled={pushEnabling}
                    >
                      {pushEnabling ? 'Enabling…' : 'Enable'}
                    </button>
                  )
                )}
                {pushDenied && <span className="ob-notif-badge denied">Blocked</span>}
              </div>
            )}

            {/* Email notifications */}
            <div className="ob-notif-row">
              <div className="ob-notif-icon" style={{ background: 'rgba(250,66,15,0.1)' }}>
                <Mail size={18} color="#fa420f" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="ob-notif-title">Email updates</p>
                <p className="ob-notif-desc">Summaries, due date reminders, and comment notifications.</p>
              </div>
              <button
                className={`ob-toggle${emailEnabled ? ' on' : ''}`}
                onClick={() => setEmailEnabled(prev => !prev)}
                aria-label="Toggle email notifications"
              >
                <span className="ob-toggle-knob" />
              </button>
            </div>

            {submitError && <p className="ob-error" style={{ marginTop: 8 }}>{submitError}</p>}

            <button
              className="ob-btn-primary"
              onClick={handleComplete}
              disabled={submitting}
              style={{ marginTop: 24 }}
            >
              {submitting ? 'Setting up your workspace…' : 'Get Started →'}
            </button>

            <button
              className="ob-btn-ghost"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const onboardingStyles = `
  .ob-card {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 18px;
    padding: 40px 32px;
    max-width: 420px;
    width: 100%;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }

  .ob-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: 28px;
  }

  .ob-step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #2a2d3a;
    transition: background 0.2s;
  }
  .ob-step-dot.active { background: #fa420f; }

  .ob-step-line {
    width: 32px;
    height: 2px;
    background: #2a2d3a;
    margin: 0 6px;
  }

  .ob-title {
    font-size: 22px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0 0 6px;
    text-align: center;
  }

  .ob-subtitle {
    font-size: 14px;
    color: #9ca3af;
    margin: 0 0 24px;
    text-align: center;
    line-height: 1.6;
  }

  .ob-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }

  .ob-input {
    width: 100%;
    background: #0f1117;
    border: 1px solid #374151;
    border-radius: 10px;
    padding: 11px 14px;
    font-size: 15px;
    color: #e5e7eb;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .ob-input:focus {
    border-color: #fa420f;
    box-shadow: 0 0 0 2px rgba(250,66,15,0.18);
  }

  .ob-error {
    font-size: 12px;
    color: #ef4444;
    margin: 6px 0 0;
  }

  .ob-btn-primary {
    display: block;
    width: 100%;
    padding: 13px;
    background: #fa420f;
    color: #fff;
    border: none;
    border-radius: 11px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }
  .ob-btn-primary:hover { background: #e03a0d; }
  .ob-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .ob-btn-ghost {
    display: block;
    width: 100%;
    padding: 11px;
    background: transparent;
    color: #6b7280;
    border: none;
    border-radius: 11px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 8px;
  }
  .ob-btn-ghost:hover { color: #9ca3af; }
  .ob-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Notification rows */
  .ob-notif-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    margin-bottom: 10px;
  }

  .ob-notif-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ob-notif-title {
    margin: 0 0 2px;
    font-size: 13px;
    font-weight: 600;
    color: #e5e7eb;
  }
  .ob-notif-desc {
    margin: 0;
    font-size: 11px;
    color: #6b7280;
    line-height: 1.5;
  }

  .ob-notif-enable-btn {
    background: #fa420f;
    color: #fff;
    border: none;
    border-radius: 7px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .ob-notif-enable-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .ob-notif-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 20px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .ob-notif-badge.enabled { background: rgba(34,197,94,0.12); color: #22c55e; }
  .ob-notif-badge.denied { background: rgba(239,68,68,0.1); color: #f87171; }

  /* Toggle */
  .ob-toggle {
    width: 40px;
    height: 22px;
    border-radius: 11px;
    background: #374151;
    border: none;
    cursor: pointer;
    padding: 0;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .ob-toggle.on { background: #fa420f; }

  .ob-toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: left 0.2s;
  }
  .ob-toggle.on .ob-toggle-knob { left: 20px; }

  @media (max-width: 480px) {
    .ob-card { padding: 28px 20px; border-radius: 0; border-left: none; border-right: none; min-height: 100vh; }
    .ob-input { font-size: 16px; }
  }
`;
