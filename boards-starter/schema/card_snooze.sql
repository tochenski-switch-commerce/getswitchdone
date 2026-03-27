-- Card Snooze: allows hiding a card until a specified date/time
-- When snoozed_until is set and in the future, the card is hidden from the board.
-- It reappears automatically when snoozed_until passes.

ALTER TABLE board_cards
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_board_cards_snoozed_until
  ON board_cards(snoozed_until)
  WHERE snoozed_until IS NOT NULL;
