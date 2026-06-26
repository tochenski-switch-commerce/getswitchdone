import { createClient } from '@supabase/supabase-js';
import type { PlanTier } from './plan-config';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface UserSubscription {
  id: string;
  user_id: string;
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

// Feature-scoped allowlist for the meeting-notes import page. Lets specific
// accounts (e.g. Trip, Vic) use the AI import even without a Pro entitlement,
// without touching the global isProUser gate that covers all AI features.
const IMPORT_WHITELIST = (process.env.IMPORT_WHITELIST_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export function isImportWhitelisted(email?: string | null): boolean {
  return !!email && IMPORT_WHITELIST.includes(email.toLowerCase());
}

export async function getEntitlement(userId: string): Promise<PlanTier> {
  const sub = await getSubscriptionForUser(userId);
  if (!sub) return 'free';
  if (sub.is_staff_grant) return 'pro';
  return sub.entitlement;
}
