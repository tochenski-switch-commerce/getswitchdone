import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import BoardsLoading from './loading';

const BoardsListPage = dynamic(() => import('@/components/BoardsListPage'), {
  loading: () => <BoardsLoading />,
});

export default function BoardsPage() {
  return (
    <Suspense fallback={<BoardsLoading />}>
      <BoardsListPage />
    </Suspense>
  );
}
