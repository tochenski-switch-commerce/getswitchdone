import { Suspense } from 'react';
import TeamDetailPage from '@/components/TeamDetailPage';

export default function TeamPage() {
  return (
    <Suspense>
      <TeamDetailPage />
    </Suspense>
  );
}
