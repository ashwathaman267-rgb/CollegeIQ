import { redirect } from 'next/navigation';

import { getAuthUser } from '@/server/auth/session';

/**
 * The root route is a router, not a page: signed-in visitors land on their own
 * dashboard, everyone else on the sign-in screen.
 */
export default async function RootPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');
  redirect('/dashboard');
}
