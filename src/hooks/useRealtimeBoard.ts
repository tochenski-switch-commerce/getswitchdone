'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeToast {
  id: string;
  message: string;
  timestamp: number;
}

interface UseRealtimeBoardOptions {
  boardId: string | null;
  currentUserId: string | null;
  cardIds: string[];
  onRemoteChange: () => void;
  onNotification?: () => void;
}

export function useRealtimeBoard({ boardId, currentUserId, cardIds, onRemoteChange, onNotification }: UseRealtimeBoardOptions) {
  const [toasts, setToasts] = useState<RealtimeToast[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cardIdsRef = useRef<Set<string>>(new Set());
  const onRemoteChangeRef = useRef(onRemoteChange);
  const onNotificationRef = useRef(onNotification);

  // Keep refs in sync without re-subscribing
  useEffect(() => { cardIdsRef.current = new Set(cardIds); }, [cardIds]);
  useEffect(() => { onRemoteChangeRef.current = onRemoteChange; }, [onRemoteChange]);
  useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string) => {
    const toast: RealtimeToast = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      timestamp: Date.now(),
    };
    setToasts(prev => [...prev.slice(-4), toast]);
  }, []);

  useEffect(() => {
    if (!boardId || !supabase) return;

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const scheduleRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onRemoteChangeRef.current();
      }, 400);
    };

    const isOwnChange = (payload: any): boolean => {
      const record = payload.new || payload.old;
      if (!record || !currentUserId) return false;
      return record.user_id === currentUserId || record.created_by === currentUserId;
    };

    // Handler for board-scoped tables — filter by board_id in handler
    // (server-side filters don't work for DELETE events with default replica identity)
    const handleBoardScoped = (payload: any) => {
      const record = payload.new || payload.old;
      const recordBoardId = record?.board_id || record?.id;
      if (recordBoardId && recordBoardId !== boardId) return;
      if (isOwnChange(payload)) return;
      scheduleRefetch();

      const table = payload.table as string;
      const eventType = payload.eventType as string;

      if (table === 'board_cards') {
        if (eventType === 'INSERT') addToast('A new card was added');
        else if (eventType === 'UPDATE') {
          const title = (payload.new?.title || '').slice(0, 40);
          addToast(title ? `Card "${title}" was updated` : 'A card was updated');
        } else if (eventType === 'DELETE') addToast('A card was removed');
      } else if (table === 'board_columns') {
        if (eventType === 'INSERT') addToast('A new column was added');
        else if (eventType === 'UPDATE') addToast('A column was updated');
        else if (eventType === 'DELETE') addToast('A column was removed');
      } else if (table === 'project_boards') {
        addToast('Board details were updated');
      } else if (table === 'board_labels') {
        addToast('Labels were updated');
      } else if (table === 'board_custom_fields') {
        addToast('Custom fields were updated');
      }
    };

    // Handler for card-scoped tables (no board_id filter, need to check card membership)
    const handleCardScoped = (payload: any) => {
      const record = payload.new || payload.old;
      if (!record?.card_id || !cardIdsRef.current.has(record.card_id)) return;
      if (isOwnChange(payload)) return;
      scheduleRefetch();

      const table = payload.table as string;
      const eventType = payload.eventType as string;

      if (table === 'card_comments' && eventType === 'INSERT') {
        addToast('A new comment was added');
      } else if (table === 'card_checklists') {
        addToast('A checklist was updated');
      }
      // label assignments and custom field values: refetch is enough, no toast needed
    };

    // Handler for notifications (user-scoped)
    const handleNotification = (payload: any) => {
      const record = payload.new || payload.old;
      if (!record || record.user_id !== currentUserId) return;
      if (payload.eventType === 'INSERT') {
        addToast(record.title || 'New notification');
      }
      onNotificationRef.current?.();
    };

    const channel = supabase
      .channel(`board-realtime-${boardId}`)
      // Board-scoped tables (no server filter — DELETE events lack board_id with default replica identity)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_cards' }, handleBoardScoped)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_columns' }, handleBoardScoped)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_labels' }, handleBoardScoped)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_boards' }, handleBoardScoped)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_custom_fields' }, handleBoardScoped)
      // Card-scoped tables (filter in handler by card membership)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_comments' }, handleCardScoped)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_checklists' }, handleCardScoped)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_label_assignments' }, handleCardScoped)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_custom_field_values' }, handleCardScoped)
      // Notifications (user-scoped)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, handleNotification)
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [boardId, currentUserId, addToast]);

  // Auto-dismiss toasts after 4 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  return { toasts, dismissToast };
}
