import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const TeamDetailPage = dynamic(() => import('@/components/TeamDetailPage'));

export default function TeamPage() {
  return (
    <Suspense>
      <TeamDetailPage />
    </Suspense>
  );
}
