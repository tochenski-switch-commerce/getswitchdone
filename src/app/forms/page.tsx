import { Suspense } from 'react';
import FormsListPage from '@/components/FormsListPage';

export default function FormsPage() {
  return (
    <Suspense>
      <FormsListPage />
    </Suspense>
  );
}
