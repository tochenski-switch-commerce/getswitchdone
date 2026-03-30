'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { CardPriority, BoardAutomationRule } from '@/types/board-types';

export interface TodayLabel {
  id: string;
  name: string;
  color: string;
}

export interface TodayCard {
  id: string;
  boardId: string;
  boardTitle: string;
  title: string;
  description: string | null;
  priority: CardPriority | null;
  dueDate: string | null;
  dueTime: string | null;
  startDate: string | null;
  assignees: string[];
  assigneeNames: string[];
  labels: TodayLabel[];
  checklistTotal: number;
  checklistDone: number;
  commentCount: number;
}

export interface TodayBoard {
  id: string;
  title: string;
  icon?: string;
  iconColor?: string;
  isStarred: boolean;
  labels: TodayLabel[];
}

export interface TodayStats {
  overdueCount: number;
  dueTodayCount: number;
  myCardsCount: number;
  dueThisWeekCount: number;
  completedTodayCount: number;
  urgentCount: number;
  streakDays: number;
}

export interface TodayData {
  overdue: TodayCard[];
  dueToday: TodayCard[];
  myCards: TodayCard[];
  onDeck: TodayCard[];
  completedToday: TodayCard[];
  focused: TodayCard[];
  boards: TodayBoard[];
  starredBoards: TodayBoard[];
  stats: TodayStats;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markComplete: (cardId: string) => Promise<void>;
  unfocusCard: (cardId: string) => Promise<void>;
  toggleBoardStar: (boardId: string) => Promise<void>;
  createCard: (boardId: string, title: string, dueDate?: string, labelId?: string) => Promise<void>;
}

