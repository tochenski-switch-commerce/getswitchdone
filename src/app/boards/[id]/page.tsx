import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import BoardDetailLoading from './loading';

const BoardDetailPage = dynamic(() => import('@/components/BoardDetailPage'), {
  loading: () => <BoardDetailLoading />,
});

export default function BoardPage() {
  return (
    <Suspense fallback={<BoardDetailLoading />}>
      <BoardDetailPage />
    </Suspense>
  );
}
