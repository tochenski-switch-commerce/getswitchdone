import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const BoardOverviewPage = dynamic(() => import('@/components/BoardOverviewPage'), {
  loading: () => <div style={{ minHeight: '100vh', background: '#0f1117' }} />,
});

export default function BoardOverviewRoute() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f1117' }} />}>
      <BoardOverviewPage />
    </Suspense>
  );
}
