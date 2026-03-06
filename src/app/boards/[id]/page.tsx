import { Suspense } from 'react';
import BoardDetailPage from '@/components/BoardDetailPage';

export default function BoardPage() {
  return (
    <Suspense>
      <BoardDetailPage />
    </Suspense>
  );
}
