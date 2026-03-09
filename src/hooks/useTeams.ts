'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Team, TeamMember, TeamInvite } from '@/types/board-types';

async function getCachedUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── List teams I belong to ──────────────────────────────
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');

      // Get team IDs I belong to
      const { data: memberRows, error: mErr } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);
      if (mErr) throw mErr;

      const teamIds = (memberRows || []).map(m => m.team_id);
      if (teamIds.length === 0) { setTeams([]); setLoading(false); return; }

      const { data, error: tErr } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('created_at', { ascending: false });
      if (tErr) throw tErr;
      setTeams(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Create team ─────────────────────────────────────────
  const createTeam = useCallback(async (name: string) => {
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('create_team', { team_name: name.trim() });
      if (err) throw err;

      const team = data as Team;
      setTeams(prev => [team, ...prev]);
      return team;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  // ─── Delete team (owner only) ────────────────────────────
  const deleteTeam = useCallback(async (teamId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase.from('teams').delete().eq('id', teamId);
      if (err) throw err;
      setTeams(prev => prev.filter(t => t.id !== teamId));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // ─── Rename team ─────────────────────────────────────────
  const renameTeam = useCallback(async (teamId: string, name: string) => {
    setError(null);
    try {
      const { error: err } = await supabase.from('teams').update({ name: name.trim() }).eq('id', teamId);
      if (err) throw err;
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name: name.trim() } : t));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // ─── Fetch members for a team ────────────────────────────
  const fetchMembers = useCallback(async (teamId: string) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('joined_at');
      if (err) throw err;

      const userIds = (data || []).map(m => m.user_id);
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', userIds);
        (profiles || []).forEach(p => { profileMap[p.id] = p.name || ''; });
      }

      const parsed = (data || []).map((m: any) => ({
        ...m,
        user_profiles: { name: profileMap[m.user_id] || '' },
      })) as TeamMember[];
      setMembers(parsed);
      return parsed;
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, []);

  // ─── Update member role (owner action) ────────────────────
  const updateMemberRole = useCallback(async (teamId: string, userId: string, role: 'editor' | 'viewer') => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('team_members')
        .update({ role })
        .eq('team_id', teamId)
        .eq('user_id', userId);
      if (err) throw err;
      setMembers(prev => prev.map(m =>
        m.team_id === teamId && m.user_id === userId ? { ...m, role } : m
      ));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // ─── Remove member (owner action or self-leave) ──────────
  const removeMember = useCallback(async (teamId: string, userId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId);
      if (err) throw err;
      setMembers(prev => prev.filter(m => !(m.team_id === teamId && m.user_id === userId)));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // ─── Leave team (self) ───────────────────────────────────
  const leaveTeam = useCallback(async (teamId: string) => {
    const user = await getCachedUser();
    if (!user) return;
    await removeMember(teamId, user.id);
    setTeams(prev => prev.filter(t => t.id !== teamId));
  }, [removeMember]);

  // ─── Fetch invites for a team ────────────────────────────
  const fetchInvites = useCallback(async (teamId: string) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('team_invites')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setInvites(data || []);
      return data as TeamInvite[];
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, []);

  // ─── Generate invite ─────────────────────────────────────
  const createInvite = useCallback(async (teamId: string, maxUses?: number, expiresAt?: string) => {
    setError(null);
    try {
      const user = await getCachedUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: err } = await supabase
        .from('team_invites')
        .insert([{
          team_id: teamId,
          created_by: user.id,
          max_uses: maxUses ?? null,
          expires_at: expiresAt ?? null,
        }])
        .select()
        .single();
      if (err) throw err;
      setInvites(prev => [data, ...prev]);
      return data as TeamInvite;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  // ─── Revoke invite ───────────────────────────────────────
  const revokeInvite = useCallback(async (inviteId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('team_invites')
        .update({ is_active: false })
        .eq('id', inviteId);
      if (err) throw err;
      setInvites(prev => prev.map(i => i.id === inviteId ? { ...i, is_active: false } : i));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // ─── Join team via invite code ────────────────────────────
  const joinTeam = useCallback(async (code: string) => {
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('use_team_invite', { code });
      if (err) throw err;
      return data as string; // team_id
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  // ─── Get member counts for multiple teams ─────────────────
  const fetchTeamMemberCounts = useCallback(async (teamIds: string[]) => {
    if (teamIds.length === 0) return {};
    const { data } = await supabase
      .from('team_members')
      .select('team_id')
      .in('team_id', teamIds);
    const counts: Record<string, number> = {};
    (data || []).forEach(r => { counts[r.team_id] = (counts[r.team_id] || 0) + 1; });
    return counts;
  }, []);

  // ─── Get my role in a team ────────────────────────────────
  const getMyRole = useCallback(async (teamId: string) => {
    const user = await getCachedUser();
    if (!user) return null;
    const { data } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();
    return data?.role as 'owner' | 'editor' | 'viewer' | null;
  }, []);

  return {
    teams, members, invites, loading, error,
    fetchTeams, createTeam, deleteTeam, renameTeam,
    fetchMembers, updateMemberRole, removeMember, leaveTeam,
    fetchInvites, createInvite, revokeInvite,
    joinTeam, fetchTeamMemberCounts, getMyRole,
  };
}
