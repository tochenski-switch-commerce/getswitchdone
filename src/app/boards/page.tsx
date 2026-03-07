import { Suspense } from 'react';
import BoardsListPage from '@/components/BoardsListPage';

export default function BoardsPage() {
  return (
    <Suspense>
      <BoardsListPage />
    </Suspense>
  );
}
