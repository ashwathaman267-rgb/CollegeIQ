import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { ProfileView } from '@/features/profile/profile-view';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  await requireUser('/profile');
  return <ProfileView />;
}