export function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const CARD_SELECT = 'id, board_id, title, description, priority, due_date, due_time, start_date, assignee, assignees, is_complete, is_archived, focused_by';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useTodayData(): TodayData {
  const [overdue, setOverdue] = useState<TodayCard[]>([]);
  const [dueToday, setDueToday] = useState<TodayCard[]>([]);
  const [myCards, setMyCards] = useState<TodayCard[]>([]);
  const [onDeck, setOnDeck] = useState<TodayCard[]>([]);
  const [completedToday, setCompletedToday] = useState<TodayCard[]>([]);
  const [focused, setFocused] = useState<TodayCard[]>([]);
  const [boards, setBoards] = useState<TodayBoard[]>([]);
  const [stats, setStats] = useState<TodayStats>({
    overdueCount: 0, dueTodayCount: 0, myCardsCount: 0,
    dueThisWeekCount: 0, completedTodayCount: 0, urgentCount: 0, streakDays: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;
      const now = new Date();
      const todayStr = toDateStr(now);
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const weekOut = new Date(todayMidnight);
      weekOut.setDate(weekOut.getDate() + 7);
      const weekOutStr = toDateStr(weekOut);

      const threeDaysOut = new Date(todayMidnight);
      threeDaysOut.setDate(threeDaysOut.getDate() + 3);
      const threeDaysOutStr = toDateStr(threeDaysOut);

      const sevenDaysAgo = new Date(todayMidnight);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      // Fetch current user's profile name so legacy cards (assignee stored as name, not UUID) are also matched
      const { data: myProfile } = await supabase.from('user_profiles').select('name').eq('id', userId).single();
      const myName = myProfile?.name ?? null;

      // ── Phase 1: main card queries ────────────────────────────────
      // Cover both UUID format (new) and display-name format (legacy)
      let assignedFilter = `assignees.cs.{${userId}},assignee.eq.${userId}`;
      if (myName) {
        assignedFilter += `,assignees.cs.{"${myName}"},assignee.eq.${myName}`;
      }

      const [dueDateRes, assignedRes, boardsRes, completedTodayRes, onDeckRes, focusedRes, streakRes, checklistAssignedRes] = await Promise.all([
        supabase.from('board_cards').select(CARD_SELECT)
          .eq('is_archived', false).eq('is_complete', false)
          .not('due_date', 'is', null).lte('due_date', todayStr)
          .or(assignedFilter)
          .order('due_date', { ascending: true }),

        supabase.from('board_cards').select(CARD_SELECT)
          .eq('is_archived', false).eq('is_complete', false)
          .or(assignedFilter)
          .order('due_date', { ascending: true, nullsFirst: false }),

        supabase.from('project_boards').select('id, title, icon, icon_color, is_starred')
          .eq('is_archived', false).order('created_at'),

        supabase.from('board_cards').select(CARD_SELECT)
          .eq('is_complete', true).eq('is_archived', false)
          .or(assignedFilter)
          .gte('updated_at', todayMidnight.toISOString())
          .order('updated_at', { ascending: false }),

        supabase.from('board_cards').select(CARD_SELECT)
          .eq('is_archived', false).eq('is_complete', false)
          .gt('due_date', todayStr).lte('due_date', threeDaysOutStr)
          .or(assignedFilter)
          .order('due_date', { ascending: true }),

        supabase.from('board_cards').select(CARD_SELECT)
          .eq('is_archived', false).eq('is_complete', false)
          .contains('focused_by', [userId])
          .order('updated_at', { ascending: false }),

        supabase.from('board_cards').select('updated_at')
          .eq('is_complete', true).eq('is_archived', false)
          .or(assignedFilter)
          .gte('updated_at', sevenDaysAgo.toISOString()),

        supabase.from('card_checklists').select('card_id')
          .eq('is_completed', false)
          .filter('assignees', 'cs', JSON.stringify([userId])),
      ]);

      if (dueDateRes.error) throw dueDateRes.error;
      if (assignedRes.error) throw assignedRes.error;
      if (boardsRes.error) throw boardsRes.error;

      const boardList = boardsRes.data || [];
      const boardIds = boardList.map(b => b.id);
      const boardLabelsRes = boardIds.length > 0
        ? await supabase.from('board_labels').select('id, name, color, board_id').in('board_id', boardIds)
        : { data: [] as { id: string; name: string; color: string; board_id: string }[] };
      const boardLabelsMap = new Map<string, TodayLabel[]>();
      for (const l of boardLabelsRes.data || []) {
        if (!boardLabelsMap.has(l.board_id)) boardLabelsMap.set(l.board_id, []);
        boardLabelsMap.get(l.board_id)!.push({ id: l.id, name: l.name, color: l.color });
      }
      const mappedBoards = boardList.map(b => ({
        id: b.id,
        title: b.title,
        icon: (b as { icon?: string }).icon,
        iconColor: (b as { icon_color?: string }).icon_color,
        isStarred: !!(b as { is_starred?: boolean }).is_starred,
        labels: boardLabelsMap.get(b.id) ?? [],
      }));
      setBoards(mappedBoards);
      const boardMap = new Map<string, string>(boardList.map(b => [b.id, b.title]));

      // Basic card conversion (enrichment comes later)
      type RawCard = {
        id: string; board_id: string; title: string; description: string | null;
        priority: string | null; due_date: string | null; due_time: string | null;
        start_date: string | null; assignee: string | null; assignees: string[] | null; focused_by?: string[];
      };
      const toCard = (raw: RawCard): TodayCard => {
        // Merge singular assignee + assignees array, deduped
        const merged = [...new Set([
          ...(raw.assignees ?? []),
          ...(raw.assignee ? [raw.assignee] : []),
        ])];
        return {
          id: raw.id,
          boardId: raw.board_id,
          boardTitle: boardMap.get(raw.board_id) ?? 'Unknown',
          title: raw.title,
          description: raw.description ?? null,
          priority: raw.priority as CardPriority | null,
          dueDate: raw.due_date ?? null,
          dueTime: raw.due_time ?? null,
          startDate: raw.start_date ?? null,
          assignees: merged,
          assigneeNames: [],
          labels: [],
          checklistTotal: 0,
          checklistDone: 0,
          commentCount: 0,
        };
      };

      const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

      const dueDateCards = (dueDateRes.data || []).map(toCard);
      const overdueCards = dueDateCards.filter(c => c.dueDate! < todayStr);
      const dueTodayCards = dueDateCards.filter(c => c.dueDate === todayStr);

      overdueCards.sort((a, b) => {
        if (a.dueDate !== b.dueDate) return a.dueDate! < b.dueDate! ? -1 : 1;
        return (PRIORITY_ORDER[a.priority ?? 'low'] ?? 3) - (PRIORITY_ORDER[b.priority ?? 'low'] ?? 3);
      });

      dueTodayCards.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority ?? 'low'] ?? 3;
        const pb = PRIORITY_ORDER[b.priority ?? 'low'] ?? 3;
        if (pa !== pb) return pa - pb;
        if (!a.dueTime && !b.dueTime) return 0;
        if (!a.dueTime) return 1;
        if (!b.dueTime) return -1;
        return a.dueTime.localeCompare(b.dueTime);
      });

      const shownIds = new Set([...overdueCards, ...dueTodayCards].map(c => c.id));
      const assignedCards = (assignedRes.data || []).map(toCard);

      let myCardsFiltered = assignedCards.filter(c => {
        if (shownIds.has(c.id)) return false;
        if (!c.dueDate) return true;
        return c.dueDate <= weekOutStr;
      });

      // Also include parent cards of checklist items assigned to me
      const checklistCardIds = [...new Set((checklistAssignedRes.data || []).map(ci => ci.card_id))];
      if (checklistCardIds.length > 0) {
        const alreadyShown = new Set([...overdueCards, ...dueTodayCards, ...myCardsFiltered].map(c => c.id));
        const extraIds = checklistCardIds.filter(id => !alreadyShown.has(id));
        if (extraIds.length > 0) {
          const { data: extraCards } = await supabase
            .from('board_cards').select(CARD_SELECT)
            .in('id', extraIds)
            .eq('is_archived', false).eq('is_complete', false);
          if (extraCards && extraCards.length > 0) {
            myCardsFiltered = [...myCardsFiltered, ...extraCards.map(toCard)];
          }
        }
      }

      const dueThisWeek = assignedCards.filter(c =>
        c.dueDate && c.dueDate > todayStr && c.dueDate <= weekOutStr
      );

      const completedTodayCards = (completedTodayRes.data || []).map(toCard);
      const onDeckCards = (onDeckRes.data || []).map(toCard);
      const focusedCards = (focusedRes.data || []).map(toCard);

      // ── Phase 2: enrichment ───────────────────────────────────────
      const allCards = [...overdueCards, ...dueTodayCards, ...myCardsFiltered,
                        ...completedTodayCards, ...onDeckCards, ...focusedCards];
      const allCardIds = [...new Set(allCards.map(c => c.id))];
      const allAssigneeIds = [...new Set(
        allCards.flatMap(c => c.assignees).filter(id => UUID_RE.test(id))
      )];

      if (allCardIds.length > 0) {
        const [labelAssignRes, checklistRes, commentRes, profileRes] = await Promise.all([
          supabase.from('card_label_assignments').select('card_id, label_id')
            .in('card_id', allCardIds),
          supabase.from('card_checklists').select('card_id, is_completed')
            .in('card_id', allCardIds),
          supabase.from('card_comments').select('card_id')
            .in('card_id', allCardIds),
          allAssigneeIds.length > 0
            ? supabase.from('user_profiles').select('id, name').in('id', allAssigneeIds)
            : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
        ]);

        // Fetch board_labels for found label IDs
        const labelIds = [...new Set((labelAssignRes.data || []).map(la => la.label_id))];
        const boardLabelsRes = labelIds.length > 0
          ? await supabase.from('board_labels').select('id, name, color').in('id', labelIds)
          : { data: [] as { id: string; name: string; color: string }[] };

        // Build lookup maps
        const labelById = new Map((boardLabelsRes.data || []).map(l => [l.id, l]));
        const labelsByCard = new Map<string, TodayLabel[]>();
        for (const la of labelAssignRes.data || []) {
          const lbl = labelById.get(la.label_id);
          if (!lbl) continue;
          if (!labelsByCard.has(la.card_id)) labelsByCard.set(la.card_id, []);
          labelsByCard.get(la.card_id)!.push(lbl);
        }

        const checklistsByCard = new Map<string, { total: number; done: number }>();
        for (const cl of checklistRes.data || []) {
          const cur = checklistsByCard.get(cl.card_id) ?? { total: 0, done: 0 };
          cur.total += 1;
          if (cl.is_completed) cur.done += 1;
          checklistsByCard.set(cl.card_id, cur);
        }

        const commentsByCard = new Map<string, number>();
        for (const c of commentRes.data || []) {
          commentsByCard.set(c.card_id, (commentsByCard.get(c.card_id) ?? 0) + 1);
        }

        const profileById = new Map((profileRes.data || []).map(p => [p.id, p.name]));

        const enrich = (card: TodayCard): TodayCard => ({
          ...card,
          labels: labelsByCard.get(card.id) ?? [],
          checklistTotal: checklistsByCard.get(card.id)?.total ?? 0,
          checklistDone: checklistsByCard.get(card.id)?.done ?? 0,
          commentCount: commentsByCard.get(card.id) ?? 0,
          assigneeNames: card.assignees
            .map(id => profileById.get(id))
            .filter((n): n is string => !!n),
        });

        const enrichAll = (cards: TodayCard[]) => cards.map(enrich);

        const allVisible = [...overdueCards, ...dueTodayCards, ...myCardsFiltered];
        const urgentCount = allVisible.filter(
          c => c.priority === 'urgent' || c.priority === 'high'
        ).length;

        // compute streak: consecutive days with at least one completion, ending today
        const completionDates = new Set(
          (streakRes.data || []).map(c => toDateStr(new Date((c as { updated_at: string }).updated_at)))
        );
        // also count today if completedToday has cards
        if (completedTodayCards.length > 0) completionDates.add(todayStr);
        let streakDays = 0;
        for (let i = 0; i <= 6; i++) {
          const d = new Date(todayMidnight);
          d.setDate(d.getDate() - i);
          if (completionDates.has(toDateStr(d))) streakDays++;
          else break;
        }

        setOverdue(enrichAll(overdueCards));
        setDueToday(enrichAll(dueTodayCards));
        setMyCards(enrichAll(myCardsFiltered));
        setOnDeck(enrichAll(onDeckCards));
        setCompletedToday(enrichAll(completedTodayCards));
        setFocused(enrichAll(focusedCards));
        setStats({
          overdueCount: overdueCards.length,
          dueTodayCount: dueTodayCards.length,
          myCardsCount: assignedCards.length,
          dueThisWeekCount: dueThisWeek.length,
          completedTodayCount: completedTodayCards.length,
          urgentCount,
          streakDays,
        });
      } else {
        setOverdue([]); setDueToday([]); setMyCards([]);
        setOnDeck([]); setCompletedToday([]); setFocused([]);
        setStats({ overdueCount: 0, dueTodayCount: 0, myCardsCount: 0,
          dueThisWeekCount: 0, completedTodayCount: 0, urgentCount: 0, streakDays: 0 });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load today\'s data');
    } finally {
      setLoading(false);
    }
  }, []);

  const markComplete = useCallback(async (cardId: string) => {
    const completedCard =
      overdue.find(c => c.id === cardId) ||
      dueToday.find(c => c.id === cardId) ||
      myCards.find(c => c.id === cardId) ||
      focused.find(c => c.id === cardId);

    setOverdue(prev => prev.filter(c => c.id !== cardId));
    setDueToday(prev => prev.filter(c => c.id !== cardId));
    setMyCards(prev => prev.filter(c => c.id !== cardId));
    setFocused(prev => prev.filter(c => c.id !== cardId));

    if (completedCard) setCompletedToday(prev => [completedCard, ...prev]);

    setStats(prev => {
      const wasOverdue = overdue.some(c => c.id === cardId);
      const wasDueToday = dueToday.some(c => c.id === cardId);
      return {
        ...prev,
        overdueCount: wasOverdue ? prev.overdueCount - 1 : prev.overdueCount,
        dueTodayCount: wasDueToday ? prev.dueTodayCount - 1 : prev.dueTodayCount,
        completedTodayCount: prev.completedTodayCount + 1,
      };
    });

    const { error } = await supabase
      .from('board_cards').update({ is_complete: true }).eq('id', cardId);
    if (error) { refresh(); return; }

    // Run card_completed board automation if one is configured
    if (completedCard?.boardId) {
      const { data: board } = await supabase
        .from('project_boards')
        .select('automations')
        .eq('id', completedCard.boardId)
        .single();

      const automations: BoardAutomationRule[] = board?.automations ?? [];
      const rule = automations.find(
        r => r.enabled && r.trigger === 'card_completed' && r.action.type === 'move_to_column'
      );

      if (rule && rule.action.type === 'move_to_column') {
        const targetColumnId = rule.action.column_id;
        const { data: lastCard } = await supabase
          .from('board_cards')
          .select('position')
          .eq('column_id', targetColumnId)
          .order('position', { ascending: false })
          .limit(1)
          .single();
        const position = lastCard ? lastCard.position + 1 : 0;
        await supabase
          .from('board_cards')
          .update({ column_id: targetColumnId, position })
          .eq('id', cardId);
      }
    }
  }, [overdue, dueToday, myCards, focused, refresh]);

  const unfocusCard = useCallback(async (cardId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const userId = session.user.id;
    setFocused(prev => prev.filter(c => c.id !== cardId));
    const { data: card } = await supabase.from('board_cards').select('focused_by').eq('id', cardId).single();
    const newFocusedBy = (card?.focused_by || []).filter((id: string) => id !== userId);
    await supabase.from('board_cards').update({ focused_by: newFocusedBy }).eq('id', cardId);
  }, []);

  const toggleBoardStar = useCallback(async (boardId: string) => {
    setBoards(prev => prev.map(b =>
      b.id === boardId ? { ...b, isStarred: !b.isStarred } : b
    ));
    const board = boards.find(b => b.id === boardId);
    if (!board) return;
    await supabase.from('project_boards').update({ is_starred: !board.isStarred }).eq('id', boardId);
  }, [boards]);

  const createCard = useCallback(async (boardId: string, title: string, dueDate?: string, labelId?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || !title.trim()) return;

    const { data: cols } = await supabase.from('board_columns')
      .select('id').eq('board_id', boardId).order('position').limit(1);
    const columnId = cols?.[0]?.id;
    if (!columnId) return;

    const { data: existing } = await supabase.from('board_cards')
      .select('position').eq('column_id', columnId)
      .order('position', { ascending: false }).limit(1);
    const position = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    const { data: newCard } = await supabase.from('board_cards').insert({
      board_id: boardId, column_id: columnId,
      title: title.trim(), position, is_archived: false,
      created_by: session.user.id,
      ...(dueDate ? { due_date: dueDate } : {}),
    }).select('id').single();

    if (labelId && newCard?.id) {
      await supabase.from('card_label_assignments').insert({ card_id: newCard.id, label_id: labelId });
    }
  }, []);

  const starredBoards = boards.filter(b => b.isStarred);

  return {
    overdue, dueToday, myCards, onDeck, completedToday, focused,
    boards, starredBoards, stats, loading, error, refresh, markComplete, unfocusCard, toggleBoardStar, createCard,
  };
}
