-- ============================================================
-- Profile-level notification settings used for outbound email
-- Run this in your Supabase SQL editor.
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS due_soon_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comment_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS assignment_notifications_enabled boolean NOT NULL DEFAULT true;
