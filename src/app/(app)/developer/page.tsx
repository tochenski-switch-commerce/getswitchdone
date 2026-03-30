'use client';

import dynamic from 'next/dynamic';

const DeveloperPage = dynamic(() => import('@/components/DeveloperPage'), {
  ssr: false,
});

export default function DeveloperRoute() {
  return <DeveloperPage />;
}
