import { redirect } from 'next/navigation';

import { getAuthUser } from '@/server/auth/session';

/** Signed-in visitors never see the auth screens. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (user) redirect('/dashboard');
  return <>{children}</>;
}
