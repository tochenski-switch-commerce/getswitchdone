'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Loader, Sparkles } from '@/components/BoardIcons';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { isNative, getOfferings, purchasePackage, restorePurchases, hasProEntitlement } from '@/lib/revenuecat';
import { presentWebPaywall, hasWebProEntitlement, getWebCustomerInfo } from '@/lib/revenuecat-web';
import { RC_ENTITLEMENT } from '@/lib/plan-config';
import { hapticLight, hapticMedium } from '@/lib/haptics';

const PRO_FEATURES = [
  'Unlimited boards',
  'Unlimited cards',
  'Team collaboration',
  'AI-powered assistant',
  'Advanced automations',
  'Priority support',
];

export default function PaywallModal() {
  const { paywallOpen, setPaywallOpen, refresh } = useSubscriptionContext();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [packageData, setPackageData] = useState<any>(null);
  const [webPaywallActive, setWebPaywallActive] = useState(false);
  const paywallContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paywallOpen) {
      setWebPaywallActive(false);
      return;
    }
    setError(null);

    if (isNative()) {
      loadNativeOfferings();
    }
  }, [paywallOpen]);

  // ── Native (iOS): load offerings for manual purchase UI ──
  async function loadNativeOfferings() {
    try {
      const offerings = await getOfferings();
      const pkg = offerings?.monthly ?? offerings?.availablePackages?.[0];
      if (pkg) {
        setPrice(pkg.localizedPrice);
        setPackageData(pkg);
      }
    } catch (err) {
      console.error('Failed to load offerings:', err);
    }
  }

  // ── Native (iOS): purchase a package ──
  async function handleNativePurchase() {
    if (!packageData) return;
    setLoading(true);
    setError(null);
    hapticMedium();

    try {
      const info = await purchasePackage(packageData.identifier);
      if (info && hasProEntitlement(info)) {
        await refresh();
        setPaywallOpen(false);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Purchase failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Native (iOS): restore purchases ──
  async function handleRestore() {
    setRestoring(true);
    setError(null);
    hapticLight();

    try {
      const info = await restorePurchases();
      if (info && hasProEntitlement(info)) {
        await refresh();
        setPaywallOpen(false);
      } else {
        setError('No active subscription found to restore.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  // ── Web: use RevenueCat presentPaywall (renders into DOM element) ──
  const handleWebPaywall = useCallback(async () => {
    if (!paywallContainerRef.current) return;
    setWebPaywallActive(true);
    setError(null);

    try {
      const result = await presentWebPaywall(paywallContainerRef.current);
      if (result) {
        const { customerInfo } = result;
        if (RC_ENTITLEMENT in customerInfo.entitlements.active) {
          await refresh();
          setPaywallOpen(false);
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Purchase failed. Please try again.');
    } finally {
      setWebPaywallActive(false);
    }
  }, [refresh, setPaywallOpen]);

  // Auto-launch web paywall when modal opens (non-native)
  useEffect(() => {
    if (paywallOpen && !isNative()) {
      // Small delay to ensure the container ref is mounted
      const timer = setTimeout(handleWebPaywall, 100);
      return () => clearTimeout(timer);
    }
  }, [paywallOpen, handleWebPaywall]);

  if (!paywallOpen) return null;

  // ── Web: render the RevenueCat paywall container ──
  if (!isNative()) {
    return (
      <div className="kb-modal-overlay" onClick={() => !webPaywallActive && setPaywallOpen(false)}>
        <div
          className="kb-modal"
          style={{ maxWidth: 968, margin: '40px auto', padding: 0, minHeight: 400 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={() => setPaywallOpen(false)}
            style={{
              position: 'absolute', top: 12, right: 12, zIndex: 10,
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <X size={16} />
          </button>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '8px 12px', margin: '12px 16px 0',
              color: '#f87171', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* RevenueCat paywall renders here */}
          <div
            ref={paywallContainerRef}
            style={{ width: '100%', minHeight: 360 }}
          />
        </div>
      </div>
    );
  }

  // ── Native (iOS): custom purchase UI ──
  return (
    <div className="kb-modal-overlay" onClick={() => setPaywallOpen(false)}>
      <div
        className="kb-modal"
        style={{ maxWidth: 440, margin: '60px auto', padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          padding: '32px 24px 24px',
          textAlign: 'center',
          position: 'relative',
        }}>
          <button
            onClick={() => setPaywallOpen(false)}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <X size={16} />
          </button>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(255,255,255,0.2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Sparkles size={28} style={{ color: '#fff' }} />
          </div>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
            Upgrade to Pro
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, margin: 0 }}>
            Unlock the full power of Lumio
          </p>
        </div>

        {/* Features */}
        <div style={{ padding: '20px 24px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {PRO_FEATURES.map(feature => (
              <li key={feature} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', color: '#e2e4ea', fontSize: 14,
              }}>
                <Check size={16} style={{ color: '#6366f1' }} />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Price + CTA */}
        <div style={{ padding: '0 24px 24px' }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '8px 12px', marginBottom: 12,
              color: '#f87171', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleNativePurchase}
            disabled={loading || !packageData}
            style={{
              width: '100%', padding: '14px 20px',
              background: loading ? '#4f46e5' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading || !packageData ? 0.7 : 1,
            }}
          >
            {loading ? (
              <><Loader size={18} className="kb-spinner" /> Processing...</>
            ) : (
              <>Subscribe {price ? `\u2022 ${price}/month` : ''}</>
            )}
          </button>

          {/* Restore purchases */}
          <button
            onClick={handleRestore}
            disabled={restoring}
            style={{
              width: '100%', marginTop: 8, padding: '10px',
              background: 'transparent', color: '#9ca3af', border: 'none',
              fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
              opacity: restoring ? 0.5 : 1,
            }}
          >
            {restoring ? 'Restoring...' : 'Restore Purchases'}
          </button>
        </div>
      </div>
    </div>
  );
}
