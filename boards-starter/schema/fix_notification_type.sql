-- ============================================================
-- Fix: Add 'email_unrouted' to notifications type CHECK constraint
-- Run this in your Supabase SQL editor.
-- ============================================================

-- Drop and recreate the CHECK constraint to include email_unrouted
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('comment', 'assignment', 'due_soon', 'overdue', 'mention', 'email_unrouted'));
