'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { setBadgeCount, clearBadge } from '@/lib/badge';

// Fast cached user lookup — reads from local session instead of making
// a network request like supabase.auth.getUser() does every time.
async function getCachedUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}
import type {
  ProjectBoard,
  BoardColumn,
  ColumnType,
  BoardCard,
  BoardLabel,
  CardComment,
  CommentReaction,
  CardChecklist,
  CardChecklistGroup,
  CardPriority,
  ChecklistTemplate,
  UserProfile,
  Notification,
  NotificationType,
  BoardCustomField,
  CardCustomFieldValue,
  BoardEmail,
  BoardLink,
  BoardSummaryStats,
  CardLink,
  TemplateData,
} from '@/types/board-types';

// ── Full board shape ──
export interface FullBoard extends ProjectBoard {
  columns: BoardColumn[];
  cards: BoardCard[];
  labels: BoardLabel[];
  customFields: BoardCustomField[];
  boardLinks: BoardLink[];
  boardLinkStats: BoardSummaryStats[];
}

// ── Default columns & labels for new boards ──
const DEFAULT_COLUMNS = [
  { title: 'To Do', position: 0, color: '#6366f1' },
  { title: 'In Progress', position: 1, color: '#f59e0b' },
  { title: 'Review', position: 2, color: '#8b5cf6' },
  { title: 'Done', position: 3, color: '#22c55e' },
];

const DEFAULT_LABELS = [
  { name: 'Bug', color: '#ef4444' },
  { name: 'Feature', color: '#3b82f6' },
  { name: 'Enhancement', color: '#8b5cf6' },
  { name: 'Urgent', color: '#f97316' },
];

// ── Board fetch result ────────────────────────────────────────
interface BoardFetchResult {
  fullBoard: FullBoard;
  profiles: UserProfile[];
  boardMembersResult: UserProfile[];
}

// Module-level promise cache — fetchBoard awaits these when present,
// turning hover-prefetches into zero-wait board navigations.
const _prefetchPromises = new Map<string, Promise<BoardFetchResult | null>>();

// Pure async fetch+stitch — no React state. Used by both fetchBoard and prefetchBoard.
async function _fetchBoardData(boardId: string): Promise<BoardFetchResult | null> {
  // Phase 1: board-scoped data (profiles fetched later, filtered to actual users)
  const [boardRes, colsRes, cardsRes, labelsRes, customFieldsRes, boardLinksRes] = await Promise.all([
    supabase.from('project_boards').select('*').eq('id', boardId).single(),
    supabase.from('board_columns').select('*').eq('board_id', boardId).order('position'),
    supabase.from('board_cards').select('*').eq('board_id', boardId).eq('is_archived', false).order('position'),
    supabase.from('board_labels').select('*').eq('board_id', boardId),
    supabase.from('board_custom_fields').select('*').eq('board_id', boardId).order('position'),
    supabase.from('board_links').select('*, target_board:project_boards!target_board_id(id, title, icon, icon_color, is_public)').eq('board_id', boardId).order('position'),
  ]);

  if (boardRes.error) throw boardRes.error;

  const columns = colsRes.data || [];
  const labels = labelsRes.data || [];
  const customFields = (customFieldsRes.data || []) as BoardCustomField[];
  const labelById = new Map(labels.map(l => [l.id, l]));
  const boardLinks = ((boardLinksRes.data || []) as any[]).map(l => ({
    ...l,
    target_board: Array.isArray(l.target_board) ? l.target_board[0] : l.target_board,
  })) as BoardLink[];

  // Phase 2: card-scoped data + team members (parallel)
  // team_members moved here from serial post-Phase-2 to save a round trip
  // card_links removed — fetched lazily on card open via fetchCardDetail
  const cardIds = (cardsRes.data || []).map(c => c.id);
  const targetBoardIds = boardLinks.map(l => l.target_board_id);
  const phase2: PromiseLike<any>[] = [
    targetBoardIds.length > 0
      ? Promise.resolve(supabase.rpc('get_board_summary_stats', { board_ids: targetBoardIds }))
      : Promise.resolve({ data: [] }),
    // team_members always at index [1] — resolves empty if solo board
    boardRes.data.team_id
      ? supabase.from('team_members').select('user_id').eq('team_id', boardRes.data.team_id)
      : Promise.resolve({ data: [] }),
  ];

  let allComments: any[] = [];
  let allChecklists: any[] = [];
  let allChecklistGroups: CardChecklistGroup[] = [];
  let allAssignments: any[] = [];
  let allCfValues: CardCustomFieldValue[] = [];

  if (cardIds.length > 0) {
    phase2.push(
      supabase.from('card_comments').select('*, reactions:comment_reactions(*)').in('card_id', cardIds).order('created_at', { ascending: true }),
      supabase.from('card_checklists').select('*').in('card_id', cardIds).order('position'),
      supabase.from('card_checklist_groups').select('*').in('card_id', cardIds).order('position'),
      supabase.from('card_label_assignments').select('*').in('card_id', cardIds),
      supabase.from('card_custom_field_values').select('*').in('card_id', cardIds),
    );
  }

  const phase2Results = await Promise.all(phase2);
  const boardLinkStats = (phase2Results[0]?.data || []) as BoardSummaryStats[];
  const teamMembersData = (phase2Results[1]?.data || []) as { user_id: string }[];

  if (cardIds.length > 0) {
    // Indices: [0]=boardLinkStats, [1]=teamMembers, [2]=comments, [3]=checklists, [4]=checklistGroups, [5]=assignments, [6]=cfValues
    const [, , commentsRes, checklistsRes, checklistGroupsRes, assignmentsRes, cfValuesRes] = phase2Results;
    allComments = commentsRes.data || [];
    allChecklists = checklistsRes.data || [];
    allChecklistGroups = (checklistGroupsRes.data || []) as CardChecklistGroup[];
    allAssignments = assignmentsRes.data || [];
    allCfValues = (cfValuesRes.data || []) as CardCustomFieldValue[];
  }

  // Phase 3: fetch only the user profiles we actually need (replaces full table scan)
  // Collect every user ID referenced in this board's data
  const isUUID = (s: any) => typeof s === 'string' && s.length === 36;
  const userIdSet = new Set<string>([
    boardRes.data.user_id,
    ...(cardsRes.data || []).map((c: any) => c.created_by).filter(isUUID),
    ...(cardsRes.data || []).map((c: any) => c.assignee).filter(isUUID),
    ...(cardsRes.data || []).flatMap((c: any) => c.assignees || []).filter(isUUID),
    ...teamMembersData.map(m => m.user_id),
    ...allComments.map((cm: any) => cm.user_id).filter(isUUID),
    ...allComments.flatMap((cm: any) => (cm.reactions || []).map((r: any) => r.user_id)).filter(isUUID),
  ]);
  const { data: profilesRaw } = await supabase
    .from('user_profiles')
    .select('id, name, updated_at')
    .in('id', [...userIdSet]);
  const profiles = (profilesRaw || []) as UserProfile[];
  const profileById = new Map(profiles.map(p => [p.id, p]));

  // Enrich comments with profile names (profileById now available)
  const enrichedComments = allComments.map((cm: any) => ({
    ...cm,
    user_profiles: { name: profileById.get(cm.user_id)?.name ?? 'Unknown' },
    reactions: (cm.reactions || []).map((r: any) => ({
      ...r,
      user_profiles: { name: profileById.get(r.user_id)?.name ?? 'Unknown' },
    })),
  }));

  // Build O(1) lookup maps for card stitching
  const commentsByCard = new Map<string, any[]>();
  const checklistsByCard = new Map<string, any[]>();
  const checklistGroupsByCard = new Map<string, CardChecklistGroup[]>();
  const assignmentsByCard = new Map<string, any[]>();
  const cfValuesByCard = new Map<string, CardCustomFieldValue[]>();

  for (const cm of enrichedComments) {
    const arr = commentsByCard.get(cm.card_id) ?? []; arr.push(cm); commentsByCard.set(cm.card_id, arr);
  }
  for (const cl of allChecklists) {
    const arr = checklistsByCard.get(cl.card_id) ?? []; arr.push(cl); checklistsByCard.set(cl.card_id, arr);
  }
  for (const g of allChecklistGroups) {
    const arr = checklistGroupsByCard.get(g.card_id) ?? []; arr.push(g); checklistGroupsByCard.set(g.card_id, arr);
  }
  for (const a of allAssignments) {
    const arr = assignmentsByCard.get(a.card_id) ?? []; arr.push(a); assignmentsByCard.set(a.card_id, arr);
  }
  for (const v of allCfValues) {
    const arr = cfValuesByCard.get(v.card_id) ?? []; arr.push(v); cfValuesByCard.set(v.card_id, arr);
  }

  const cards = (cardsRes.data || []).map(card => ({
    ...card,
    comments: commentsByCard.get(card.id) ?? [],
    checklist_groups: checklistGroupsByCard.get(card.id) ?? [],
    checklists: checklistsByCard.get(card.id) ?? [],
    labels: (assignmentsByCard.get(card.id) ?? []).map((a: any) => labelById.get(a.label_id)).filter(Boolean),
    custom_field_values: cfValuesByCard.get(card.id) ?? [],
    card_links: [],  // loaded lazily on card open via fetchCardDetail
  }));

  const fullBoard: FullBoard = { ...boardRes.data, columns, cards, labels, customFields, boardLinks, boardLinkStats };

  // Board members derived from teamMembersData (already fetched in Phase 2)
  const memberIdSet = new Set(teamMembersData.map(m => m.user_id));
  const boardMembersResult: UserProfile[] = fullBoard.team_id
    ? profiles.filter(p => memberIdSet.has(p.id))
    : (profileById.get(fullBoard.user_id) ? [profileById.get(fullBoard.user_id)!] : []);

  return { fullBoard, profiles, boardMembersResult };
}

