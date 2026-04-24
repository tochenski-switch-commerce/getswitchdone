-- Fix FK constraints that block auth.users deletion (account deletion flow)

-- board_cards.created_by: SET NULL so the card persists without a creator reference
ALTER TABLE board_cards DROP CONSTRAINT IF EXISTS board_cards_created_by_fkey;
ALTER TABLE board_cards
  ADD CONSTRAINT board_cards_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- card_comments.user_id: CASCADE so comments are removed when the user is deleted
ALTER TABLE card_comments DROP CONSTRAINT IF EXISTS card_comments_user_id_fkey;
ALTER TABLE card_comments
  ADD CONSTRAINT card_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- team_invites.created_by: CASCADE so invites are removed when the creator is deleted
ALTER TABLE team_invites DROP CONSTRAINT IF EXISTS team_invites_created_by_fkey;
ALTER TABLE team_invites
  ADD CONSTRAINT team_invites_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
