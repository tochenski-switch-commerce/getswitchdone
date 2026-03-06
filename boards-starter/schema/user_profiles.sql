-- ============================================================
-- User Profiles — @handle names for commenting & notifications
-- Run this in your Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_name ON user_profiles(name);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read profiles (needed for comment author names)
CREATE POLICY "View all profiles" ON user_profiles
  FOR SELECT TO authenticated USING (true);

-- Users can only insert/update their own profile
CREATE POLICY "Insert own profile" ON user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Update own profile" ON user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
