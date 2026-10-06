'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { resetPasswordSchema } from '@/validations';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { PasswordField } from '@/components/auth/password-field';

export function ResetPasswordForm({ initialToken }: { initialToken?: string }) {
  const router = useRouter();
  const [token, setToken] = React.useState(initialToken ?? '');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse({ token: token.trim(), password, confirmPassword });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await api.post('/api/auth/reset-password', parsed.data);
      setDone(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'That reset link did not work.');
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Password updated" icon={<CheckCircle2 className="h-4 w-4" />}>
          Every other signed-in session was revoked. Sign in with your new password to continue.
        </Alert>
        <Button variant="primary" size="lg" className="w-full" onClick={() => router.push('/login')}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError ? <Alert tone="danger" title="Could not reset your password">{formError}</Alert> : null}

      <Field label="Reset token" htmlFor="token" error={errors.token} required hint="Copied from the reset link in your email.">
        <Input id="token" value={token} onChange={(event) => setToken(event.target.value)} invalid={Boolean(errors.token)} disabled={pending} spellCheck={false} />
      </Field>

      <PasswordField
        id="new-password"
        label="New password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        autoComplete="new-password"
        required
        showStrength
        hint="8+ characters with a letter and a number"
        disabled={pending}
      />

      <PasswordField
        id="confirm-new-password"
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={errors.confirmPassword}
        autoComplete="new-password"
        required
        disabled={pending}
      />

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending} disabled={pending}>
        {pending ? 'Updating…' : 'Update password'}
      </Button>

      <Button type="button" variant="ghost" size="sm" className="w-full justify-center" asChild>
        <Link href="/forgot-password">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Request a new link
        </Link>
      </Button>
    </form>
  );
}
