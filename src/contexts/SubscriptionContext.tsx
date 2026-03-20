'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PLANS, type PlanTier, type PlanLimits } from '@/lib/plan-config';

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
        .maybeSingle();

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

    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

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
