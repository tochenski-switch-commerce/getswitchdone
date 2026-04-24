-- Card watchers: users who subscribe to notifications on a card without being assigned
CREATE TABLE IF NOT EXISTS card_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES board_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, user_id)
);

ALTER TABLE card_watchers ENABLE ROW LEVEL SECURITY;

-- Users manage their own watcher rows
CREATE POLICY "Users manage own watch rows" ON card_watchers
  FOR ALL USING (auth.uid() = user_id);

-- Board members can read all watcher rows for cards on boards they can access
CREATE POLICY "Board members read watchers" ON card_watchers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_cards bc
      JOIN project_boards pb ON pb.id = bc.board_id
      WHERE bc.id = card_id
        AND (
          pb.user_id = auth.uid()
          OR pb.is_public = true
        )
    )
  );

-- Board members can add watchers to their cards
CREATE POLICY "Board members add watchers" ON card_watchers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_cards bc
      JOIN project_boards pb ON pb.id = bc.board_id
      WHERE bc.id = card_id
        AND pb.user_id = auth.uid()
    )
  );

-- Board members can remove watchers from their cards; users can remove themselves
CREATE POLICY "Board members/users remove watchers" ON card_watchers
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM board_cards bc
      JOIN project_boards pb ON pb.id = bc.board_id
      WHERE bc.id = card_id
        AND pb.user_id = auth.uid()
    )
  );
