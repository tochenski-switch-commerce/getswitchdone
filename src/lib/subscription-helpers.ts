import { createClient } from '@supabase/supabase-js';
import type { PlanTier } from './plan-config';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface UserSubscription {
  id: string;
  user_id: string;
  revenuecat_app_user_id: string | null;
  entitlement: PlanTier;
  product_id: string | null;
  platform: string | null;
  status: string;
  is_staff_grant: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  is_sandbox: boolean;
}

export async function getSubscriptionForUser(userId: string): Promise<UserSubscription | null> {
  const { data } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data as UserSubscription | null;
}

export async function isProUser(userId: string): Promise<boolean> {
  const sub = await getSubscriptionForUser(userId);
  if (!sub) return false;
  return sub.entitlement === 'pro' || sub.is_staff_grant;
}

export async function getEntitlement(userId: string): Promise<PlanTier> {
  const sub = await getSubscriptionForUser(userId);
  if (!sub) return 'free';
  if (sub.is_staff_grant) return 'pro';
  return sub.entitlement;
}
