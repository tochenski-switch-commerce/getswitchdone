'use client';

import React from 'react';
import { X, Check, Sparkles } from '@/components/BoardIcons';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';

const PRO_FEATURES = [
  'Unlimited boards',
  'Unlimited cards',
  'Team collaboration',
  'AI-powered assistant',
  'Advanced automations',
  'Priority support',
];

export default function PaywallModal() {
  const { paywallOpen, setPaywallOpen } = useSubscriptionContext();

  if (!paywallOpen) return null;

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

        {/* CTA */}
        <div style={{ padding: '0 24px 24px' }}>
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
            Subscription upgrades coming soon. Contact us to get Pro access.
          </p>
          <button
            onClick={() => setPaywallOpen(false)}
            style={{
              width: '100%', padding: '12px 20px',
              background: 'transparent', color: '#9ca3af',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
              fontSize: 14, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
