-- Watcher invites: allow non-users to be added as card watchers via email
CREATE TABLE IF NOT EXISTS watcher_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  claimed_at timestamptz,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE watcher_invites ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can create invites
CREATE POLICY "authenticated users insert invites"
  ON watcher_invites FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Anyone can read by token (needed for unauthenticated claim page)
CREATE POLICY "public read by token"
  ON watcher_invites FOR SELECT
  USING (true);

-- Authenticated users can claim (update) invites
CREATE POLICY "authenticated claim invites"
  ON watcher_invites FOR UPDATE
  USING (auth.uid() IS NOT NULL);
