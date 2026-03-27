'use client';

import dynamic from 'next/dynamic';

const TodayPage = dynamic(() => import('@/components/TodayPage'), { ssr: false });

export default function FocusRoute() {
  return <TodayPage />;
}
