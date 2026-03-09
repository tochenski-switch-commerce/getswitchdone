'use client';

import dynamic from 'next/dynamic';

const ProfilePage = dynamic(() => import('@/components/ProfilePage'), {
  ssr: false,
});

export default function ProfileRoute() {
  return <ProfilePage />;
}
