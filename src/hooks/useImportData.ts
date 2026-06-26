'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CardPriority, ProjectBoard, UserProfile } from '@/types/board-types';

export type ImportBoard = Pick<ProjectBoard, 'id' | 'title' | 'icon' | 'icon_color'>;
export type ImportColumn = { id: string; title: string };

export interface ImportCardInput {
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority?: CardPriority | null;
  due_date?: string;
  assignee?: string;
}

export interface BulkCreateResult {
  created: number;
  failed: number;
}

/**
 * Cross-board data + bulk card creation for the meeting-notes import page.
 * Unlike useProjectBoard (scoped to one board), this lists every board the
 * user can reach, lazily caches their columns, and inserts cards directly.
 */
export function useImportData() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<ImportBoard[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [columnsByBoard, setColumnsByBoard] = useState<Record<string, ImportColumn[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load: boards + assignable users (global pool).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Boards + the teams the current user belongs to (for scoping assignees).
        const [boardsRes, myTeamsRes] = await Promise.all([
          supabase
            .from('project_boards')
            .select('id, title, icon, icon_color')
            .eq('is_archived', false)
            .order('updated_at', { ascending: false }),
          supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', user!.id),
        ]);
        if (boardsRes.error) throw boardsRes.error;
        if (myTeamsRes.error) throw myTeamsRes.error;

        // Assignable people = members of my teams, plus myself.
        const teamIds = (myTeamsRes.data || []).map(r => r.team_id as string);
        const memberIds = new Set<string>([user!.id]);
        if (teamIds.length > 0) {
          const { data: memberRows, error: memberErr } = await supabase
            .from('team_members')
            .select('user_id')
            .in('team_id', teamIds);
          if (memberErr) throw memberErr;
          (memberRows || []).forEach(m => memberIds.add(m.user_id as string));
        }

        const { data: profiles, error: profilesErr } = await supabase
          .from('user_profiles')
          .select('id, name, updated_at')
          .in('id', [...memberIds])
          .order('name', { ascending: true });
        if (profilesErr) throw profilesErr;
        if (cancelled) return;
        setBoards((boardsRes.data || []) as ImportBoard[]);
        setUserProfiles((profiles || []) as UserProfile[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load import data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [user]);

  // Lazily fetch + cache columns for a board.
  const fetchBoardColumns = useCallback(async (boardId: string): Promise<ImportColumn[]> => {
    if (!boardId) return [];
    if (columnsByBoard[boardId]) return columnsByBoard[boardId];
    const { data, error: columnsError } = await supabase
      .from('board_columns')
      .select('id, title, column_type, position')
      .eq('board_id', boardId)
      .order('position', { ascending: true });
    if (columnsError) throw columnsError;
    const cols = (data || [])
      .filter((c: { column_type?: string }) => c.column_type !== 'board_links')
      .map((c: { id: string; title: string }) => ({ id: c.id, title: c.title }));
    setColumnsByBoard(prev => ({ ...prev, [boardId]: cols }));
    return cols;
  }, [columnsByBoard]);

  // Insert each card directly into board_cards, computing position per column.
  const bulkCreateCards = useCallback(async (cards: ImportCardInput[]): Promise<BulkCreateResult> => {
    let created = 0;
    let failed = 0;
    // Track the next position per column so multiple cards into the same list stack correctly.
    const nextPosByColumn: Record<string, number> = {};

    for (const card of cards) {
      try {
        if (nextPosByColumn[card.column_id] === undefined) {
          const { data: lastCard } = await supabase
            .from('board_cards')
            .select('position')
            .eq('column_id', card.column_id)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle();
          nextPosByColumn[card.column_id] = ((lastCard?.position as number | undefined) ?? -1) + 1;
        }
        const position = nextPosByColumn[card.column_id]++;
        const { error: insertError } = await supabase
          .from('board_cards')
          .insert({
            board_id: card.board_id,
            column_id: card.column_id,
            title: card.title.trim() || 'Untitled',
            description: card.description || null,
            priority: card.priority ?? 'medium',
            due_date: card.due_date || null,
            assignee: card.assignee || null,
            assignees: card.assignee ? [card.assignee] : [],
            position,
            created_by: user?.id || null,
          });
        if (insertError) throw insertError;
        created++;
      } catch {
        failed++;
      }
    }
    return { created, failed };
  }, [user]);

  return { boards, userProfiles, columnsByBoard, loading, error, fetchBoardColumns, bulkCreateCards };
}
