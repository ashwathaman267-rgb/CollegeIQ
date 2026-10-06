'use client';

import * as React from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';

import { api } from '@/lib/api-client';
import { toDateInputValue } from '@/lib/format';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { PasswordField } from '@/components/auth/password-field';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { studentSchema, studentUpdateSchema } from '@/validations';

interface ClassOption {
  id: string;
  name: string;
  semester: number;
  departmentId: string;
}

export interface StudentFormValues {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  registerNumber: string;
  rollNumber?: string;
  departmentId: string;
  classId?: string | null;
  semester?: number;
  admissionYear?: number;
  gender?: string;
  dateOfBirth?: string | null;
  phone?: string;
  address?: string;
  city?: string;
  guardianName?: string;
  guardianPhone?: string;
  bloodGroup?: string;
  batch?: string;
  cgpa?: number | null;
  academicStatus?: string;
}

const GENDERS = [
  { value: 'UNSPECIFIED', label: 'Not specified' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'GRADUATED', label: 'Graduated' },
];

const EMPTY: StudentFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  registerNumber: '',
  departmentId: '',
  classId: null,
  academicStatus: 'ACTIVE',
  gender: 'UNSPECIFIED',
};

/**
 * Create / edit a student.
 *
 * On create the server generates a temporary password when none is supplied;
 * it is shown exactly once so the administrator can hand it over.
 */
