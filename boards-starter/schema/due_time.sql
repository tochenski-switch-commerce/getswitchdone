-- Add due_time column to board_cards (stores time as "HH:mm" in 24h format)
ALTER TABLE board_cards ADD COLUMN IF NOT EXISTS due_time text;
