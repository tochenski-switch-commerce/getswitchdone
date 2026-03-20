'use client';

import dynamic from 'next/dynamic';

const CalendarPage = dynamic(() => import('@/components/CalendarPage'), {
  ssr: false,
});

export default function CalendarRoute() {
  return <CalendarPage />;
}
