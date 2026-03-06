-- ============================================================
-- Board Emails — forwarded emails stored per board
-- A single inbound address for the whole app; subject-line
-- fuzzy-matching routes each email to its board.
-- ============================================================

-- 1. board_emails — the actual stored emails
CREATE TABLE IF NOT EXISTS board_emails (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id      uuid REFERENCES project_boards(id) ON DELETE CASCADE,  -- NULL = unrouted
  message_id    text,                          -- original Message-ID header (dedup)
  from_address  text NOT NULL,
  from_name     text,
  to_address    text NOT NULL,
  subject       text,
  body_text     text,                          -- plain text body (search + AI)
  body_html     text,                          -- HTML body (for rendering)
  headers       jsonb DEFAULT '{}'::jsonb,     -- raw headers if needed later
  received_at   timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_board_emails_board_id ON board_emails(board_id);
CREATE INDEX IF NOT EXISTS idx_board_emails_received_at ON board_emails(board_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_emails_message_id ON board_emails(message_id);

-- Full-text search index for email content
-- Subject weighted highest (A), body text (B), sender info (C)
ALTER TABLE board_emails ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(from_name, '') || ' ' || coalesce(from_address, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_board_emails_fts ON board_emails USING gin(fts);

-- RLS
ALTER TABLE board_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View board emails" ON board_emails
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Update board emails" ON board_emails
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delete board emails" ON board_emails
  FOR DELETE TO authenticated USING (true);

-- Webhook inserts via anon client (same pattern as form submissions)
CREATE POLICY "Anon insert board emails" ON board_emails
  FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- Update notifications.type CHECK constraint to include
-- 'email_unrouted' for unresolved email routing notifications
-- ============================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('comment', 'assignment', 'due_soon', 'overdue', 'email_unrouted'));
