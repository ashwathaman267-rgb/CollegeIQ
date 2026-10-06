import { Suspense } from 'react';
import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';
import { Skeleton } from '@/components/ui/states';

export const metadata: Metadata = { title: 'Choose a new password' };
export const dynamic = 'force-dynamic';

function Form({ token }: { token?: string }) {
  return <ResetPasswordForm initialToken={token} />;
}

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <AuthShell title="Choose a new password" subtitle="Reset links are single-use and expire after an hour. All other sessions are signed out when you save.">
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <Form token={searchParams.token} />
      </Suspense>
    </AuthShell>
  );
}
