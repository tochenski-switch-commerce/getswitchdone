import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function probe() {
  const { data: userData, error: userError } = await supabase
    .from('user_profiles')
    .select('id')
    .limit(1)
    .single();
  if (userError) throw userError;

  const { data: cardData, error: cardError } = await supabase
    .from('board_cards')
    .select('id, board_id, title')
    .limit(1)
    .single();
  if (cardError) throw cardError;

  console.log(JSON.stringify({
    user_id: userData.id,
    board_id: cardData.board_id,
    card_id: cardData.id,
    card_title: cardData.title
  }));
}
probe().catch(err => { console.error(err); process.exit(1); });