// Kick off a background fetch so fetchBoard can reuse it when the user clicks.
// Call this on hover of any cross-board navigation target.
export function prefetchBoard(boardId: string): void {
  if (_prefetchPromises.has(boardId)) return; // already in flight
  const p = _fetchBoardData(boardId);
  _prefetchPromises.set(boardId, p);
  // Auto-expire after 60 s so stale prefetches don't linger in memory
  p.finally(() => setTimeout(() => _prefetchPromises.delete(boardId), 300_000));
}

// ── Hook ──
export function useProjectBoard() {
  const [boards, setBoards] = useState<ProjectBoard[]>([]);
  const [board, setBoard] = useState<FullBoard | null>(null);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [boardMembers, setBoardMembers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [boardEmails, setBoardEmails] = useState<BoardEmail[]>([]);
  const [unroutedEmails, setUnroutedEmails] = useState<BoardEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, name, avatar_url, updated_at')
      .order('name');
    if (data) setUserProfiles(data as UserProfile[]);
  }, []);

  // ─── Board list ────────────────────────────────────────────
  const fetchBoards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');

      // RLS policies handle visibility (own boards + public boards)
      // Exclude `notes` — it's a large text field not needed for board listing
      const { data, error: err } = await supabase
        .from('project_boards')
        .select('id, user_id, title, description, icon, icon_color, is_archived, is_public, timezone, team_id, is_starred, automations, created_at, updated_at')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setBoards(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createBoard = useCallback(async (title: string, description?: string, icon?: string, icon_color?: string, team_id?: string) => {
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');

      // Create board
      const { data: boardData, error: boardErr } = await supabase
        .from('project_boards')
        .insert([{ title: title.trim(), description: description?.trim() || null, icon: icon || null, icon_color: icon_color || null, user_id: user.id, team_id: team_id || null }])
        .select()
        .single();
      if (boardErr) throw boardErr;

      // Create default columns
      const cols = DEFAULT_COLUMNS.map(c => ({ ...c, board_id: boardData.id }));
      await supabase.from('board_columns').insert(cols);

      // Create default labels
      const labels = DEFAULT_LABELS.map(l => ({ ...l, board_id: boardData.id }));
      await supabase.from('board_labels').insert(labels);

      setBoards(prev => [boardData, ...prev]);
      return boardData as ProjectBoard;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const createBoardFromTemplate = useCallback(async (
    title: string,
    templateData: TemplateData,
    description?: string,
    icon?: string,
    icon_color?: string,
    team_id?: string,
  ) => {
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');

      // Create board
      const { data: boardData, error: boardErr } = await supabase
        .from('project_boards')
        .insert([{ title: title.trim(), description: description?.trim() || null, icon: icon || null, icon_color: icon_color || null, user_id: user.id, team_id: team_id || null }])
        .select()
        .single();
      if (boardErr) throw boardErr;

      const boardId = boardData.id;

      // Insert columns from template
      const cols = templateData.columns.map(c => ({
        board_id: boardId,
        title: c.title,
        color: c.color,
        position: c.position,
        automations: c.automations,
      }));
      await supabase.from('board_columns').insert(cols);

      // Insert labels from template
      if (templateData.labels.length > 0) {
        const labels = templateData.labels.map(l => ({ board_id: boardId, name: l.name, color: l.color }));
        await supabase.from('board_labels').insert(labels);
      }

      // Insert custom fields from template
      if (templateData.custom_fields.length > 0) {
        const fields = templateData.custom_fields.map(f => ({
          board_id: boardId,
          title: f.name,
          field_type: f.field_type,
          options: f.options,
          position: f.position,
        }));
        await supabase.from('board_custom_fields').insert(fields);
      }

      // Insert checklist templates from template
      if (templateData.checklist_templates.length > 0) {
        const checklists = templateData.checklist_templates.map(ct => ({
          user_id: user.id,
          board_id: boardId,
          name: ct.name,
          items: ct.items,
        }));
        await supabase.from('checklist_templates').insert(checklists);
      }

      // Insert sample cards if present (look up column ids by position)
      if (templateData.sample_cards.length > 0) {
        const { data: createdCols } = await supabase
          .from('board_columns')
          .select('id, position')
          .eq('board_id', boardId);

        if (createdCols && createdCols.length > 0) {
          const colByPosition = new Map(createdCols.map(c => [c.position, c.id]));
          const cards = templateData.sample_cards
            .map((sc, i) => {
              const colId = colByPosition.get(sc.column_position);
              if (!colId) return null;
              return {
                board_id: boardId,
                column_id: colId,
                title: sc.title,
                description: sc.description || null,
                position: i,
                priority: sc.priority ?? null,
              };
            })
            .filter(Boolean);
          if (cards.length > 0) {
            await supabase.from('board_cards').insert(cards);
          }
        }
      }

      setBoards(prev => [boardData, ...prev]);
      return boardData as ProjectBoard;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  // ─── Single board ──────────────────────────────────────────
  const fetchBoard = useCallback(async (boardId: string, background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      // Background refreshes (triggered by realtime events) must always fetch fresh —
      // using a stale prefetch snapshot would overwrite local state with old data
      // (e.g. labels set by an automation would disappear if the prefetch predates them).
      // Only use the prefetch cache for foreground loads (user navigating to the board).
      let result: BoardFetchResult | null;
      if (!background) {
        const pending = _prefetchPromises.get(boardId);
        _prefetchPromises.delete(boardId);
        const prefetched = pending ? await pending.catch(() => null) : null;
        result = prefetched ?? await _fetchBoardData(boardId);
      } else {
        result = await _fetchBoardData(boardId);
      }
      if (!result) return null;
      setBoard(result.fullBoard);
      setUserProfiles(result.profiles);
      setBoardMembers(result.boardMembersResult);
      return result.fullBoard;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  const toggleBoardStar = useCallback(async (boardId: string) => {
    // Read current value from single board state (detail page) or boards list
    const current =
      (board?.id === boardId ? board?.is_starred : undefined) ??
      boards.find(b => b.id === boardId)?.is_starred ??
      false;
    const next = !current;
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, is_starred: next } : b));
    setBoard(prev => prev?.id === boardId ? { ...prev, is_starred: next } : prev);
    // Must await — Supabase query builder is lazy and won't fire without it
    await supabase.from('project_boards').update({ is_starred: next }).eq('id', boardId);
  }, [board, boards]);

  const updateBoard = useCallback(async (boardId: string, updates: Partial<ProjectBoard>) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('project_boards')
        .update(updates)
        .eq('id', boardId)
        .select()
        .single();
      if (err) throw err;
      setBoard(prev => prev ? { ...prev, ...data } : prev);
      return data;
    } catch (err: any) {
      console.error('updateBoard failed:', err.message, 'updates:', updates);
      setError(err.message);
      return null;
    }
  }, []);

  const deleteBoard = useCallback(async (boardId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('project_boards')
        .delete()
        .eq('id', boardId);
      if (err) throw err;
      setBoards(prev => prev.filter(b => b.id !== boardId));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const duplicateBoard = useCallback(async (boardId: string) => {
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch source board and related data in parallel
      const [boardRes, colsRes, labelsRes, customFieldsRes, formsRes] = await Promise.all([
        supabase.from('project_boards').select('*').eq('id', boardId).single(),
        supabase.from('board_columns').select('*').eq('board_id', boardId).order('position'),
        supabase.from('board_labels').select('*').eq('board_id', boardId),
        supabase.from('board_custom_fields').select('*').eq('board_id', boardId).order('position'),
        supabase.from('board_forms').select('*').eq('board_id', boardId),
      ]);
      if (boardRes.error) throw boardRes.error;
      const src = boardRes.data;

      // Create new board
      const { data: newBoard, error: boardErr } = await supabase
        .from('project_boards')
        .insert([{
          title: `${src.title} (Copy)`,
          description: src.description,
          notes: src.notes,
          icon: src.icon,
          icon_color: src.icon_color,
          is_public: false,
          user_id: user.id,
        }])
        .select()
        .single();
      if (boardErr) throw boardErr;

      // Duplicate columns — build old→new id map
      const colMap = new Map<string, string>();
      const srcCols = colsRes.data || [];
      if (srcCols.length > 0) {
        const { data: newCols, error: colErr } = await supabase
          .from('board_columns')
          .insert(srcCols.map(c => ({ board_id: newBoard.id, title: c.title, position: c.position, color: c.color, column_type: c.column_type || 'normal' })))
          .select();
        if (colErr) throw colErr;
        // Map by position (insert order = position order)
        const sorted = [...(newCols || [])].sort((a, b) => a.position - b.position);
        srcCols.sort((a, b) => a.position - b.position);
        srcCols.forEach((old, i) => colMap.set(old.id, sorted[i].id));
      }

      // Duplicate labels
      const srcLabels = labelsRes.data || [];
      if (srcLabels.length > 0) {
        await supabase
          .from('board_labels')
          .insert(srcLabels.map(l => ({ board_id: newBoard.id, name: l.name, color: l.color })));
      }

      // Duplicate custom fields
      const srcFields = customFieldsRes.data || [];
      if (srcFields.length > 0) {
        await supabase
          .from('board_custom_fields')
          .insert(srcFields.map(f => ({ board_id: newBoard.id, title: f.title, field_type: f.field_type, options: f.options, position: f.position })));
      }

      // Duplicate forms (with new unique slugs, remapped column_ids)
      const srcForms = formsRes.data || [];
      for (const form of srcForms) {
        const newColId = colMap.get(form.column_id);
        if (!newColId) continue; // skip if target column is missing
        const newSlug = `${form.slug}-copy-${Date.now().toString(36)}`;
        await supabase
          .from('board_forms')
          .insert([{
            user_id: user.id,
            board_id: newBoard.id,
            column_id: newColId,
            title: form.title,
            description: form.description,
            slug: newSlug,
            fields: form.fields,
            is_active: false,
          }]);
      }

      // Duplicate board links (remapped column_ids)
      const { data: srcLinks } = await supabase.from('board_links').select('*').eq('board_id', boardId).order('position');
      if (srcLinks && srcLinks.length > 0) {
        const newLinks = srcLinks
          .filter(l => colMap.has(l.column_id))
          .map(l => ({ board_id: newBoard.id, column_id: colMap.get(l.column_id)!, target_board_id: l.target_board_id, position: l.position }));
        if (newLinks.length > 0) {
          await supabase.from('board_links').insert(newLinks);
        }
      }

      setBoards(prev => [newBoard, ...prev]);
      return newBoard as ProjectBoard;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  // ─── Columns ───────────────────────────────────────────────
  const addColumn = useCallback(async (boardId: string, title: string, color?: string, columnType?: ColumnType) => {
    setError(null);
    try {
      // Determine next position
      const maxPos = board?.columns.reduce((m, c) => Math.max(m, c.position), -1) ?? -1;
      const { data, error: err } = await supabase
        .from('board_columns')
        .insert([{ board_id: boardId, title, position: maxPos + 1, color: color || '#6366f1', column_type: columnType || 'normal' }])
        .select()
        .single();
      if (err) throw err;
      setBoard(prev => prev ? { ...prev, columns: [...prev.columns, data] } : prev);
      return data as BoardColumn;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [board?.columns]);

  const updateColumn = useCallback(async (boardId: string, colId: string, updates: Partial<BoardColumn>) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('board_columns')
        .update(updates)
        .eq('id', colId)
        .select()
        .single();
      if (err) throw err;
      setBoard(prev => prev ? {
        ...prev,
        columns: prev.columns.map(c => c.id === colId ? { ...c, ...data } : c),
      } : prev);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const deleteColumn = useCallback(async (boardId: string, colId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('board_columns')
        .delete()
        .eq('id', colId);
      if (err) throw err;
      setBoard(prev => prev ? {
        ...prev,
        columns: prev.columns.filter(c => c.id !== colId),
        cards: prev.cards.filter(c => c.column_id !== colId),
        boardLinks: prev.boardLinks.filter(l => l.column_id !== colId),
      } : prev);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const reorderColumns = useCallback(async (boardId: string, columnOrder: { id: string; position: number }[]) => {
    setError(null);
    // Optimistic update
    setBoard(prev => {
      if (!prev) return prev;
      const updated = prev.columns.map(c => {
        const order = columnOrder.find(o => o.id === c.id);
        return order ? { ...c, position: order.position } : c;
      });
      updated.sort((a, b) => a.position - b.position);
      return { ...prev, columns: updated };
    });
    try {
      // Batch update positions
      await Promise.all(
        columnOrder.map(({ id, position }) =>
          supabase.from('board_columns').update({ position }).eq('id', id)
        )
      );
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // ─── Cards ─────────────────────────────────────────────────
  const addCard = useCallback(async (boardId: string, data: {
    column_id: string;
    title: string;
    description?: string;
    priority?: CardPriority | null;
    start_date?: string;
    due_date?: string;
    due_time?: string | null;
    assignee?: string;
    assignees?: string[];
    label_ids?: string[];
  }) => {
    setError(null);
    try {
      const user = await getCachedUser();

      // Determine next position in column
      const colCards = board?.cards.filter(c => c.column_id === data.column_id) || [];
      const maxPos = colCards.reduce((m, c) => Math.max(m, c.position), -1);

      const { label_ids, ...cardFields } = data;
      const { data: card, error: err } = await supabase
        .from('board_cards')
        .insert([{
          ...cardFields,
          board_id: boardId,
          position: maxPos + 1,
          created_by: user?.id || null,
        }])
        .select()
        .single();
      if (err) throw err;

      // Assign labels if provided
      if (label_ids?.length) {
        const assignments = label_ids.map(lid => ({ card_id: card.id, label_id: lid }));
        await supabase.from('card_label_assignments').insert(assignments);
      }

      // Build full card locally
      const labelObjs = (board?.labels || []).filter(l => label_ids?.includes(l.id));
      const fullCard = { ...card, labels: labelObjs, comments: [], checklists: [] };
      setBoard(prev => prev ? { ...prev, cards: [...prev.cards, fullCard] } : prev);
      return fullCard as BoardCard;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [board?.cards, board?.labels]);

  const updateCard = useCallback(async (boardId: string, cardId: string, updates: Record<string, unknown> & { label_ids?: string[] }) => {
    setError(null);
    try {
      const { label_ids, ...cardUpdates } = updates;

      // Update card fields if any
      let cardData: Record<string, unknown> = {};
      if (Object.keys(cardUpdates).length > 0) {
        const { data, error: err } = await supabase
          .from('board_cards')
          .update(cardUpdates)
          .eq('id', cardId)
          .select()
          .single();
        if (err) throw err;
        cardData = data;
      }

      // Update label assignments if provided
      if (label_ids !== undefined) {
        // Remove existing assignments
        await supabase.from('card_label_assignments').delete().eq('card_id', cardId);
        // Add new ones
        if (label_ids.length > 0) {
          const assignments = label_ids.map((lid: string) => ({ card_id: cardId, label_id: lid }));
          await supabase.from('card_label_assignments').insert(assignments);
        }
      }

      setBoard(prev => {
        if (!prev) return prev;
        let updatedLabels: BoardLabel[] | undefined;
        if (label_ids !== undefined) {
          updatedLabels = prev.labels.filter(l => label_ids.includes(l.id));
        }
        return {
          ...prev,
          cards: prev.cards.map(c => {
            if (c.id !== cardId) return c;
            return {
              ...c,
              ...cardData,
              labels: updatedLabels !== undefined ? updatedLabels : c.labels,
              comments: c.comments,
              checklists: c.checklists,
            };
          }),
        };
      });
      return cardData;
    } catch (err: any) {
      console.error('[updateCard] failed:', err.message, { boardId, cardId, updates });
      setError(err.message);
      return null;
    }
  }, []);

  const deleteCard = useCallback(async (boardId: string, cardId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('board_cards')
        .delete()
        .eq('id', cardId);
      if (err) throw err;
      setBoard(prev => prev ? { ...prev, cards: prev.cards.filter(c => c.id !== cardId) } : prev);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const moveCard = useCallback(async (boardId: string, cardId: string, newColumnId: string, newPosition: number) => {
    setError(null);
    // Optimistic
    setBoard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(c =>
          c.id === cardId ? { ...c, column_id: newColumnId, position: newPosition } : c
        ),
      };
    });
    try {
      const { error: err } = await supabase
        .from('board_cards')
        .update({ column_id: newColumnId, position: newPosition })
        .eq('id', cardId);
      if (err) throw err;
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const reorderCardsInColumn = useCallback(async (boardId: string, columnId: string, cardIds: string[]) => {
    setError(null);
    // Optimistic
    setBoard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(c => {
          const idx = cardIds.indexOf(c.id);
          if (idx !== -1) return { ...c, column_id: columnId, position: idx };
          return c;
        }),
      };
    });
    try {
      const updates = cardIds.map((id, idx) =>
        supabase.from('board_cards').update({ column_id: columnId, position: idx }).eq('id', id)
      );
      await Promise.all(updates);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // ─── Comments ──────────────────────────────────────────────
  const addComment = useCallback(async (boardId: string, cardId: string, content: string) => {
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: err } = await supabase
        .from('card_comments')
        .insert([{ card_id: cardId, user_id: user.id, content }])
        .select('*')
        .single();
      if (err) throw err;

      // Attach user profile name from local state instead of relying on PostgREST join
      const profile = userProfiles.find(p => p.id === user.id);
      const commentWithProfile = {
        ...data,
        user_profiles: profile ? { name: profile.name } : { name: user.email || 'Unknown' },
      };

      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c =>
            c.id === cardId ? { ...c, comments: [...(c.comments || []), commentWithProfile] } : c
          ),
        };
      });
      return commentWithProfile as CardComment;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [userProfiles]);

  const editComment = useCallback(async (boardId: string, cardId: string, commentId: string, content: string) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('card_comments')
        .update({ content })
        .eq('id', commentId)
        .select('*')
        .single();
      if (err) throw err;

      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c =>
            c.id === cardId
              ? { ...c, comments: (c.comments || []).map(cm => cm.id === commentId ? { ...cm, content: data.content, updated_at: data.updated_at } : cm) }
              : c
          ),
        };
      });
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const deleteComment = useCallback(async (boardId: string, cardId: string, commentId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('card_comments')
        .delete()
        .eq('id', commentId);
      if (err) throw err;

      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c =>
            c.id === cardId
              ? { ...c, comments: (c.comments || []).filter(cm => cm.id !== commentId) }
              : c
          ),
        };
      });
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  // reaction_type: 'like' | 'dislike'. Calling with the same type the user already has toggles it off.
  const reactToComment = useCallback(async (boardId: string, cardId: string, commentId: string, reactionType: 'like' | 'dislike') => {
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');

      const card = board?.cards.find(c => c.id === cardId);
      const comment = card?.comments?.find(cm => cm.id === commentId);
      const existing = (comment?.reactions || []).find((r: CommentReaction) => r.user_id === user.id);

      if (existing) {
        // Same reaction → remove it (toggle off); different → remove old and insert new
        await supabase.from('comment_reactions').delete().eq('comment_id', commentId).eq('user_id', user.id);
        if (existing.reaction_type === reactionType) {
          // toggle off
          setBoard(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              cards: prev.cards.map(c =>
                c.id === cardId
                  ? { ...c, comments: (c.comments || []).map(cm =>
                      cm.id === commentId
                        ? { ...cm, reactions: (cm.reactions || []).filter((r: CommentReaction) => r.user_id !== user.id) }
                        : cm
                    ) }
                  : c
              ),
            };
          });
          return null;
        }
        // switching reaction — fall through to insert new one below
      }

      const profile = userProfiles.find(p => p.id === user.id);
      const { data, error: err } = await supabase
        .from('comment_reactions')
        .insert([{ comment_id: commentId, user_id: user.id, reaction_type: reactionType }])
        .select('*')
        .single();
      if (err) throw err;

      const reactionWithProfile: CommentReaction = {
        ...data,
        user_profiles: { name: profile?.name ?? user.email ?? 'Unknown' },
      };

      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c =>
            c.id === cardId
              ? { ...c, comments: (c.comments || []).map(cm =>
                  cm.id === commentId
                    ? { ...cm, reactions: [
                        ...(cm.reactions || []).filter((r: CommentReaction) => r.user_id !== user.id),
                        reactionWithProfile,
                      ] }
                    : cm
                ) }
              : c
          ),
        };
      });
      return reactionWithProfile;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [board, userProfiles]);

  // ─── Checklist Groups ───────────────────────────────────────
  const addChecklistGroup = useCallback(async (boardId: string, cardId: string, name: string) => {
    setError(null);
    try {
      const existing = board?.cards.find(c => c.id === cardId)?.checklist_groups || [];
      const maxPos = existing.reduce((m: number, g: any) => Math.max(m, g.position), -1);
      const { data, error: err } = await supabase
        .from('card_checklist_groups')
        .insert([{ card_id: cardId, name, position: maxPos + 1 }])
        .select()
        .single();
      if (err) throw err;
      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c =>
            c.id === cardId
              ? { ...c, checklist_groups: [...(c.checklist_groups || []), data] }
              : c
          ),
        };
      });
      return data as CardChecklistGroup;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [board?.cards]);

  const updateChecklistGroup = useCallback(async (boardId: string, cardId: string, groupId: string, name: string) => {
    setError(null);
    setBoard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(c =>
          c.id === cardId
            ? { ...c, checklist_groups: (c.checklist_groups || []).map(g => g.id === groupId ? { ...g, name } : g) }
            : c
        ),
      };
    });
    try {
      const { error: err } = await supabase
        .from('card_checklist_groups')
        .update({ name })
        .eq('id', groupId);
      if (err) throw err;
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const deleteChecklistGroup = useCallback(async (boardId: string, cardId: string, groupId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('card_checklist_groups')
        .delete()
        .eq('id', groupId);
      if (err) throw err;
      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c =>
            c.id === cardId
              ? {
                  ...c,
                  checklist_groups: (c.checklist_groups || []).filter(g => g.id !== groupId),
                  checklists: (c.checklists || []).filter(cl => cl.group_id !== groupId),
                }
              : c
          ),
        };
      });
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // ─── Checklists ────────────────────────────────────────────
  const addChecklistItem = useCallback(async (boardId: string, cardId: string, title: string, groupId?: string | null) => {
    setError(null);
    try {
      // Determine next position within the group (or globally if no group)
      const existing = board?.cards.find(c => c.id === cardId)?.checklists || [];
      const scopedItems = groupId ? existing.filter((cl: any) => cl.group_id === groupId) : existing;
      const maxPos = scopedItems.reduce((m: number, cl: any) => Math.max(m, cl.position), -1);

      const row: any = { card_id: cardId, title, position: maxPos + 1 };
      if (groupId) row.group_id = groupId;

      const { data, error: err } = await supabase
        .from('card_checklists')
        .insert([row])
        .select()
        .single();
      if (err) throw err;

      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c =>
            c.id === cardId ? { ...c, checklists: [...(c.checklists || []), data] } : c
          ),
        };
      });
      return data as CardChecklist;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [board?.cards]);

  const toggleChecklistItem = useCallback(async (boardId: string, cardId: string, itemId: string, isCompleted: boolean) => {
    setError(null);
    // Optimistic
    setBoard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(c =>
          c.id === cardId
            ? {
                ...c,
                checklists: (c.checklists || []).map(cl =>
                  cl.id === itemId ? { ...cl, is_completed: isCompleted } : cl
                ),
              }
            : c
        ),
      };
    });
    try {
      const { error: err } = await supabase
        .from('card_checklists')
        .update({ is_completed: isCompleted })
        .eq('id', itemId);
      if (err) throw err;
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const deleteChecklistItem = useCallback(async (boardId: string, cardId: string, itemId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('card_checklists')
        .delete()
        .eq('id', itemId);
      if (err) throw err;

      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c =>
            c.id === cardId
              ? { ...c, checklists: (c.checklists || []).filter(cl => cl.id !== itemId) }
              : c
          ),
        };
      });
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const updateChecklistItemAssignees = useCallback(async (boardId: string, cardId: string, itemId: string, assignees: string[]) => {
    setError(null);
    // Optimistic
    setBoard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(c =>
          c.id === cardId
            ? {
                ...c,
                checklists: (c.checklists || []).map(cl =>
                  cl.id === itemId ? { ...cl, assignees } : cl
                ),
              }
            : c
        ),
      };
    });
    try {
      const { error: err } = await supabase
        .from('card_checklists')
        .update({ assignees })
        .eq('id', itemId);
      if (err) throw err;
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const editChecklistItem = useCallback(async (boardId: string, cardId: string, itemId: string, title: string) => {
    setError(null);
    setBoard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(c =>
          c.id === cardId
            ? { ...c, checklists: (c.checklists || []).map(cl => cl.id === itemId ? { ...cl, title } : cl) }
            : c
        ),
      };
    });
    try {
      const { error: err } = await supabase.from('card_checklists').update({ title }).eq('id', itemId);
      if (err) throw err;
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const updateChecklistItemDueDate = useCallback(async (boardId: string, cardId: string, itemId: string, dueDate: string | null) => {
    setError(null);
    // Optimistic
    setBoard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(c =>
          c.id === cardId
            ? {
                ...c,
                checklists: (c.checklists || []).map(cl =>
                  cl.id === itemId ? { ...cl, due_date: dueDate } : cl
                ),
              }
            : c
        ),
      };
    });
    try {
      const { error: err } = await supabase
        .from('card_checklists')
        .update({ due_date: dueDate })
        .eq('id', itemId);
      if (err) throw err;
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const reorderChecklistItems = useCallback(async (boardId: string, cardId: string, orderedIds: string[]) => {
    setBoard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(c => {
          if (c.id !== cardId) return c;
          const itemMap = new Map((c.checklists || []).map(cl => [cl.id, cl]));
          const reordered = orderedIds.map((id, idx) => ({ ...itemMap.get(id)!, position: idx }));
          const rest = (c.checklists || []).filter(cl => !orderedIds.includes(cl.id));
          return { ...c, checklists: [...reordered, ...rest] };
        }),
      };
    });
    await Promise.all(orderedIds.map((id, idx) =>
      supabase.from('card_checklists').update({ position: idx }).eq('id', id)
    ));
  }, []);

  // ─── Checklist Templates ────────────────────────────────────
  const fetchChecklistTemplates = useCallback(async (boardId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setChecklistTemplates(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const saveChecklistTemplate = useCallback(async (boardId: string, name: string, items: string[]) => {
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error: err } = await supabase
        .from('checklist_templates')
        .insert([{ board_id: boardId, user_id: user.id, name, items }])
        .select()
        .single();
      if (err) throw err;
      setChecklistTemplates(prev => [data, ...prev]);
      return data as ChecklistTemplate;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const deleteChecklistTemplate = useCallback(async (templateId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('checklist_templates')
        .delete()
        .eq('id', templateId);
      if (err) throw err;
      setChecklistTemplates(prev => prev.filter(t => t.id !== templateId));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const updateChecklistTemplate = useCallback(async (templateId: string, name: string, items: string[]) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('checklist_templates')
        .update({ name, items })
        .eq('id', templateId)
        .select()
        .single();
      if (err) throw err;
      setChecklistTemplates(prev => prev.map(t => t.id === templateId ? data : t));
      return data as ChecklistTemplate;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const applyChecklistTemplate = useCallback(async (boardId: string, cardId: string, templateId: string) => {
    setError(null);
    try {
      const template = checklistTemplates.find(t => t.id === templateId);
      if (!template) throw new Error('Template not found');

      // Create a new checklist group named after the template
      const existingGroups = board?.cards.find(c => c.id === cardId)?.checklist_groups || [];
      const maxGroupPos = existingGroups.reduce((m: number, g: any) => Math.max(m, g.position), -1);
      const { data: groupData, error: groupErr } = await supabase
        .from('card_checklist_groups')
        .insert([{ card_id: cardId, name: template.name, position: maxGroupPos + 1 }])
        .select()
        .single();
      if (groupErr) throw groupErr;

      // Insert items linked to the new group
      const rows = template.items.map((title: string, idx: number) => ({
        card_id: cardId,
        group_id: groupData.id,
        title,
        position: idx,
      }));
      const { data, error: err } = await supabase
        .from('card_checklists')
        .insert(rows)
        .select();
      if (err) throw err;

      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c =>
            c.id === cardId
              ? {
                  ...c,
                  checklist_groups: [...(c.checklist_groups || []), groupData],
                  checklists: [...(c.checklists || []), ...(data || [])],
                }
              : c
          ),
        };
      });
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [checklistTemplates, board?.cards]);

  // ─── Labels ────────────────────────────────────────────────
  const addLabel = useCallback(async (boardId: string, name: string, color: string) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('board_labels')
        .insert([{ board_id: boardId, name, color }])
        .select()
        .single();
      if (err) throw err;
      setBoard(prev => prev ? { ...prev, labels: [...prev.labels, data] } : prev);
      return data as BoardLabel;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const updateLabel = useCallback(async (boardId: string, labelId: string, updates: Partial<BoardLabel>) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('board_labels')
        .update(updates)
        .eq('id', labelId)
        .select()
        .single();
      if (err) throw err;
      setBoard(prev => prev ? {
        ...prev,
        labels: prev.labels.map(l => l.id === labelId ? { ...l, ...data } : l),
      } : prev);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const deleteLabel = useCallback(async (boardId: string, labelId: string) => {
    setError(null);
    try {
      // Remove assignments first
      await supabase.from('card_label_assignments').delete().eq('label_id', labelId);
      const { error: err } = await supabase.from('board_labels').delete().eq('id', labelId);
      if (err) throw err;

      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          labels: prev.labels.filter(l => l.id !== labelId),
          cards: prev.cards.map(c => ({
            ...c,
            labels: (c.labels || []).filter(l => l.id !== labelId),
          })),
        };
      });
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  // ─── Custom Fields ──────────────────────────────────────────
  const addCustomField = useCallback(async (boardId: string, title: string, fieldType: string, options?: string[]) => {
    setError(null);
    try {
      const maxPos = (board?.customFields || []).reduce((m, f) => Math.max(m, f.position), -1);
      const { data, error: err } = await supabase
        .from('board_custom_fields')
        .insert([{ board_id: boardId, title, field_type: fieldType, options: options || [], position: maxPos + 1 }])
        .select()
        .single();
      if (err) throw err;
      setBoard(prev => prev ? { ...prev, customFields: [...prev.customFields, data as BoardCustomField] } : prev);
      return data as BoardCustomField;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [board?.customFields]);

  const updateCustomField = useCallback(async (fieldId: string, updates: Partial<BoardCustomField>) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('board_custom_fields')
        .update(updates)
        .eq('id', fieldId)
        .select()
        .single();
      if (err) throw err;
      setBoard(prev => prev ? {
        ...prev,
        customFields: prev.customFields.map(f => f.id === fieldId ? { ...f, ...data } : f),
      } : prev);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const deleteCustomField = useCallback(async (fieldId: string) => {
    setError(null);
    try {
      // Values cascade-delete via FK
      const { error: err } = await supabase.from('board_custom_fields').delete().eq('id', fieldId);
      if (err) throw err;
      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          customFields: prev.customFields.filter(f => f.id !== fieldId),
          cards: prev.cards.map(c => ({
            ...c,
            custom_field_values: (c.custom_field_values || []).filter(v => v.field_id !== fieldId),
          })),
        };
      });
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const setCardCustomFieldValue = useCallback(async (cardId: string, fieldId: string, value?: string, multiValue?: string[]) => {
    setError(null);
    try {
      // Upsert: if exists update, else insert
      const { data: existing } = await supabase
        .from('card_custom_field_values')
        .select('id')
        .eq('card_id', cardId)
        .eq('field_id', fieldId)
        .maybeSingle();

      let result: any;
      if (existing) {
        const { data, error: err } = await supabase
          .from('card_custom_field_values')
          .update({ value: value ?? null, multi_value: multiValue || [] })
          .eq('id', existing.id)
          .select()
          .single();
        if (err) throw err;
        result = data;
      } else {
        const { data, error: err } = await supabase
          .from('card_custom_field_values')
          .insert([{ card_id: cardId, field_id: fieldId, value: value ?? null, multi_value: multiValue || [] }])
          .select()
          .single();
        if (err) throw err;
        result = data;
      }

      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c => {
            if (c.id !== cardId) return c;
            const vals = (c.custom_field_values || []).filter(v => v.field_id !== fieldId);
            return { ...c, custom_field_values: [...vals, result as CardCustomFieldValue] };
          }),
        };
      });
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  // ─── Notifications ──────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const user = await getCachedUser();
      if (!user) return;
      const { data, error: err } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (err) throw err;
      setNotifications(data || []);
      // Update app icon badge with unread count
      const unread = (data || []).filter((n: Notification) => !n.is_read).length;
      setBadgeCount(unread);
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err.message);
    }
  }, []);

  const createNotification = useCallback(async (params: {
    user_id: string;
    board_id?: string;
    card_id?: string;
    checklist_item_id?: string;
    type: NotificationType;
    title: string;
    body?: string;
  }) => {
    try {
      const { error: err } = await supabase
        .from('notifications')
        .insert([params]);
      if (err) throw err;
    } catch (err: any) {
      console.error('Failed to create notification:', err.message);
    }
  }, []);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    try {
      const { error: err } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (err) throw err;
      setNotifications(prev => {
        const updated = prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
        setBadgeCount(updated.filter(n => !n.is_read).length);
        return updated;
      });
    } catch (err: any) {
      console.error('Failed to mark notification read:', err.message);
    }
  }, []);

  const markCardNotificationsRead = useCallback(async (cardId: string) => {
    try {
      const user = await getCachedUser();
      if (!user) return;
      const { error: err } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .eq('is_read', false);
      if (err) throw err;
      setNotifications(prev => {
        const updated = prev.map(n => n.card_id === cardId && !n.is_read ? { ...n, is_read: true } : n);
        setBadgeCount(updated.filter(n => !n.is_read).length);
        return updated;
      });
    } catch (err: any) {
      console.error('Failed to mark card notifications read:', err.message);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      const user = await getCachedUser();
      if (!user) return;
      const { error: err } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (err) throw err;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      clearBadge();
    } catch (err: any) {
      console.error('Failed to mark all read:', err.message);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error: err } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      if (err) throw err;
      setNotifications(prev => {
        const updated = prev.filter(n => n.id !== notificationId);
        setBadgeCount(updated.filter(n => !n.is_read).length);
        return updated;
      });
    } catch (err: any) {
      console.error('Failed to delete notification:', err.message);
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      const user = await getCachedUser();
      if (!user) return;
      const { error: err } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
      if (err) throw err;
      setNotifications([]);
      clearBadge();
    } catch (err: any) {
      console.error('Failed to clear notifications:', err.message);
    }
  }, []);

  // ─── Board Emails ──────────────────────────────────────────
  const fetchBoardEmails = useCallback(async (boardId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('board_emails')
        .select('*')
        .eq('board_id', boardId)
        .order('received_at', { ascending: false });
      if (err) throw err;
      setBoardEmails((data || []) as BoardEmail[]);
    } catch (err: any) {
      console.error('Failed to fetch board emails:', err.message);
    }
  }, []);

  const fetchUnroutedEmails = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('board_emails')
        .select('*')
        .is('board_id', null)
        .order('received_at', { ascending: false });
      if (err) throw err;
      setUnroutedEmails((data || []) as BoardEmail[]);
    } catch (err: any) {
      console.error('Failed to fetch unrouted emails:', err.message);
    }
  }, []);

  const searchBoardEmails = useCallback(async (boardId: string | null, query: string): Promise<BoardEmail[]> => {
    try {
      let q = supabase
        .from('board_emails')
        .select('*');

      if (boardId) {
        q = q.eq('board_id', boardId);
      }

      // Use Postgres full-text search
      q = q.textSearch('fts', query, { type: 'plain', config: 'english' });
      q = q.order('received_at', { ascending: false }).limit(50);

      const { data, error: err } = await q;
      if (err) throw err;
      return (data || []) as BoardEmail[];
    } catch (err: any) {
      console.error('Failed to search emails:', err.message);
      return [];
    }
  }, []);

  const deleteBoardEmail = useCallback(async (emailId: string) => {
    try {
      const { error: err } = await supabase
        .from('board_emails')
        .delete()
        .eq('id', emailId);
      if (err) throw err;
      setBoardEmails(prev => prev.filter(e => e.id !== emailId));
      setUnroutedEmails(prev => prev.filter(e => e.id !== emailId));
    } catch (err: any) {
      console.error('Failed to delete email:', err.message);
    }
  }, []);

  const routeEmail = useCallback(async (emailId: string, boardId: string) => {
    try {
      const { error: err } = await supabase
        .from('board_emails')
        .update({ board_id: boardId })
        .eq('id', emailId);
      if (err) throw err;
      // Move from unrouted to board emails if we're viewing that board
      setUnroutedEmails(prev => {
        const email = prev.find(e => e.id === emailId);
        if (email) {
          const updated = { ...email, board_id: boardId };
          setBoardEmails(be => [updated, ...be]);
        }
        return prev.filter(e => e.id !== emailId);
      });
    } catch (err: any) {
      console.error('Failed to route email:', err.message);
    }
  }, []);

  // ─── Board Links ───────────────────────────────────────────
  const addBoardLink = useCallback(async (boardId: string, columnId: string, targetBoardId: string) => {
    setError(null);
    try {
      const maxPos = board?.boardLinks.filter(l => l.column_id === columnId).reduce((m, l) => Math.max(m, l.position), -1) ?? -1;
      const { data, error: err } = await supabase
        .from('board_links')
        .insert([{ board_id: boardId, column_id: columnId, target_board_id: targetBoardId, position: maxPos + 1 }])
        .select('*, target_board:project_boards!target_board_id(id, title, icon, icon_color, is_public)')
        .single();
      if (err) throw err;
      const link: BoardLink = { ...data, target_board: Array.isArray(data.target_board) ? data.target_board[0] : data.target_board };
      // Fetch stats for the newly linked board
      const { data: statsData } = await supabase.rpc('get_board_summary_stats', { board_ids: [targetBoardId] });
      const newStats = (statsData || []) as BoardSummaryStats[];
      setBoard(prev => prev ? {
        ...prev,
        boardLinks: [...prev.boardLinks, link],
        boardLinkStats: [...prev.boardLinkStats.filter(s => s.board_id !== targetBoardId), ...newStats],
      } : prev);
      return link;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [board?.boardLinks]);

  const removeBoardLink = useCallback(async (linkId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase.from('board_links').delete().eq('id', linkId);
      if (err) throw err;
      setBoard(prev => prev ? {
        ...prev,
        boardLinks: prev.boardLinks.filter(l => l.id !== linkId),
      } : prev);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const reorderBoardLinks = useCallback(async (columnId: string, orderedLinkIds: string[]) => {
    // Optimistic update
    setBoard(prev => {
      if (!prev) return prev;
      const updated = prev.boardLinks.map(l => {
        const idx = orderedLinkIds.indexOf(l.id);
        return idx >= 0 ? { ...l, position: idx } : l;
      });
      return { ...prev, boardLinks: updated };
    });
    try {
      await Promise.all(
        orderedLinkIds.map((id, position) =>
          supabase.from('board_links').update({ position }).eq('id', id)
        )
      );
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // ── Card Links ──

  const addCardLink = useCallback(async (sourceCardId: string, targetCardId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('card_links')
        .insert({ source_card_id: sourceCardId, target_card_id: targetCardId })
        .select('*, target_card:board_cards!target_card_id(id, title, board_id, column_id, is_archived)')
        .single();
      if (err) throw err;
      const link = {
        ...data,
        target_card: Array.isArray(data.target_card) ? data.target_card[0] : data.target_card,
      } as CardLink;
      // Also fetch source_card info for the reverse side
      const { data: srcCard } = await supabase
        .from('board_cards')
        .select('id, title, board_id, column_id, is_archived')
        .eq('id', sourceCardId)
        .single();
      if (srcCard) link.source_card = srcCard;
      setBoard(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c => {
            if (c.id === sourceCardId || c.id === targetCardId) {
              return { ...c, card_links: [...(c.card_links || []), link] };
            }
            return c;
          }),
        };
      });
      return link;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const removeCardLink = useCallback(async (linkId: string) => {
    // Find the link to know which cards to update
    let sourceId: string | undefined;
    let targetId: string | undefined;
    setBoard(prev => {
      if (!prev) return prev;
      for (const c of prev.cards) {
        const link = (c.card_links || []).find(l => l.id === linkId);
        if (link) { sourceId = link.source_card_id; targetId = link.target_card_id; break; }
      }
      return {
        ...prev,
        cards: prev.cards.map(c => ({
          ...c,
          card_links: (c.card_links || []).filter(l => l.id !== linkId),
        })),
      };
    });
    try {
      const { error: err } = await supabase.from('card_links').delete().eq('id', linkId);
      if (err) throw err;
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Apply a realtime payload directly to local board state without a full re-fetch.
  // Called by useRealtimeBoard for remote users' changes on common tables.
  // Falls back to no-op (caller will scheduleRefetch) for unhandled cases.
  const applyRealtimeEvent = useCallback((
    table: string,
    eventType: string,
    payload: { new?: Record<string, unknown>; old?: Record<string, unknown> },
  ) => {
    setBoard(prev => {
      if (!prev) return prev;
      const n = payload.new;
      const o = payload.old;

      switch (table) {
        case 'board_cards': {
          const boardIdField = (n?.board_id ?? o?.board_id) as string | undefined;
          if (boardIdField && boardIdField !== prev.id) return prev;
          if (eventType === 'DELETE') {
            const id = o?.id as string | undefined;
            if (!id) return prev;
            return { ...prev, cards: prev.cards.filter(c => c.id !== id) };
          }
          if (eventType === 'INSERT' && n) {
            if (prev.cards.some(c => c.id === n.id)) return prev;
            const card = { ...n, labels: [], comments: [], checklists: [], checklist_groups: [], custom_field_values: [], card_links: [] };
            return { ...prev, cards: [...prev.cards, card as any] };
          }
          if (eventType === 'UPDATE' && n) {
            return {
              ...prev,
              cards: prev.cards.map(c => {
                if (c.id !== n.id) return c;
                return { ...c, ...n, labels: c.labels, comments: c.comments, checklists: c.checklists, checklist_groups: c.checklist_groups, custom_field_values: c.custom_field_values, card_links: c.card_links };
              }),
            };
          }
          return prev;
        }

        case 'card_label_assignments': {
          if (eventType === 'INSERT' && n) {
            const cardId = n.card_id as string;
            const labelId = n.label_id as string;
            if (!cardId || !labelId) return prev;
            const label = prev.labels.find(l => l.id === labelId);
            if (!label) return prev;
            return {
              ...prev,
              cards: prev.cards.map(c => {
                if (c.id !== cardId) return c;
                if ((c.labels ?? []).some(l => l.id === labelId)) return c;
                return { ...c, labels: [...(c.labels ?? []), label] };
              }),
            };
          }
          if (eventType === 'DELETE' && o) {
            const cardId = o.card_id as string;
            const labelId = o.label_id as string;
            if (!cardId || !labelId) return prev;
            return {
              ...prev,
              cards: prev.cards.map(c => {
                if (c.id !== cardId) return c;
                return { ...c, labels: (c.labels ?? []).filter(l => l.id !== labelId) };
              }),
            };
          }
          return prev;
        }

        case 'card_checklists': {
          if (eventType === 'INSERT' && n?.card_id && n?.id) {
            return {
              ...prev,
              cards: prev.cards.map(c => {
                if (c.id !== n.card_id) return c;
                if ((c.checklists ?? []).some(ch => ch.id === n.id)) return c;
                return { ...c, checklists: [...(c.checklists ?? []), n as any] };
              }),
            };
          }
          if (eventType === 'UPDATE' && n?.id) {
            return {
              ...prev,
              cards: prev.cards.map(c => {
                if (!(c.checklists ?? []).some(ch => ch.id === n.id)) return c;
                return { ...c, checklists: (c.checklists ?? []).map(ch => ch.id === n.id ? { ...ch, ...n } : ch) };
              }),
            };
          }
          if (eventType === 'DELETE' && o?.id) {
            const id = o.id as string;
            return {
              ...prev,
              cards: prev.cards.map(c => ({
                ...c,
                checklists: (c.checklists ?? []).filter(ch => ch.id !== id),
              })),
            };
          }
          return prev;
        }

        case 'board_columns': {
          if (eventType === 'UPDATE' && n?.id) {
            return { ...prev, columns: prev.columns.map(c => c.id === n.id ? { ...c, ...n as any } : c) };
          }
          return prev;
        }

        case 'board_labels': {
          if (eventType === 'UPDATE' && n?.id) {
            return {
              ...prev,
              labels: prev.labels.map(l => l.id === n.id ? { ...l, ...n as any } : l),
              cards: prev.cards.map(c => ({
                ...c,
                labels: (c.labels ?? []).map(l => l.id === n.id ? { ...l, ...n as any } : l),
              })),
            };
          }
          return prev;
        }

        default:
          return prev;
      }
    });
  }, []);

  const searchCards = useCallback(async (boardId: string, query: string) => {
    const { data, error: err } = await supabase
      .from('board_cards')
      .select('id, title, board_id, column_id, is_archived')
      .eq('board_id', boardId)
      .eq('is_archived', false)
      .ilike('title', `%${query}%`)
      .limit(10);
    if (err) { setError(err.message); return []; }
    return data || [];
  }, []);

  // Lazily fetch card_links for a single card (called when the card detail modal opens).
  // card_links are omitted from the board load to save two joined queries on every navigation.
  const fetchCardDetail = useCallback(async (cardId: string) => {
    const [linksSourceRes, linksTargetRes] = await Promise.all([
      supabase.from('card_links').select('*, target_card:board_cards!target_card_id(id, title, board_id, column_id, is_archived)').eq('source_card_id', cardId),
      supabase.from('card_links').select('*, source_card:board_cards!source_card_id(id, title, board_id, column_id, is_archived)').eq('target_card_id', cardId),
    ]);
    const sourceLinks = ((linksSourceRes.data || []) as any[]).map(l => ({
      ...l,
      target_card: Array.isArray(l.target_card) ? l.target_card[0] : l.target_card,
    })) as CardLink[];
    const targetLinks = ((linksTargetRes.data || []) as any[]).map(l => ({
      ...l,
      source_card: Array.isArray(l.source_card) ? l.source_card[0] : l.source_card,
    })) as CardLink[];
    const linkMap = new Map<string, CardLink>();
    for (const l of [...sourceLinks, ...targetLinks]) linkMap.set(l.id, { ...linkMap.get(l.id), ...l });
    const card_links = Array.from(linkMap.values());
    setBoard(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map(c => c.id === cardId ? { ...c, card_links } : c),
      };
    });
  }, []);

  const archiveCard = useCallback(async (boardId: string, cardId: string, currentColumnId: string) => {
    setError(null);
    // Optimistic update — remove immediately so the UI feels instant
    setBoard(prev => {
      if (!prev) return prev;
      return { ...prev, cards: prev.cards.filter(c => c.id !== cardId) };
    });
    try {
      const { error: err } = await supabase
        .from('board_cards')
        .update({ is_archived: true })
        .eq('id', cardId);
      if (err) throw err;

      // Best-effort: save metadata columns (requires card_archive.sql migration)
      await supabase
        .from('board_cards')
        .update({ archived_at: new Date().toISOString(), pre_archive_column_id: currentColumnId })
        .eq('id', cardId);
    } catch (err: any) {
      console.error('[archiveCard] failed:', err.message);
      setError(err.message);
      // Rollback: reload the board so the card reappears
      setBoard(prev => prev);
    }
  }, []);

  const restoreCard = useCallback(async (boardId: string, cardId: string, targetColumnId: string) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('board_cards')
        .update({ is_archived: false, column_id: targetColumnId, position: 0 })
        .eq('id', cardId)
        .select()
        .single();
      if (err) throw err;

      // Best-effort: clear metadata columns (requires card_archive.sql migration)
      await supabase
        .from('board_cards')
        .update({ archived_at: null, pre_archive_column_id: null })
        .eq('id', cardId);

      // Fetch labels separately so we can show them immediately
      const { data: labelRows } = await supabase
        .from('card_label_assignments')
        .select('label:board_labels!label_id(*)')
        .eq('card_id', cardId);

      const restored: BoardCard = {
        ...data,
        labels: (labelRows || []).map((a: any) => a.label).filter(Boolean),
        comments: [],
        checklists: [],
      };

      setBoard(prev => {
        if (!prev) return prev;
        return { ...prev, cards: [restored, ...prev.cards] };
      });
    } catch (err: any) {
      console.error('[restoreCard] failed:', err.message);
      setError(err.message);
    }
  }, []);

  const fetchArchivedCards = useCallback(async (boardId: string): Promise<BoardCard[]> => {
    try {
      const { data, error: err } = await supabase
        .from('board_cards')
        .select('*')
        .eq('board_id', boardId)
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });
      if (err) throw err;
      return (data || []) as BoardCard[];
    } catch (err: any) {
      console.error('[fetchArchivedCards] failed:', err.message);
      return [];
    }
  }, []);

  return {
    boards, board, loading, error, checklistTemplates, userProfiles, boardMembers, notifications,
    boardEmails, unroutedEmails,
    fetchBoards, createBoard, createBoardFromTemplate, fetchBoard, updateBoard, toggleBoardStar, deleteBoard, duplicateBoard,
    addColumn, updateColumn, deleteColumn, reorderColumns,
    addBoardLink, removeBoardLink, reorderBoardLinks,
    addCard, updateCard, deleteCard, moveCard, reorderCardsInColumn,
    archiveCard, restoreCard, fetchArchivedCards,
    addCardLink, removeCardLink, searchCards, fetchCardDetail,
    addComment, editComment, deleteComment, reactToComment,
    addChecklistGroup, updateChecklistGroup, deleteChecklistGroup,
    addChecklistItem, editChecklistItem, toggleChecklistItem, deleteChecklistItem, reorderChecklistItems, updateChecklistItemDueDate, updateChecklistItemAssignees,
    fetchChecklistTemplates, saveChecklistTemplate, updateChecklistTemplate, deleteChecklistTemplate, applyChecklistTemplate,
    addLabel, updateLabel, deleteLabel,
    addCustomField, updateCustomField, deleteCustomField, setCardCustomFieldValue,
    fetchUserProfiles,
    fetchNotifications, createNotification, markNotificationRead, markCardNotificationsRead, markAllNotificationsRead, deleteNotification, clearAllNotifications,
    fetchBoardEmails, fetchUnroutedEmails, searchBoardEmails, deleteBoardEmail, routeEmail,
    setBoard, applyRealtimeEvent,
  };
}
