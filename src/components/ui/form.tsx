'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <LabelPrimitive.Label htmlFor={htmlFor} className="field-label">
          {label}
          {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
        </LabelPrimitive.Label>
      ) : null}
      {children}
      {error ? (
        <p className="field-error" role="alert">
          <X className="h-3 w-3" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn('input', className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn('input resize-y leading-relaxed', className)} {...props} />;
  },
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: (SelectOption | string)[];
  placeholder?: string;
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className, invalid, ...props },
  ref,
) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={cn('select', className)} {...props}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => {
        const o = typeof option === 'string' ? { value: option, label: option } : option;
        return (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        );
      })}
    </select>
  );
});

export interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'onCheckedChange'> {
  label?: React.ReactNode;
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;
}

export function Checkbox({ className, label, checked, indeterminate, onCheckedChange, id, ...props }: CheckboxProps) {
  const state = indeterminate ? 'indeterminate' : checked ? true : false;
  const box = (
    <CheckboxPrimitive.Root
      id={id}
      checked={state}
      onCheckedChange={onCheckedChange}
      className={cn(
        'grid h-[1.1rem] w-[1.1rem] shrink-0 place-items-center rounded border border-line-strong bg-surface text-brand-fg',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center">
        {state === 'indeterminate' ? <Minus className="h-3 w-3" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return box;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-ink select-none">
      {box}
      <span>{label}</span>
    </label>
  );
}

export interface SwitchProps extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, 'onCheckedChange'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({ className, label, description, id, onCheckedChange, ...props }: SwitchProps) {
  const control = (
    <SwitchPrimitive.Root
      id={id}
      onCheckedChange={onCheckedChange}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
        'data-[state=checked]:bg-brand data-[state=unchecked]:bg-line-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.15rem]" />
    </SwitchPrimitive.Root>
  );

  if (!label) return control;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

/** Search box with an inline clear button; debounce at the call site. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onValueChange, placeholder = 'Search…', className, ...props },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onValueChange('')}
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-subtle transition-colors hover:bg-line/60 hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
});

/** Segmented control for small, mutually exclusive choices (e.g. theme, view). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5 rounded-md border border-line bg-raised p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded font-medium transition-all duration-150',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[0.8125rem]',
              active ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            {option.icon ? <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>{option.icon}</span> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
