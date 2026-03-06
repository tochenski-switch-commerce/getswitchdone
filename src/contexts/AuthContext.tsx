'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { isAuthorizedEmail } from '@/lib/authorized-users';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/board-types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthorized: boolean;
  profile: UserProfile | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  createUser: (email: string, password: string) => Promise<{ error: Error | null }>;
  updateProfileName: (name: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const isAuthorized = isAuthorizedEmail(user?.email);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile(data as UserProfile);
    } else {
      // Auto-create profile row on first login
      const { data: created } = await supabase
        .from('user_profiles')
        .insert([{ id: userId, name: '' }])
        .select()
        .single();
      if (created) setProfile(created as UserProfile);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    if (!isAuthorizedEmail(email)) {
      return { error: new Error('Access denied. Your email is not authorized.') };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error as Error | null };
  };

  const createUser = async (email: string, password: string) => {
    if (!isAuthorizedEmail(email)) {
      return { error: new Error('This email is not in the authorized users list.') };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: undefined },
    });
    return { error: error as Error | null };
  };

  const updateProfileName = async (name: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    const trimmed = name.trim();
    const { error } = await supabase
      .from('user_profiles')
      .update({ name: trimmed })
      .eq('id', user.id);
    if (!error) {
      setProfile(prev => prev ? { ...prev, name: trimmed } : prev);
    }
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAuthorized, profile, signIn, signOut, updatePassword, createUser, updateProfileName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
