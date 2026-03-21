'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { CardPriority } from '@/types/board-types';

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export type CalendarEventType = 'card' | 'checklist';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  boardId: string;
  boardName: string;
  boardIndex: number;
  columnId: string;
  columnName: string;
  priority: CardPriority | null;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  assignee: string | null;
  isComplete: boolean;
  cardId: string; // parent card id (same as id for cards)
}

export interface CalendarBoard {
  id: string;
  title: string;
  index: number;
}

export interface CalendarData {
  events: CalendarEvent[];
  boards: CalendarBoard[];
  loading: boolean;
  error: string | null;
  totalCards: number;
  totalChecklistItems: number;
  refresh: () => Promise<void>;
  toggleComplete: (event: CalendarEvent) => Promise<void>;
  addCard: (params: { boardId: string; columnId: string; title: string; dueDate: string }) => Promise<void>;
  rescheduleEvent: (event: CalendarEvent, newDateKey: string) => Promise<void>;
  getColumnsForBoard: (boardId: string) => { id: string; title: string }[];
}

export function useCalendarData(): CalendarData {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [boards, setBoards] = useState<CalendarBoard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCards, setTotalCards] = useState(0);
  const [totalChecklistItems, setTotalChecklistItems] = useState(0);
  const [columnsMap, setColumnsMap] = useState<Record<string, { id: string; title: string }[]>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Fetch all boards the user can access
      const { data: boardsData, error: boardsError } = await supabase
        .from('project_boards')
        .select('id, title')
        .eq('is_archived', false)
        .order('created_at');

      if (boardsError) throw boardsError;
      const boardList = boardsData || [];
      const boardIndexMap = new Map<string, number>(boardList.map((b, i) => [b.id, i]));
      const boardNameMap = new Map<string, string>(boardList.map(b => [b.id, b.title]));

      setBoards(boardList.map((b, i) => ({ id: b.id, title: b.title, index: i })));

      // Fetch all columns
      const boardIds = boardList.map(b => b.id);
      if (boardIds.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const [columnsRes, cardsRes, checklistsRes] = await Promise.all([
        supabase.from('board_columns').select('id, board_id, title').in('board_id', boardIds),
        supabase
          .from('board_cards')
          .select('id, title, board_id, column_id, priority, start_date, due_date, assignee, is_complete, is_archived')
          .in('board_id', boardIds)
          .eq('is_archived', false)
          .or('start_date.not.is.null,due_date.not.is.null'),
        supabase
          .from('card_checklists')
          .select('id, card_id, title, is_completed, due_date')
          .not('due_date', 'is', null),
      ]);

      if (columnsRes.error) throw columnsRes.error;

      const columnList = columnsRes.data || [];
      const columnById = new Map<string, { board_id: string; title: string }>(
        columnList.map(c => [c.id, { board_id: c.board_id, title: c.title }])
      );

      // Build columnsMap for getColumnsForBoard
      const newColumnsMap: Record<string, { id: string; title: string }[]> = {};
      for (const col of columnList) {
        if (!newColumnsMap[col.board_id]) newColumnsMap[col.board_id] = [];
        newColumnsMap[col.board_id].push({ id: col.id, title: col.title });
      }
      setColumnsMap(newColumnsMap);

      const cardEvents: CalendarEvent[] = [];
      const cards = cardsRes.data || [];

      for (const card of cards) {
        const start = card.start_date || card.due_date;
        const end = card.due_date || card.start_date;
        if (!start || !end) continue;

        const col = columnById.get(card.column_id);
        const boardIndex = boardIndexMap.get(card.board_id) ?? 0;

        cardEvents.push({
          id: card.id,
          type: 'card',
          title: card.title,
          boardId: card.board_id,
          boardName: boardNameMap.get(card.board_id) ?? 'Unknown',
          boardIndex,
          columnId: card.column_id,
          columnName: col?.title ?? 'Unknown',
          priority: card.priority as CardPriority | null,
          startDate: start,
          endDate: end,
          assignee: card.assignee ?? null,
          isComplete: card.is_complete ?? false,
          cardId: card.id,
        });
      }

      setTotalCards(cards.length);

      // Build a Map for O(1) card lookups
      const cardById = new Map(cards.map(c => [c.id, c]));

      // Checklist items with due dates
      const checklists = checklistsRes.data || [];
      const checklistEvents: CalendarEvent[] = [];

      for (const item of checklists) {
        if (!item.due_date) continue;
        const parentCard = cardById.get(item.card_id);
        if (!parentCard) continue;

        // checklist due_date is timestamptz — extract YYYY-MM-DD
        const dateKey = item.due_date.slice(0, 10);

        const col = columnById.get(parentCard.column_id);
        const boardIndex = boardIndexMap.get(parentCard.board_id) ?? 0;

        checklistEvents.push({
          id: item.id,
          type: 'checklist',
          title: item.title,
          boardId: parentCard.board_id,
          boardName: boardNameMap.get(parentCard.board_id) ?? 'Unknown',
          boardIndex,
          columnId: parentCard.column_id,
          columnName: col?.title ?? 'Unknown',
          priority: parentCard.priority as CardPriority | null,
          startDate: dateKey,
          endDate: dateKey,
          assignee: parentCard.assignee ?? null,
          isComplete: item.is_completed ?? false,
          cardId: item.card_id,
        });
      }

      setTotalChecklistItems(checklistEvents.length);
      setEvents([...cardEvents, ...checklistEvents]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleComplete = useCallback(async (event: CalendarEvent) => {
    const newComplete = !event.isComplete;

    // Optimistic update
    setEvents(prev =>
      prev.map(e => (e.id === event.id ? { ...e, isComplete: newComplete } : e))
    );

    if (event.type === 'card') {
      const { error } = await supabase
        .from('board_cards')
        .update({ is_complete: newComplete })
        .eq('id', event.id);
      if (error) {
        // Revert
        setEvents(prev =>
          prev.map(e => (e.id === event.id ? { ...e, isComplete: !newComplete } : e))
        );
      }
    } else {
      const { error } = await supabase
        .from('card_checklists')
        .update({ is_completed: newComplete })
        .eq('id', event.id);
      if (error) {
        setEvents(prev =>
          prev.map(e => (e.id === event.id ? { ...e, isComplete: !newComplete } : e))
        );
      }
    }
  }, []);

  const addCard = useCallback(async (params: { boardId: string; columnId: string; title: string; dueDate: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Get current max position for the column
    const { data: existing } = await supabase
      .from('board_cards')
      .select('position')
      .eq('column_id', params.columnId)
      .order('position', { ascending: false })
      .limit(1);

    const position = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    const { data: newCard, error } = await supabase
      .from('board_cards')
      .insert({
        board_id: params.boardId,
        column_id: params.columnId,
        title: params.title,
        due_date: params.dueDate,
        position,
        is_archived: false,
        created_by: session.user.id,
      })
      .select('id, title, board_id, column_id, priority, start_date, due_date, assignee, is_complete')
      .single();

    if (error || !newCard) return;

    const boardIndex = boards.findIndex(b => b.id === params.boardId);
    const board = boards[boardIndex];
    const cols = columnsMap[params.boardId] || [];
    const col = cols.find(c => c.id === params.columnId);

    const newEvent: CalendarEvent = {
      id: newCard.id,
      type: 'card',
      title: newCard.title,
      boardId: newCard.board_id,
      boardName: board?.title ?? 'Unknown',
      boardIndex: boardIndex >= 0 ? boardIndex : 0,
      columnId: newCard.column_id,
      columnName: col?.title ?? 'Unknown',
      priority: null,
      startDate: params.dueDate,
      endDate: params.dueDate,
      assignee: null,
      isComplete: false,
      cardId: newCard.id,
    };

    setEvents(prev => [...prev, newEvent]);
    setTotalCards(prev => prev + 1);
  }, [boards, columnsMap]);

  const rescheduleEvent = useCallback(async (event: CalendarEvent, newDateKey: string) => {
    const oldStart = event.startDate;
    const oldEnd = event.endDate;
    const duration = Math.round(
      (parseLocalDate(oldEnd).getTime() - parseLocalDate(oldStart).getTime()) / (1000 * 60 * 60 * 24)
    );

    let newStart = newDateKey;
    let newEnd = newDateKey;
    if (duration > 0) {
      const endD = parseLocalDate(newDateKey);
      endD.setDate(endD.getDate() + duration);
      newEnd = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
    }

    // Optimistic update
    setEvents(prev =>
      prev.map(e => (e.id === event.id ? { ...e, startDate: newStart, endDate: newEnd } : e))
    );

    if (event.type === 'card') {
      const update: Record<string, string | null> = { due_date: newEnd };
      // Only set start_date if the card originally spanned multiple days
      if (oldStart !== oldEnd) {
        update.start_date = newStart;
      }
      const { error } = await supabase
        .from('board_cards')
        .update(update)
        .eq('id', event.id);
      if (error) {
        setEvents(prev =>
          prev.map(e => (e.id === event.id ? { ...e, startDate: oldStart, endDate: oldEnd } : e))
        );
      }
    } else {
      const { error } = await supabase
        .from('card_checklists')
        .update({ due_date: newDateKey })
        .eq('id', event.id);
      if (error) {
        setEvents(prev =>
          prev.map(e => (e.id === event.id ? { ...e, startDate: oldStart, endDate: oldEnd } : e))
        );
      }
    }
  }, []);

  const getColumnsForBoard = useCallback((boardId: string) => {
    return columnsMap[boardId] || [];
  }, [columnsMap]);

  return {
    events,
    boards,
    loading,
    error,
    totalCards,
    totalChecklistItems,
    refresh,
    toggleComplete,
    addCard,
    rescheduleEvent,
    getColumnsForBoard,
  };
}
