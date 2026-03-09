import { Suspense } from 'react';
import TeamsListPage from '@/components/TeamsListPage';

export default function TeamsPage() {
  return (
    <Suspense>
      <TeamsListPage />
    </Suspense>
  );
}
