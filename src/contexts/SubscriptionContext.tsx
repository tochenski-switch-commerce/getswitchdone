'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PLANS, RC_ENTITLEMENT, type PlanTier, type PlanLimits } from '@/lib/plan-config';
import { isNative, getCustomerInfo, hasProEntitlement } from '@/lib/revenuecat';
import { isWeb, getWebCustomerInfo, hasWebProEntitlement, onCustomerInfoUpdated } from '@/lib/revenuecat-web';

interface SubscriptionContextType {
  plan: PlanTier;
  isProUser: boolean;
  limits: PlanLimits;
  loading: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  isStaffGrant: boolean;
  refresh: () => Promise<void>;
  showPaywall: () => void;
  paywallOpen: boolean;
  setPaywallOpen: (open: boolean) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanTier>('free');
  const [status, setStatus] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [isStaffGrant, setIsStaffGrant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setPlan('free');
      setStatus(null);
      setCurrentPeriodEnd(null);
      setIsStaffGrant(false);
      setLoading(false);
      return;
    }

    try {
      // Fetch from Supabase
      const { data } = await supabase
        .from('user_subscriptions')
        .select('entitlement, status, current_period_end, is_staff_grant')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setPlan(data.entitlement as PlanTier);
        setStatus(data.status);
        setCurrentPeriodEnd(data.current_period_end);
        setIsStaffGrant(data.is_staff_grant ?? false);
      } else {
        setPlan('free');
        setStatus(null);
        setCurrentPeriodEnd(null);
        setIsStaffGrant(false);
      }

      // Also check RevenueCat SDK for real-time accuracy
      if (isNative()) {
        const info = await getCustomerInfo();
        if (info && hasProEntitlement(info)) {
          setPlan('pro');
        }
      } else if (isWeb()) {
        const info = await getWebCustomerInfo();
        if (hasWebProEntitlement(info)) {
          setPlan('pro');
        }
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Listen for real-time customer info updates (web SDK fires this after purchases)
  useEffect(() => {
    if (!isWeb()) return;
    const cleanup = onCustomerInfoUpdated((info) => {
      if (RC_ENTITLEMENT in info.entitlements.active) {
        setPlan('pro');
      }
    });
    return cleanup;
  }, []);

  const isProUserValue = plan === 'pro' || isStaffGrant;
  const limits = isProUserValue ? PLANS.pro : PLANS.free;

  const showPaywall = useCallback(() => {
    setPaywallOpen(true);
  }, []);

  return (
    <SubscriptionContext.Provider value={{
      plan,
      isProUser: isProUserValue,
      limits,
      loading,
      status,
      currentPeriodEnd,
      isStaffGrant,
      refresh: fetchSubscription,
      showPaywall,
      paywallOpen,
      setPaywallOpen,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  return context;
}
