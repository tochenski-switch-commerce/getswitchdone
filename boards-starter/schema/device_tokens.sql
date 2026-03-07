-- ============================================================
-- Device Tokens Schema
-- Stores push notification device tokens per user
-- ============================================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, token)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

-- RLS
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tokens" ON device_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- Push notification trigger (requires pg_net extension)
--
-- SETUP:
-- 1. Enable pg_net in Supabase Dashboard → Database → Extensions
-- 2. Run this migration in Supabase SQL Editor
-- 3. Add matching env vars on Netlify:
--    PUSH_WEBHOOK_SECRET=<same-secret-as-in-app_config-table>
--    SUPABASE_SERVICE_ROLE_KEY=<from-supabase-dashboard>
--    APNS_KEY_ID=<from-apple-developer>
--    APNS_TEAM_ID=<from-apple-developer>
--    APNS_PRIVATE_KEY=<base64-encoded-.p8-file>
--    APNS_BUNDLE_ID=com.getswitchdone.boards
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Config table for push settings (avoids ALTER DATABASE permission issues)
CREATE TABLE IF NOT EXISTS app_config (
  key    text PRIMARY KEY,
  value  text NOT NULL
);

INSERT INTO app_config (key, value) VALUES
  ('push_webhook_url', 'https://getswitchdone.netlify.app'),
  ('push_webhook_secret', '<REPLACE_WITH_YOUR_SECRET>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- No RLS on app_config — only accessible by SECURITY DEFINER functions
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION send_push_on_notification()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url text;
  webhook_secret text;
BEGIN
  SELECT value INTO webhook_url FROM app_config WHERE key = 'push_webhook_url';
  SELECT value INTO webhook_secret FROM app_config WHERE key = 'push_webhook_secret';

  IF webhook_url IS NOT NULL AND webhook_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url    := webhook_url || '/api/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', webhook_secret
      ),
      body   := jsonb_build_object(
        'user_id',         NEW.user_id,
        'title',           NEW.title,
        'body',            COALESCE(NEW.body, ''),
        'type',            NEW.type,
        'board_id',        NEW.board_id,
        'card_id',         NEW.card_id,
        'notification_id', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER push_notification_trigger
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_on_notification();
