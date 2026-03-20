-- comment_reactions — thumbs up / thumbs down on card comments

CREATE TABLE IF NOT EXISTS comment_reactions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id    uuid NOT NULL REFERENCES card_comments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);

ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View reactions" ON comment_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage own reactions" ON comment_reactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Expand the notifications type CHECK constraint to include comment_reaction
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('comment', 'assignment', 'due_soon', 'overdue', 'mention', 'email_unrouted', 'checklist_overdue', 'comment_reaction'));
