CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  url        text NOT NULL,
  secret     text NOT NULL,
  events     text[] NOT NULL DEFAULT '{}',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_user_id ON webhook_endpoints(user_id);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own webhooks"
  ON webhook_endpoints FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own webhooks"
  ON webhook_endpoints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own webhooks"
  ON webhook_endpoints FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Delete own webhooks"
  ON webhook_endpoints FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
