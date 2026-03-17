'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BoardTemplate, TemplateData } from '@/types/board-types';

async function getCachedUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export function useTemplates() {
  const [teamTemplates, setTeamTemplates] = useState<BoardTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamTemplates = useCallback(async (teamIds: string[]) => {
    if (teamIds.length === 0) {
      // Also fetch personal templates (no team)
      const user = await getCachedUser();
      if (!user) return;
      const { data } = await supabase
        .from('board_templates')
        .select('*')
        .eq('is_preset', false)
        .is('team_id', null)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      setTeamTemplates((data as BoardTemplate[]) || []);
      return;
    }

    const user = await getCachedUser();
    if (!user) return;

    // Fetch both team templates and personal templates
    const [teamRes, personalRes] = await Promise.all([
      supabase
        .from('board_templates')
        .select('*')
        .eq('is_preset', false)
        .in('team_id', teamIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('board_templates')
        .select('*')
        .eq('is_preset', false)
        .is('team_id', null)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false }),
    ]);

    const combined = [
      ...((teamRes.data as BoardTemplate[]) || []),
      ...((personalRes.data as BoardTemplate[]) || []),
    ];
    setTeamTemplates(combined);
  }, []);

  const saveTemplate = useCallback(async (params: {
    name: string;
    description?: string;
    icon?: string;
    icon_color?: string;
    team_id?: string | null;
    template_data: TemplateData;
  }) => {
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: err } = await supabase
        .from('board_templates')
        .insert([{
          created_by: user.id,
          team_id: params.team_id ?? null,
          name: params.name.trim(),
          description: params.description?.trim() || null,
          icon: params.icon || null,
          icon_color: params.icon_color || null,
          is_preset: false,
          template_data: params.template_data,
        }])
        .select()
        .single();

      if (err) throw err;
      setTeamTemplates(prev => [data as BoardTemplate, ...prev]);
      return data as BoardTemplate;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const updateTemplate = useCallback(async (id: string, updates: {
    name?: string;
    description?: string;
  }) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('board_templates')
        .update({
          ...(updates.name !== undefined && { name: updates.name.trim() }),
          ...(updates.description !== undefined && { description: updates.description.trim() || null }),
        })
        .eq('id', id);
      if (err) throw err;
      setTeamTemplates(prev => prev.map(t =>
        t.id === id ? { ...t, ...updates } : t
      ));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('board_templates')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setTeamTemplates(prev => prev.filter(t => t.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  return {
    teamTemplates,
    loading,
    error,
    fetchTeamTemplates,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
