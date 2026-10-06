'use client';

import * as React from 'react';
import { Library, Pencil, Plus, Trash2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { useApi, useDebouncedValue, useInvalidate } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, SearchInput, Select, Textarea } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { DataTable, type Column } from '@/components/ui/table';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { subjectTypeEnum } from '@/validations';

const SUBJECT_TYPES = subjectTypeEnum.options.map((value) => ({ value, label: value.replace(/_/g, ' ').toLowerCase() }));

interface SubjectRow {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  subjectType: string;
  semester: number;
  credits: number;
  weeklyPeriods: number;
  periodsPerSession: number;
  maxIaMarks: number;
  maxTheoryMarks: number;
  passMarks: number;
  departmentId: string;
  departmentName: string;
  classCount: number;
  faculty: { id: string; name: string; classId: string | null }[];
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

/**
 * Course catalogue. Subject settings (periods per week, IA max marks, pass
 * marks) drive the timetable generator and mark entry, so edits apply from
 * the next generated timetable / next exam.
 */
export function SubjectsView() {
  const { user } = useSession();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [semester, setSemester] = React.useState('');
  const [subjectType, setSubjectType] = React.useState('');
  const debounced = useDebouncedValue(search, 300);

  const subjects = useApi<SubjectRow[]>('/api/subjects', {
    search: debounced || undefined,
    departmentId: departmentId || undefined,
    semester: semester || undefined,
    subjectType: subjectType || undefined,
  });
  const departments = useApi<DepartmentOption[]>('/api/departments');

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SubjectRow | null>(null);
  const [deleting, setDeleting] = React.useState<SubjectRow | null>(null);
  const invalidate = useInvalidate();

  const rows = subjects.data?.data ?? [];

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/api/subjects/${deleting.id}`);
      invalidate('/api/subjects', '/api/analytics');
      toastSuccess('Subject deleted', `${deleting.code} was removed from the catalogue.`);
    } catch (error) {
      toastError(error, 'That subject is still in use, so it could not be deleted.');
    } finally {
      setDeleting(null);
    }
  };

  const columns: Column<SubjectRow>[] = [
    {
      key: 'code',
      header: 'Code',
      label: 'Code',
      cell: (row) => <span className="tnum text-sm font-semibold text-ink">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Subject',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          <p className="truncate text-xs text-muted">{row.departmentName}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      label: 'Type',
      cell: (row) => <Badge tone={row.subjectType === 'LABORATORY' ? 'info' : 'neutral'}>{row.subjectType.replace(/_/g, ' ').toLowerCase()}</Badge>,
    },
    {
      key: 'semester',
      header: 'Sem',
      align: 'center',
      label: 'Semester',
      cell: (row) => <span className="tnum text-sm text-muted">{row.semester}</span>,
    },
    {
      key: 'schedule',
      header: 'Schedule',
      label: 'Schedule',
      hideOnMobile: true,
      cell: (row) => (
        <span className="tnum text-xs text-muted">
          {row.weeklyPeriods} wk × {row.periodsPerSession} per session
        </span>
      ),
    },
    {
      key: 'marks',
      header: 'Marks',
      label: 'Marks',
      hideOnMobile: true,
      cell: (row) => (
        <span className="tnum text-xs text-muted">
          IA {row.maxIaMarks} · Theory {row.maxTheoryMarks} · Pass {row.passMarks}
        </span>
      ),
    },
    {
      key: 'fac',
      header: 'Faculty',
      label: 'Assigned faculty',
      cell: (row) =>
        row.faculty.length === 0 ? (
          <span className="text-xs text-subtle">Unassigned</span>
        ) : (
          <span className="text-xs text-muted">
            {row.faculty.slice(0, 2).map((f) => f.name.split(' ')[0]).join(', ')}
            {row.faculty.length > 2 ? ` +${row.faculty.length - 2}` : ''}
          </span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hideOnMobile: true,
      cell: (row) =>
        isAdmin ? (
          <div className="flex items-center justify-end gap-1">
            <Button size="xs" variant="ghost" onClick={() => setEditing(row)} aria-label={`Edit ${row.name}`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button size="xs" variant="ghost" className="text-danger-fg hover:text-danger" onClick={() => setDeleting(row)} aria-label={`Delete ${row.name}`}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        ) : null,
    },
  ];

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Subjects"
        description="The course catalogue: codes, weekly periods, mark schemes and faculty assignments. The timetable generator reads these directly."
        icon={<Library />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Subjects' }]}
        actions={
          isAdmin ? (
            <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add subject
            </Button>
          ) : null
        }
      />

      <div className="mt-5 space-y-4">
        <Panel>
          <PanelBody className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-52 flex-1">
              <label htmlFor="sub-search" className="field-label">
                Search
              </label>
              <SearchInput id="sub-search" value={search} onValueChange={setSearch} placeholder="Code or name…" />
            </div>
            <div className="sm:w-56">
              <label htmlFor="sub-dept" className="field-label">
                Department
              </label>
              <Select
                id="sub-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                placeholder="All departments"
                options={(departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            </div>
            <div className="sm:w-32">
              <label htmlFor="sub-sem" className="field-label">
                Semester
              </label>
              <Select
                id="sub-sem"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="Any"
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Sem ${i + 1}` }))}
              />
            </div>
            <div className="sm:w-44">
              <label htmlFor="sub-type" className="field-label">
                Type
              </label>
              <Select id="sub-type" value={subjectType} onChange={(e) => setSubjectType(e.target.value)} placeholder="Any type" options={SUBJECT_TYPES} />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Course catalogue" subtitle={subjects.data ? `${rows.length} subject${rows.length === 1 ? '' : 's'}` : undefined} />
          <PanelBody>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              loading={subjects.isLoading}
              error={subjects.error}
              onRetry={() => subjects.refetch()}
              caption="Subjects matching the current filters"
              empty={{
                title: 'No subjects match',
                description: 'Adjust the filters, or add the first subject to this department.',
                icon: <Library />,
              }}
            />
          </PanelBody>
        </Panel>
      </div>

      <SubjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        departments={departments.data?.data ?? []}
        onSaved={() => {
          invalidate('/api/subjects', '/api/analytics');
          setFormOpen(false);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.code}?` : 'Delete subject'}
        description={
          deleting
            ? `Currently in ${deleting.classCount} class(es) with ${deleting.faculty.length} faculty assignment(s). Deletion is refused while it is still referenced.`
            : undefined
        }
        confirmLabel="Delete subject"
        onConfirm={doDelete}
      />
    </>
  );
}

function SubjectFormDialog({
  open,
  onOpenChange,
  initial,
  departments,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: SubjectRow | null;
  departments: DepartmentOption[];
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setValues(
      initial
        ? {
            code: initial.code,
            name: initial.name,
            shortName: initial.shortName ?? '',
            departmentId: initial.departmentId,
            subjectType: initial.subjectType,
            semester: String(initial.semester),
            credits: String(initial.credits),
            weeklyPeriods: String(initial.weeklyPeriods),
            periodsPerSession: String(initial.periodsPerSession),
            maxIaMarks: String(initial.maxIaMarks),
            maxTheoryMarks: String(initial.maxTheoryMarks),
            passMarks: String(initial.passMarks),
          }
        : {
            code: '',
            name: '',
            shortName: '',
            departmentId: '',
            subjectType: 'THEORY',
            semester: '1',
            credits: '3',
            weeklyPeriods: '4',
            periodsPerSession: '1',
            maxIaMarks: '50',
            maxTheoryMarks: '100',
            passMarks: '50',
          },
    );
    setErrors({});
    setFormError(null);
  }, [open, initial]);

  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const payload = {
      code: values.code,
      name: values.name,
      shortName: values.shortName?.trim() || undefined,
      description: undefined,
      departmentId: values.departmentId,
      subjectType: values.subjectType,
      semester: Number(values.semester),
      credits: Number(values.credits),
      weeklyPeriods: Number(values.weeklyPeriods),
      periodsPerSession: Number(values.periodsPerSession),
      maxIaMarks: Number(values.maxIaMarks),
      maxTheoryMarks: Number(values.maxTheoryMarks),
      passMarks: Number(values.passMarks),
    };

    setBusy(true);
    try {
      if (initial?.id) {
        await api.patch(`/api/subjects/${initial.id}`, payload);
        toastSuccess('Subject updated', `${payload.code} was saved.`);
      } else {
        await api.post('/api/subjects', payload);
        toastSuccess('Subject created', `${payload.code} joined the catalogue.`);
      }
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save that subject.');
      toastError(error, 'Could not save that subject.');
    } finally {
      setBusy(false);
    }
  };

  const num = (key: string) => (
    <Input
      id={`sub-${key}`}
      type="number"
      min={0}
      value={values[key] ?? ''}
      invalid={Boolean(errors[key])}
      onChange={(e) => set(key, e.target.value)}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={initial ? `Edit ${initial.code}` : 'Add a subject'}
        size="lg"
        description="Weekly periods and periods-per-session determine how the timetable generator places this subject."
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Code" htmlFor="sub-code" required error={errors.code}>
              <Input id="sub-code" value={values.code ?? ''} invalid={Boolean(errors.code)} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="CS302" />
            </Field>
            <Field label="Name" htmlFor="sub-name" required error={errors.name} className="sm:col-span-2">
              <Input id="sub-name" value={values.name ?? ''} invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} placeholder="Database Systems" />
            </Field>
            <Field label="Department" htmlFor="sub-dept" required error={errors.departmentId} className="sm:col-span-2">
              <Select
                id="sub-dept"
                value={values.departmentId ?? ''}
                invalid={Boolean(errors.departmentId)}
                onChange={(e) => set('departmentId', e.target.value)}
                placeholder="Select a department"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>
            <Field label="Type" htmlFor="sub-type" error={errors.subjectType}>
              <Select id="sub-type" value={values.subjectType ?? 'THEORY'} onChange={(e) => set('subjectType', e.target.value)} options={SUBJECT_TYPES} />
            </Field>
            <Field label="Semester" htmlFor="sub-semester" error={errors.semester}>
              {num('semester')}
            </Field>
            <Field label="Credits" htmlFor="sub-credits" error={errors.credits}>
              {num('credits')}
            </Field>
            <Field label="Periods / week" htmlFor="sub-weekly" error={errors.weeklyPeriods}>
              {num('weeklyPeriods')}
            </Field>
            <Field label="Periods / session" htmlFor="sub-pps" error={errors.periodsPerSession} hint="Labs usually run 2 back-to-back.">
              {num('periodsPerSession')}
            </Field>
            <Field label="Max IA marks" htmlFor="sub-ia" error={errors.maxIaMarks}>
              {num('maxIaMarks')}
            </Field>
            <Field label="Max theory marks" htmlFor="sub-theory" error={errors.maxTheoryMarks}>
              {num('maxTheoryMarks')}
            </Field>
            <Field label="Pass marks" htmlFor="sub-pass" error={errors.passMarks}>
              {num('passMarks')}
            </Field>
          </div>
          <Field label="Short name" htmlFor="sub-short" error={errors.shortName} hint="Optional — used where space is tight.">
            <Input id="sub-short" value={values.shortName ?? ''} onChange={(e) => set('shortName', e.target.value)} maxLength={20} />
          </Field>

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
              {initial ? 'Save changes' : 'Create subject'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
