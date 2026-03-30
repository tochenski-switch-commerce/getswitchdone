CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  key_prefix   text NOT NULL,
  last_used_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id  ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own api keys"
  ON api_keys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own api keys"
  ON api_keys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own api keys"
  ON api_keys FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- No DELETE policy — revocation is soft via revoked_at
