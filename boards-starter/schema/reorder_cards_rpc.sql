-- RPC to reorder cards in a column in a single round-trip
-- Replaces N individual UPDATE calls from the client during drag-drop

CREATE OR REPLACE FUNCTION reorder_cards_in_column(
  p_column_id uuid,
  p_card_ids  uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE board_cards
  SET
    column_id = p_column_id,
    position  = pos.idx
  FROM (
    SELECT unnest(p_card_ids) AS id,
           generate_subscripts(p_card_ids, 1) - 1 AS idx
  ) AS pos
  WHERE board_cards.id = pos.id;
END;
$$;
