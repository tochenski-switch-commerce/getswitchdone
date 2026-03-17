import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const TeamsListPage = dynamic(() => import('@/components/TeamsListPage'));

export default function TeamsPage() {
  return (
    <Suspense>
      <TeamsListPage />
    </Suspense>
  );
}
