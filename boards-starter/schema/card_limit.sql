-- Add optional card limit to columns
-- When card count >= card_limit, the column is highlighted in the UI

ALTER TABLE board_columns
  ADD COLUMN IF NOT EXISTS card_limit integer;
