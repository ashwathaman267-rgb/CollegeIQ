import { Suspense } from 'react';
import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/features/auth/login-form';
import { Skeleton } from '@/components/ui/states';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <AuthShell title="Sign in to CampusIQ" subtitle="Attendance, timetables, academics, results and career readiness — one account.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
