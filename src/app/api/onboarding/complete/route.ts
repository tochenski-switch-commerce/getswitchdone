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
      assignees: [user.id],
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

  // Second card: automations guide
  const automationDescription = `<p>Lumio can do the busywork for you. Automations fire when cards move or change — so your board stays organised without you having to touch it.</p><p><strong style="color:#eaf1ff;">Column automations</strong> — run whenever a card is dropped into a specific column. Use them to auto-mark cards complete when they hit Done, assign a priority, notify teammates, or even move completed subtasks to another column.</p><p><strong style="color:#eaf1ff;">Board automations</strong> — react to broader events across the whole board: move a card when it's completed, bump it to the top when a due date passes, or trigger an action the moment an assignee is added.</p>`;

  const { data: automationCard, error: automationCardError } = await supabaseAdmin
    .from('board_cards')
    .insert({
      board_id: board.id,
      column_id: todoColumn.id,
      title: 'Set Up Lists & Board Automations',
      description: automationDescription,
      position: 1,
      created_by: user.id,
      assignees: [user.id],
    })
    .select('id')
    .single();

  if (!automationCardError && automationCard) {
    const automationChecklist = [
      { title: 'Open a board and go to Settings → Automations', is_completed: false, position: 0 },
      { title: 'Add a column automation — e.g. mark complete when moved to Done', is_completed: false, position: 1 },
      { title: 'Add a board automation — e.g. move card to Done when completed', is_completed: false, position: 2 },
      { title: 'Move a card into that column and watch it fire', is_completed: false, position: 3 },
    ];
    await supabaseAdmin
      .from('card_checklists')
      .insert(automationChecklist.map(item => ({ ...item, card_id: automationCard.id })));
  }

  // Third card: teams guide
  const teamsDescription = `<p>Teams let you share boards with other people and collaborate in real time. Every team has its own workspace — members can see and work on all boards added to that team.</p><p><strong style="color:#eaf1ff;">Roles</strong> — each member gets a role: <strong style="color:#eaf1ff;">Owner</strong> (full control, can invite and remove), <strong style="color:#eaf1ff;">Editor</strong> (can add and edit cards), or <strong style="color:#eaf1ff;">Viewer</strong> (read-only). You can change roles or transfer ownership any time.</p><p><strong style="color:#eaf1ff;">Inviting people</strong> — share an invite link, paste an invite code, or send a direct invite email from the team page. Anyone who joins via the link lands straight in the team.</p>`;

  const { data: teamsCard, error: teamsCardError } = await supabaseAdmin
    .from('board_cards')
    .insert({
      board_id: board.id,
      column_id: todoColumn.id,
      title: 'Collaborate with Teams',
      description: teamsDescription,
      position: 2,
      created_by: user.id,
      assignees: [user.id],
    })
    .select('id')
    .single();

  if (!teamsCardError && teamsCard) {
    const teamsChecklist = [
      { title: 'Go to Teams and create your first team', is_completed: false, position: 0 },
      { title: 'Invite a teammate via email or invite link', is_completed: false, position: 1 },
      { title: 'Add a board to the team so everyone can access it', is_completed: false, position: 2 },
      { title: 'Set a member\'s role to Editor or Viewer', is_completed: false, position: 3 },
    ];
    await supabaseAdmin
      .from('card_checklists')
      .insert(teamsChecklist.map(item => ({ ...item, card_id: teamsCard.id })));
  }

  // Fourth card: forms guide
  const formsDescription = `<p>Forms let anyone submit a card to your board — no Lumio account required. Share the form link with clients, teammates, or embed it on a website, and submissions come straight in as cards.</p><p><strong style="color:#eaf1ff;">Custom fields</strong> — add text, dropdown, date, email, or number fields. Each field maps directly to a card property so nothing gets lost in translation.</p><p><strong style="color:#eaf1ff;">Auto-routing</strong> — choose which column new cards land in, set a default assignee, and apply labels automatically. Submissions arrive ready to work on.</p>`;

  const { data: formsCard, error: formsCardError } = await supabaseAdmin
    .from('board_cards')
    .insert({
      board_id: board.id,
      column_id: todoColumn.id,
      title: 'Capture Work with Forms',
      description: formsDescription,
      position: 3,
      created_by: user.id,
      assignees: [user.id],
    })
    .select('id')
    .single();

  if (!formsCardError && formsCard) {
    const formsChecklist = [
      { title: 'Open a board and go to Forms', is_completed: false, position: 0 },
      { title: 'Create a form and add a couple of custom fields', is_completed: false, position: 1 },
      { title: 'Set the target column and a default assignee', is_completed: false, position: 2 },
      { title: 'Copy the form link and submit a test entry', is_completed: false, position: 3 },
    ];
    await supabaseAdmin
      .from('card_checklists')
      .insert(formsChecklist.map(item => ({ ...item, card_id: formsCard.id })));
  }

  return NextResponse.json({ ok: true, boardId: board.id });
}
