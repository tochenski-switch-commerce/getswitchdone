'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/boards');
      } else {
        router.replace('/auth');
      }
    });
  }, [router]);

  // Dark background matches the app — no visible flash
  return <div style={{ minHeight: '100vh', background: '#0f1117' }} />;
}
