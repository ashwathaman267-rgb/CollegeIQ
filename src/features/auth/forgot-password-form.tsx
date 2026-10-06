'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';

import { api } from '@/lib/api-client';
import { forgotPasswordSchema } from '@/validations';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';

interface ResetResponse {
  sent: boolean;
  expiresAt: string;
  devToken?: string;
}

/**
 * Password reset request.
 *
 * CampusIQ ships without an email transport, so in development the generated
 * token is shown on screen and the same response is returned for unknown
 * addresses (the endpoint cannot be used to enumerate accounts).
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<ResetResponse | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email address.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await api.post<ResetResponse>('/api/auth/forgot-password', parsed.data);
      setResult(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link.');
    } finally {
      setPending(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Check your inbox" icon={<CheckCircle2 className="h-4 w-4" />}>
          If an account exists for <strong className="font-semibold">{email}</strong>, a reset link is on its way. The link expires
          at {new Date(result.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
        </Alert>

        {result.devToken ? (
          <Alert tone="warning" title="Development mode — no mail transport configured" icon={<KeyRound className="h-4 w-4" />}>
            <p>
              Set an SMTP relay in production to email this link. For now, continue straight to the reset form:
            </p>
            <Link
              href={`/reset-password?token=${encodeURIComponent(result.devToken)}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-warn/40 bg-surface px-2.5 py-1.5 text-xs font-semibold text-warn-fg transition-colors hover:bg-warn-soft"
            >
              Open reset form with this token
            </Link>
          </Alert>
        ) : null}

        <Button variant="ghost" size="sm" asChild>
          <Link href="/login">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error ? <Alert tone="danger" title="Could not send the link">{error}</Alert> : null}
      <Field label="Email address" htmlFor="forgot-email" error={error} required hint="We will send a single-use reset link.">
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@campusiq.edu.in"
          invalid={Boolean(error)}
          disabled={pending}
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending} disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
