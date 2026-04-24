'use client';

import dynamic from 'next/dynamic';

const WatchingPage = dynamic(() => import('@/components/WatchingPage'), { ssr: false });

export default function WatchingRoute() {
  return <WatchingPage />;
}
