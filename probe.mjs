import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://iwkwbvkmpetfcgdjqbgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a3didmttcGV0ZmNnZGpxYmdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgxMzYxNCwiZXhwIjoyMDg4Mzg5NjE0fQ.pJKUEHfy_fsCpEaN3BN9aoeTjmJId90Ao-RoEQFlqns'
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
