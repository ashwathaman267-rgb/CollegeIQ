import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="Enter the email address on your CampusIQ account and we will send a single-use reset link.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
