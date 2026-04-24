import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { name, emailNotificationsEnabled, dueSoonEnabled, commentEnabled, assignmentEnabled } = body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const trimmedName = name.trim();
  const bool = (v: unknown, fallback = true) => (typeof v === 'boolean' ? v : fallback);

  // Save profile
  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      name: trimmedName,
      email_notifications_enabled: bool(emailNotificationsEnabled),
      due_soon_notifications_enabled: bool(dueSoonEnabled),
      comment_notifications_enabled: bool(commentEnabled),
      assignment_notifications_enabled: bool(assignmentEnabled),
    })
    .eq('id', user.id);

  if (profileError) {
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }

  // Create personal board
  const { data: board, error: boardError } = await supabaseAdmin
    .from('project_boards')
    .insert({
      user_id: user.id,
      title: `${trimmedName}'s Board`,
      icon: 'layout-dashboard',
      icon_color: '#6366f1',
    })
    .select('id')
    .single();

  if (boardError || !board) {
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
  }

  // Create columns
  const columns = [
    { title: 'To Do', position: 0, color: '#6366f1' },
    { title: 'In Progress', position: 1, color: '#f59e0b' },
    { title: 'Done', position: 2, color: '#22c55e' },
  ];

  const { data: createdColumns, error: columnsError } = await supabaseAdmin
    .from('board_columns')
    .insert(columns.map(c => ({ ...c, board_id: board.id })))
    .select('id, title');

  if (columnsError || !createdColumns) {
    return NextResponse.json({ error: 'Failed to create columns' }, { status: 500 });
  }

  const todoColumn = createdColumns.find(c => c.title === 'To Do');
  if (!todoColumn) {
    return NextResponse.json({ error: 'Column setup failed' }, { status: 500 });
  }

  // Create the welcome card
  const description = `<p>Welcome to Lumio, ${trimmedName}! 👋 This is your personal board — a good place to get oriented. Work through the checklist below to get comfortable with the app.</p>`;

  const today = new Date().toISOString().slice(0, 10);

  const { data: card, error: cardError } = await supabaseAdmin
    .from('board_cards')
    .insert({
      board_id: board.id,
      column_id: todoColumn.id,
      title: 'Getting Started with Lumio',
      description,
      position: 0,
      created_by: user.id,
      due_date: today,
    })
    .select('id')
    .single();

  if (cardError || !card) {
    return NextResponse.json({ error: 'Failed to create welcome card' }, { status: 500 });
  }

  // Create checklist items on the welcome card
  const checklistItems = [
    { title: 'Set your display name', is_completed: true, position: 0 },
    { title: 'Create your first board', is_completed: true, position: 1 },
    { title: 'Add a card to a board', is_completed: false, position: 2 },
    { title: 'Watch a card you care about', is_completed: false, position: 3 },
    { title: 'Check your Focus view for daily priorities', is_completed: false, position: 4 },
    { title: 'Invite a teammate to collaborate', is_completed: false, position: 5 },
  ];

  await supabaseAdmin
    .from('card_checklists')
    .insert(checklistItems.map(item => ({ ...item, card_id: card.id })));

  return NextResponse.json({ ok: true, boardId: board.id });
}
