import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const FormEditorPage = dynamic(() => import('@/components/FormEditorPage'));

export default function FormEditPage() {
  return (
    <Suspense>
      <FormEditorPage />
    </Suspense>
  );
}
