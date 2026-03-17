import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const FormsListPage = dynamic(() => import('@/components/FormsListPage'));

export default function FormsPage() {
  return (
    <Suspense>
      <FormsListPage />
    </Suspense>
  );
}
