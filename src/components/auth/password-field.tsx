'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Field } from '@/components/ui/form';

export interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: React.ReactNode;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showStrength?: boolean;
}

function strengthOf(value: string) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_LABEL = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_TONE = ['bg-danger', 'bg-danger', 'bg-warn', 'bg-info', 'bg-ok'];

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete = 'current-password',
  placeholder = '••••••••',
  required,
  disabled,
  showStrength,
}: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false);
  const strength = strengthOf(value);

  return (
    <Field label={label} htmlFor={id} error={error} required={required} hint={!showStrength ? hint : undefined}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error) || undefined}
          className={cn('input pr-10', error && 'border-danger')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-subtle transition-colors hover:bg-line/60 hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && value ? (
        <div className="mt-2 space-y-1">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className={cn('h-1 flex-1 rounded-full transition-colors', index < strength ? STRENGTH_TONE[strength] : 'bg-line')} />
            ))}
          </div>
          <p className="text-2xs text-muted">
            Password strength: <span className="font-semibold text-ink">{STRENGTH_LABEL[strength]}</span>
            {hint ? <> · {hint}</> : null}
          </p>
        </div>
      ) : null}
    </Field>
  );
}
