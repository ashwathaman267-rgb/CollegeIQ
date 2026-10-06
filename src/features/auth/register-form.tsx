'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, UserRound } from 'lucide-react';

import { api } from '@/lib/api-client';
import { registerSchema } from '@/validations';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { PasswordField } from '@/components/auth/password-field';
import { SESSION_KEY } from '@/hooks/use-session';

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

/**
 * Self-service student registration. Role is never chosen by the visitor —
 * every new account is created as a STUDENT and linked to a department.
 */
export function RegisterForm({ departments }: { departments: DepartmentOption[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [values, setValues] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    registerNumber: '',
    departmentId: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const set = (key: keyof typeof values) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }

    setPending(true);
    try {
      await api.post('/api/auth/register', parsed.data);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError ? (
        <Alert tone="danger" title="Could not create your account" icon={<AlertTriangle className="h-4 w-4" />}>
          {formError}
        </Alert>
      ) : null}

      <Alert tone="info" icon={<UserRound className="h-4 w-4" />}>
        New accounts are created as <strong className="font-semibold">students</strong>. Your class and section are assigned by your
        department office — attendance and results appear as soon as they are.
      </Alert>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={errors.firstName} required>
          <Input id="firstName" value={values.firstName} onChange={(e) => set('firstName')(e.target.value)} autoComplete="given-name" invalid={Boolean(errors.firstName)} disabled={pending} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName} required>
          <Input id="lastName" value={values.lastName} onChange={(e) => set('lastName')(e.target.value)} autoComplete="family-name" invalid={Boolean(errors.lastName)} disabled={pending} />
        </Field>
      </div>

      <Field label="Email address" htmlFor="reg-email" error={errors.email} required>
        <Input id="reg-email" type="email" value={values.email} onChange={(e) => set('email')(e.target.value)} autoComplete="email" placeholder="you@campusiq.edu.in" invalid={Boolean(errors.email)} disabled={pending} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Register number" htmlFor="registerNumber" error={errors.registerNumber} required hint="As printed on your college ID">
          <Input id="registerNumber" value={values.registerNumber} onChange={(e) => set('registerNumber')(e.target.value.toUpperCase())} placeholder="22CSE101" invalid={Boolean(errors.registerNumber)} disabled={pending} />
        </Field>
        <Field label="Department" htmlFor="departmentId" error={errors.departmentId} required>
          <Select
            id="departmentId"
            value={values.departmentId}
            onChange={(e) => set('departmentId')(e.target.value)}
            placeholder="Select your department"
            invalid={Boolean(errors.departmentId)}
            disabled={pending}
            options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
          />
        </Field>
      </div>

      <Field label="Phone (optional)" htmlFor="phone" error={errors.phone}>
        <Input id="phone" type="tel" value={values.phone} onChange={(e) => set('phone')(e.target.value)} autoComplete="tel" disabled={pending} />
      </Field>

      <PasswordField
        id="reg-password"
        label="Password"
        value={values.password}
        onChange={set('password')}
        error={errors.password}
        autoComplete="new-password"
        required
        showStrength
        hint="8+ characters with a letter and a number"
        disabled={pending}
      />

      <PasswordField
        id="reg-confirm"
        label="Confirm password"
        value={values.confirmPassword}
        onChange={set('confirmPassword')}
        error={errors.confirmPassword}
        autoComplete="new-password"
        required
        disabled={pending}
      />

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending} disabled={pending}>
        {pending ? 'Creating your account…' : 'Create account'}
        {pending ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
      </Button>
    </form>
  );
}
