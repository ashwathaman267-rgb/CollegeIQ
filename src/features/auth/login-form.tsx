'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Wand2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { loginSchema } from '@/validations';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Checkbox, Field, Input } from '@/components/ui/form';
import { PasswordField } from '@/components/auth/password-field';
import { SESSION_KEY } from '@/hooks/use-session';

const DEMO_ACCOUNTS = [
  { role: 'Administrator', email: 'admin@campusiq.edu.in', password: 'Admin@2026' },
  { role: 'Faculty', email: 'priya.menon@campusiq.edu.in', password: 'Faculty@2026' },
  { role: 'Student', email: 'arjun.nair@campusiq.edu.in', password: 'Student@2026' },
];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const next = searchParams.get('next') ?? '/dashboard';

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(true);
  const [errors, setErrors] = React.useState<{ email?: string; password?: string; form?: string }>({});
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    const parsed = loginSchema.safeParse({ email, password, remember });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }

    setPending(true);
    try {
      await api.post('/api/auth/login', parsed.data);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      router.push(next);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed. Please try again.';
      setErrors({ form: message });
      setPassword('');
    } finally {
      setPending(false);
    }
  };

  const fill = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrors({});
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {errors.form ? (
        <Alert tone="danger" title="Sign in failed" icon={<AlertTriangle className="h-4 w-4" />}>
          {errors.form}
        </Alert>
      ) : null}

      <Field label="Email address" htmlFor="email" error={errors.email} required>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          invalid={Boolean(errors.email)}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@campusiq.edu.in"
          disabled={pending}
        />
      </Field>

      <PasswordField
        id="password"
        label="Password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        required
        disabled={pending}
      />

      <div className="flex items-center justify-between gap-3">
        <Checkbox id="remember" label="Keep me signed in" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
        <Link href="/forgot-password" className="rounded text-[0.8125rem] font-medium text-brand underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending} disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
        {pending ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
      </Button>

      <div className="rounded-lg border border-line bg-raised p-3">
        <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-subtle">
          <Wand2 className="h-3.5 w-3.5" aria-hidden />
          Demo accounts
        </p>
        <p className="mt-1 text-xs text-muted">Seeded with a full academic year of data. Click to fill the form.</p>
        <ul className="mt-2 space-y-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => fill(account)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-brand/45 hover:bg-brand-soft/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-medium text-ink">{account.role}</span>
                  <span className="block truncate text-2xs text-muted">{account.email}</span>
                </span>
                <code className="tnum shrink-0 rounded bg-line/60 px-1.5 py-0.5 text-2xs text-muted">{account.password}</code>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
