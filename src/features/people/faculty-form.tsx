'use client';

import * as React from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';

import { api } from '@/lib/api-client';
import { toDateInputValue } from '@/lib/format';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/form';
import { PasswordField } from '@/components/auth/password-field';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { facultySchema, facultyUpdateSchema } from '@/validations';

export interface FacultyFormValues {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  departmentId: string;
  designation?: string;
  specialization?: string;
  qualification?: string;
  experienceYears?: number;
  gender?: string;
  joinedOn?: string | null;
  phone?: string;
  subjectIds?: string[];
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
];

const EMPTY: FacultyFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  employeeId: '',
  departmentId: '',
  academicStatus: 'ACTIVE',
  gender: 'UNSPECIFIED',
};

/** Create / edit faculty, including the subjects they are allowed to teach. */
export function FacultyFormDialog({
  open,
  onOpenChange,
  initial,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: FacultyFormValues | null;
  departments: { id: string; name: string; code: string }[];
}) {
  const editing = Boolean(initial?.id);
  const invalidate = useInvalidate();

  const [values, setValues] = React.useState<FacultyFormValues>(initial ?? EMPTY);
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

  const subjects = useApi<{ id: string; code: string; name: string; departmentId: string }[]>(
    '/api/subjects',
    { departmentId: values.departmentId || undefined },
    { enabled: open && Boolean(values.departmentId) },
  );
  const subjectOptions = subjects.data?.data ?? [];

  const set = <K extends keyof FacultyFormValues>(key: K, value: FacultyFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const toggleSubject = (subjectId: string) =>
    set('subjectIds', values.subjectIds?.includes(subjectId) ? values.subjectIds.filter((id) => id !== subjectId) : [...(values.subjectIds ?? []), subjectId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const payload: Record<string, unknown> = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      employeeId: values.employeeId,
      departmentId: values.departmentId,
      designation: values.designation || undefined,
      specialization: values.specialization || undefined,
      qualification: values.qualification || undefined,
      experienceYears: values.experienceYears || undefined,
      gender: values.gender || undefined,
      joinedOn: values.joinedOn ? new Date(`${values.joinedOn}T00:00:00.000Z`) : null,
      phone: values.phone || undefined,
      subjectIds: values.subjectIds ?? [],
      academicStatus: values.academicStatus || undefined,
      ...(editing ? {} : password ? { password } : {}),
    };

    const schema = editing ? facultyUpdateSchema : facultySchema;
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
        await api.patch(`/api/faculty/${initial.id}`, parsed.data);
        toastSuccess('Faculty member updated', 'The change was saved and logged.');
        invalidate('/api/faculty', '/api/analytics');
        onOpenChange(false);
      } else {
        const result = await api.post<{ facultyId: string; temporaryPassword?: string }>('/api/faculty', parsed.data);
        invalidate('/api/faculty', '/api/dashboard', '/api/analytics');
        if (result.data.temporaryPassword) {
          setTemporaryPassword(result.data.temporaryPassword);
          toastSuccess('Faculty member created', 'Copy the temporary password — it is shown only once.');
        } else {
          toastSuccess('Faculty member created', `${values.firstName} ${values.lastName} can now sign in.`);
          onOpenChange(false);
        }
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save that faculty member.');
      toastError(error, 'Could not save that faculty member.');
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
        <DialogContent title="Faculty member created" description="Share these credentials securely. The password is not stored in plain text anywhere.">
          <div className="space-y-4">
            <Alert tone="warning" title="Temporary password — shown once" icon={<AlertTriangle />}>
              <p className="font-mono text-sm font-semibold text-ink">{temporaryPassword}</p>
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
        title={editing ? `Edit ${initial?.firstName ?? ''} ${initial?.lastName ?? ''}`.trim() : 'Add a faculty member'}
        size="lg"
        description={
          editing
            ? 'Subjects here control what they can be scheduled to teach.'
            : 'A login account is created with the faculty role. Leave the password blank to generate a temporary one.'
        }
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="f-first" required error={errors.firstName}>
              <Input id="f-first" value={values.firstName} invalid={Boolean(errors.firstName)} onChange={(e) => set('firstName', e.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="f-last" required error={errors.lastName}>
              <Input id="f-last" value={values.lastName} invalid={Boolean(errors.lastName)} onChange={(e) => set('lastName', e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="f-email" required error={errors.email} hint="Used to sign in.">
              <Input id="f-email" type="email" value={values.email} invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Employee ID" htmlFor="f-employee" required error={errors.employeeId}>
              <Input id="f-employee" value={values.employeeId} invalid={Boolean(errors.employeeId)} onChange={(e) => set('employeeId', e.target.value.toUpperCase())} />
            </Field>
            <Field label="Department" htmlFor="f-dept" required error={errors.departmentId}>
              <Select
                id="f-dept"
                value={values.departmentId}
                invalid={Boolean(errors.departmentId)}
                onChange={(e) => {
                  set('departmentId', e.target.value);
                  set('subjectIds', []);
                }}
                placeholder="Select a department"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>
            <Field label="Designation" htmlFor="f-designation" error={errors.designation}>
              <Input id="f-designation" value={values.designation ?? ''} onChange={(e) => set('designation', e.target.value)} placeholder="Assistant Professor" />
            </Field>
            <Field label="Specialization" htmlFor="f-specialization" error={errors.specialization}>
              <Input id="f-specialization" value={values.specialization ?? ''} onChange={(e) => set('specialization', e.target.value)} />
            </Field>
            <Field label="Qualification" htmlFor="f-qualification" error={errors.qualification}>
              <Input id="f-qualification" value={values.qualification ?? ''} onChange={(e) => set('qualification', e.target.value)} placeholder="M.Tech, Ph.D." />
            </Field>
            <Field label="Experience (years)" htmlFor="f-experience" error={errors.experienceYears}>
              <Input
                id="f-experience"
                type="number"
                min={0}
                max={60}
                value={values.experienceYears ?? ''}
                onChange={(e) => set('experienceYears', e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>
            <Field label="Joined on" htmlFor="f-joined" error={errors.joinedOn}>
              <Input
                id="f-joined"
                type="date"
                value={values.joinedOn ? toDateInputValue(values.joinedOn) : ''}
                onChange={(e) => set('joinedOn', e.target.value || null)}
              />
            </Field>
            <Field label="Phone" htmlFor="f-phone" error={errors.phone}>
              <Input id="f-phone" type="tel" value={values.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Status" htmlFor="f-status" error={errors.academicStatus}>
              <Select id="f-status" value={values.academicStatus ?? 'ACTIVE'} onChange={(e) => set('academicStatus', e.target.value)} options={STATUSES} />
            </Field>
          </div>

          <Field label="Subjects taught" hint="Select the subjects this faculty member can teach. Timetable generation only schedules people for subjects they own." error={errors.subjectIds}>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-line bg-raised p-2.5">
              {subjectOptions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted">{values.departmentId ? 'No subjects in that department yet.' : 'Choose a department first.'}</p>
              ) : (
                subjectOptions.map((subject) => (
                  <Checkbox
                    key={subject.id}
                    id={`f-subject-${subject.id}`}
                    label={`${subject.code} · ${subject.name}`}
                    checked={values.subjectIds?.includes(subject.id) ?? false}
                    onCheckedChange={() => toggleSubject(subject.id)}
                  />
                ))
              )}
            </div>
          </Field>

          {!editing ? (
            <PasswordField
              id="f-password"
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
              {editing ? 'Save changes' : 'Create faculty member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
