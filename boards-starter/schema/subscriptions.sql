-- ============================================================
-- Subscription / paywall system for Lumio
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 1. Create the user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  revenuecat_app_user_id  text,
  entitlement             text NOT NULL DEFAULT 'free',       -- 'free' | 'pro'
  product_id              text,
  platform                text,                               -- 'ios' | 'stripe' | 'promotional'
  status                  text NOT NULL DEFAULT 'active',     -- 'active' | 'expired' | 'canceled' | 'grace_period'
  is_staff_grant          boolean DEFAULT false,              -- admin bypass: manually granted Pro
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  is_sandbox              boolean DEFAULT false,
  raw_data                jsonb,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_rc_id ON user_subscriptions(revenuecat_app_user_id);

-- 2. Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can insert/update/delete (webhook handler + admin)
-- No INSERT/UPDATE/DELETE policies for authenticated role = service role only

-- 3. Staff admin functions (run via Supabase SQL editor or admin API)
CREATE OR REPLACE FUNCTION grant_pro(target_user_id uuid)
RETURNS void AS $$
  INSERT INTO user_subscriptions (user_id, entitlement, platform, is_staff_grant)
  VALUES (target_user_id, 'pro', 'promotional', true)
  ON CONFLICT (user_id) DO UPDATE
    SET entitlement = 'pro', is_staff_grant = true, updated_at = now();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION revoke_pro(target_user_id uuid)
RETURNS void AS $$
  UPDATE user_subscriptions
  SET entitlement = 'free', is_staff_grant = false, updated_at = now()
  WHERE user_id = target_user_id AND is_staff_grant = true;
$$ LANGUAGE sql SECURITY DEFINER;