export function StudentFormDialog({
  open,
  onOpenChange,
  initial,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: StudentFormValues | null;
  departments: { id: string; name: string; code: string }[];
}) {
  const editing = Boolean(initial?.id);
  const invalidate = useInvalidate();

  const [values, setValues] = React.useState<StudentFormValues>(initial ?? EMPTY);
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [temporaryPassword, setTemporaryPassword] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setValues(initial ?? EMPTY);
    setPassword('');
    setErrors({});
    setFormError(null);
    setTemporaryPassword(null);
    setCopied(false);
  }, [open, initial]);

  const classes = useApi<{ classes: ClassOption[] }>(
    '/api/classes',
    { departmentId: values.departmentId || undefined },
    { enabled: open && Boolean(values.departmentId) },
  );
  const classOptions = (classes.data?.data?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · semester ${c.semester}` }));

  const set = <K extends keyof StudentFormValues>(key: K, value: StudentFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const payload: Record<string, unknown> = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      registerNumber: values.registerNumber,
      rollNumber: values.rollNumber || undefined,
      departmentId: values.departmentId,
      classId: values.classId || null,
      semester: values.semester || undefined,
      admissionYear: values.admissionYear || undefined,
      gender: values.gender || undefined,
      dateOfBirth: values.dateOfBirth ? new Date(`${values.dateOfBirth}T00:00:00.000Z`) : null,
      phone: values.phone || undefined,
      address: values.address || undefined,
      city: values.city || undefined,
      guardianName: values.guardianName || undefined,
      guardianPhone: values.guardianPhone || undefined,
      bloodGroup: values.bloodGroup || undefined,
      batch: values.batch || undefined,
      cgpa: values.cgpa === null || values.cgpa === undefined || Number.isNaN(values.cgpa) ? null : Number(values.cgpa),
      academicStatus: values.academicStatus || undefined,
      ...(editing ? {} : password ? { password } : {}),
    };

    const schema = editing ? studentUpdateSchema : studentSchema;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) issues[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(issues);
      return;
    }

    setBusy(true);
    try {
      if (editing && initial?.id) {
        await api.patch(`/api/students/${initial.id}`, parsed.data);
        toastSuccess('Student updated', `${values.firstName} ${values.lastName}'s record was saved.`);
        invalidate('/api/students', '/api/dashboard', '/api/analytics');
        onOpenChange(false);
      } else {
        const result = await api.post<{ studentId: string; temporaryPassword?: string }>('/api/students', parsed.data);
        invalidate('/api/students', '/api/dashboard', '/api/analytics');
        if (result.data.temporaryPassword) {
          setTemporaryPassword(result.data.temporaryPassword);
          toastSuccess('Student created', 'Copy the temporary password — it is shown only once.');
        } else {
          toastSuccess('Student created', `${values.firstName} ${values.lastName} can now sign in.`);
          onOpenChange(false);
        }
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save that student.');
      toastError(error, 'Could not save that student.');
    } finally {
      setBusy(false);
    }
  };

  const copyPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError(new Error('Clipboard unavailable'), 'Select the password and copy it manually.');
    }
  };

  if (temporaryPassword) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Student created" description="Share these credentials securely. The password is not stored in plain text anywhere.">
          <div className="space-y-4">
            <Alert tone="warning" title="Temporary password — shown once" icon={<AlertTriangle />}>
              <p className="font-mono text-sm font-semibold text-ink">{temporaryPassword}</p>
              <p className="mt-1">
                {values.email} can sign in with this password and must change it from Profile. The account is unlocked if they
                mistype it five times.
              </p>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => void copyPassword()}>
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? 'Copied' : 'Copy password'}
              </Button>
              <Button variant="primary" size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? `Edit ${initial?.firstName ?? ''} ${initial?.lastName ?? ''}`.trim() : 'Add a student'}
        size="lg"
        description={
          editing
            ? 'Changes are written immediately and recorded in the audit log.'
            : 'A login account is created with the student role. Leave the password blank to generate a temporary one.'
        }
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="s-first" required error={errors.firstName}>
              <Input id="s-first" value={values.firstName} invalid={Boolean(errors.firstName)} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Last name" htmlFor="s-last" required error={errors.lastName}>
              <Input id="s-last" value={values.lastName} invalid={Boolean(errors.lastName)} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Email" htmlFor="s-email" required error={errors.email} hint="Used to sign in.">
              <Input id="s-email" type="email" value={values.email} invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Phone" htmlFor="s-phone" error={errors.phone}>
              <Input id="s-phone" type="tel" value={values.phone ?? ''} invalid={Boolean(errors.phone)} onChange={(e) => set('phone', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Register number" htmlFor="s-register" required error={errors.registerNumber} hint="University register number, e.g. 22CS041.">
              <Input
                id="s-register"
                value={values.registerNumber}
                invalid={Boolean(errors.registerNumber)}
                onChange={(e) => set('registerNumber', e.target.value.toUpperCase())}
                autoComplete="off"
              />
            </Field>
            <Field label="Roll number" htmlFor="s-roll" error={errors.rollNumber} hint="Class roll number (optional).">
              <Input id="s-roll" value={values.rollNumber ?? ''} onChange={(e) => set('rollNumber', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Department" htmlFor="s-dept" required error={errors.departmentId}>
              <Select
                id="s-dept"
                value={values.departmentId}
                invalid={Boolean(errors.departmentId)}
                onChange={(e) => {
                  set('departmentId', e.target.value);
                  set('classId', null);
                }}
                placeholder="Select a department"
                options={departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
              />
            </Field>
            <Field label="Class" htmlFor="s-class" error={errors.classId} hint={values.departmentId ? undefined : 'Choose a department first.'}>
              <Select
                id="s-class"
                value={values.classId ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  set('classId', value || null);
                  const found = (classes.data?.data?.classes ?? []).find((c) => c.id === value);
                  if (found && !values.semester) set('semester', found.semester);
                }}
                disabled={!values.departmentId || classes.isLoading}
                placeholder="Not assigned"
                options={classOptions}
              />
            </Field>
            <Field label="Semester" htmlFor="s-semester" error={errors.semester}>
              <Input
                id="s-semester"
                type="number"
                min={1}
                max={12}
                value={values.semester ?? ''}
                onChange={(e) => set('semester', e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>
            <Field label="Admission year" htmlFor="s-year" error={errors.admissionYear}>
              <Input
                id="s-year"
                type="number"
                min={1980}
                max={2100}
                value={values.admissionYear ?? ''}
                onChange={(e) => set('admissionYear', e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>
            <Field label="Gender" htmlFor="s-gender">
              <Select id="s-gender" value={values.gender ?? 'UNSPECIFIED'} onChange={(e) => set('gender', e.target.value)} options={GENDERS} />
            </Field>
            <Field label="Date of birth" htmlFor="s-dob" error={errors.dateOfBirth}>
              <Input
                id="s-dob"
                type="date"
                value={values.dateOfBirth ? toDateInputValue(values.dateOfBirth) : ''}
                onChange={(e) => set('dateOfBirth', e.target.value || null)}
              />
            </Field>
            <Field label="Address" htmlFor="s-address" error={errors.address}>
              <Input id="s-address" value={values.address ?? ''} onChange={(e) => set('address', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="City" htmlFor="s-city" error={errors.city}>
              <Input id="s-city" value={values.city ?? ''} onChange={(e) => set('city', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Guardian name" htmlFor="s-guardian" error={errors.guardianName}>
              <Input id="s-guardian" value={values.guardianName ?? ''} onChange={(e) => set('guardianName', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Guardian phone" htmlFor="s-guardian-phone" error={errors.guardianPhone}>
              <Input id="s-guardian-phone" type="tel" value={values.guardianPhone ?? ''} onChange={(e) => set('guardianPhone', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Blood group" htmlFor="s-blood" error={errors.bloodGroup}>
              <Input id="s-blood" value={values.bloodGroup ?? ''} onChange={(e) => set('bloodGroup', e.target.value.toUpperCase())} maxLength={8} autoComplete="off" />
            </Field>
            <Field label="Batch" htmlFor="s-batch" error={errors.batch}>
              <Input id="s-batch" value={values.batch ?? ''} onChange={(e) => set('batch', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="CGPA" htmlFor="s-cgpa" error={errors.cgpa} hint="0–10, updated from results.">
              <Input
                id="s-cgpa"
                type="number"
                step="0.01"
                min={0}
                max={10}
                value={values.cgpa ?? ''}
                onChange={(e) => set('cgpa', e.target.value === '' ? null : Number(e.target.value))}
              />
            </Field>
            <Field label="Academic status" htmlFor="s-status" error={errors.academicStatus}>
              <Select id="s-status" value={values.academicStatus ?? 'ACTIVE'} onChange={(e) => set('academicStatus', e.target.value)} options={STATUSES} />
            </Field>
          </div>

          {!editing ? (
            <PasswordField
              id="s-password"
              label="Temporary password"
              hint="Optional — leave blank to generate a strong one and show it once."
              error={errors.password}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Generated if left blank"
              showStrength
            />
          ) : null}

          {formError ? (
            <p className="field-error" role="alert">
              {formError}
            </p>
          ) : null}

          <DialogFooter className="-mx-5 -mb-4 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              {editing ? 'Save changes' : 'Create student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
