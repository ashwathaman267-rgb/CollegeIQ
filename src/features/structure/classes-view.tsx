'use client';

import * as React from 'react';
import { CalendarRange, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { toDateInputValue } from '@/lib/format';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { DataTable, type Column } from '@/components/ui/table';
import { toastError, toastSuccess } from '@/components/ui/toaster';

interface ClassRow {
  id: string;
  name: string;
  yearOfStudy: number;
  section: string;
  semester: number;
  departmentId: string;
  departmentName: string;
  academicYearId: string;
  academicYearName: string;
  studentCount: number;
  timetableCount: number;
  subjects: { id: string; code: string; name: string; weeklyPeriods: number; subjectType: string }[];
  weeklyPeriodTotal: number;
}

interface AcademicYearRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface SubjectOption {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  semester: number;
}

/**
 * Cohorts: a class is a department + academic year + year of study + section,
 * with a set of subjects (the curriculum). Students attach to a class.
 */
export function ClassesView() {
  const { user, academic } = useSession();
  const isAdmin = user?.role === 'ADMIN';

  const [departmentId, setDepartmentId] = React.useState('');
  const [yearOfStudy, setYearOfStudy] = React.useState('');

  const data = useApi<{ classes: ClassRow[]; academicYears: AcademicYearRow[] }>(
    '/api/classes',
    { departmentId: departmentId || undefined, yearOfStudy: yearOfStudy || undefined },
  );
  const departments = useApi<DepartmentOption[]>('/api/departments');
  const subjects = useApi<SubjectOption[]>('/api/subjects', {
    departmentId: departmentId || undefined,
  });

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ClassRow | null>(null);
  const [deleting, setDeleting] = React.useState<ClassRow | null>(null);
  const [yearOpen, setYearOpen] = React.useState(false);
  const invalidate = useInvalidate();

  const rows = data.data?.data?.classes ?? [];
  const years = data.data?.data?.academicYears ?? [];

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/api/classes/${deleting.id}`);
      invalidate('/api/classes', '/api/analytics');
      toastSuccess('Class deleted', `${deleting.name} was removed.`);
    } catch (error) {
      toastError(error, 'That class still has students, so it could not be deleted.');
    } finally {
      setDeleting(null);
    }
  };

  const setCurrentYear = async (year: AcademicYearRow) => {
    try {
      await api.post('/api/academic-years', { id: year.id });
      invalidate('/api/classes', '/api/dashboard');
      toastSuccess('Current academic year changed', `${year.name} is now the active year.`);
    } catch (error) {
      toastError(error, 'Could not change the current academic year.');
    }
  };

  const columns: Column<ClassRow>[] = [
    {
      key: 'name',
      header: 'Class',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          <p className="truncate text-xs text-muted">
            {row.departmentName} · {row.academicYearName}
          </p>
        </div>
      ),
    },
    {
      key: 'semester',
      header: 'Semester',
      align: 'center',
      label: 'Semester',
      cell: (row) => <Badge tone="neutral">Sem {row.semester}</Badge>,
    },
    {
      key: 'students',
      header: 'Students',
      align: 'right',
      label: 'Students',
      cell: (row) => <span className="tnum text-sm text-ink">{row.studentCount}</span>,
    },
    {
      key: 'curriculum',
      header: 'Curriculum',
      label: 'Subjects',
      cell: (row) =>
        row.subjects.length === 0 ? (
          <Badge tone="warn">No subjects linked</Badge>
        ) : (
          <span className="text-xs text-muted">
            {row.subjects.length} subjects · {row.weeklyPeriodTotal} periods/wk
          </span>
        ),
    },
    {
      key: 'timetables',
      header: 'Timetables',
      align: 'right',
      label: 'Timetables',
      hideOnMobile: true,
      cell: (row) => <span className="tnum text-xs text-muted">{row.timetableCount}</span>,
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
        title="Classes"
        description="Cohorts by year and section, each with its own curriculum. Students enrol into a class, and timetables are built per class."
        icon={<CalendarRange />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Classes' }]}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setYearOpen(true)}>
                Academic years
              </Button>
              <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Add class
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mt-5 space-y-4">
        {academic?.currentAcademicYearName ? (
          <StatGrid columns={4}>
            <StatTile label="Current academic year" value={academic.currentAcademicYearName} tone="brand" icon={<CalendarRange />} hint={`Semester ${academic.semester}`} />
            <StatTile label="Classes shown" value={rows.length} hint={departmentId ? 'Filtered by department' : 'All departments'} icon={<CalendarRange />} />
            <StatTile label="Students in view" value={rows.reduce((a, c) => a + c.studentCount, 0)} icon={<CalendarRange />} />
            <StatTile
              label="Total weekly periods"
              value={rows.reduce((a, c) => a + c.weeklyPeriodTotal, 0)}
              hint="Across all shown classes"
              icon={<CalendarRange />}
            />
          </StatGrid>
        ) : null}

        <Panel>
          <PanelBody className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="min-w-52 flex-1">
              <label htmlFor="class-dept" className="field-label">
                Department
              </label>
              <Select
                id="class-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                placeholder="All departments"
                options={(departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            </div>
            <div className="sm:w-40">
              <label htmlFor="class-year" className="field-label">
                Year of study
              </label>
              <Select
                id="class-year"
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(e.target.value)}
                placeholder="Any year"
                options={['1', '2', '3', '4'].map((y) => ({ value: y, label: `Year ${y}` }))}
              />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Cohorts"
            subtitle="A class name is generated from department code, year and section."
          />
          <PanelBody>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              loading={data.isLoading}
              error={data.error}
              onRetry={() => data.refetch()}
              caption="Classes matching the current filters"
              empty={{
                title: 'No classes yet',
                description: 'Pick a department, academic year, year of study and section to create the first cohort.',
                icon: <CalendarRange />,
              }}
            />
          </PanelBody>
        </Panel>
      </div>

      <ClassFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        departments={departments.data?.data ?? []}
        academicYears={years}
        subjectOptions={(subjects.data?.data ?? []).filter((s) => !departmentId || s.departmentId === departmentId)}
        onSaved={() => {
          invalidate('/api/classes', '/api/analytics');
          setFormOpen(false);
        }}
      />

      <AcademicYearsDialog
        open={yearOpen}
        onOpenChange={setYearOpen}
        years={years}
        onYearChange={() => invalidate('/api/classes', '/api/dashboard')}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete class'}
        description={deleting ? `Only possible while it has no students (${deleting.studentCount} currently enrolled).` : undefined}
        confirmLabel="Delete class"
        onConfirm={doDelete}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function ClassFormDialog({
  open,
  onOpenChange,
  initial,
  departments,
  academicYears,
  subjectOptions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ClassRow | null;
  departments: DepartmentOption[];
  academicYears: AcademicYearRow[];
  subjectOptions: SubjectOption[];
  onSaved: () => void;
}) {
  const [departmentId, setDepartmentId] = React.useState('');
  const [academicYearId, setAcademicYearId] = React.useState('');
  const [yearOfStudy, setYearOfStudy] = React.useState('1');
  const [section, setSection] = React.useState('A');
  const [semester, setSemester] = React.useState('');
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const subjects = useApi<SubjectOption[]>('/api/subjects', {
    departmentId: departmentId || undefined,
  });
  const availableSubjects = subjects.data?.data ?? [];

  React.useEffect(() => {
    if (!open) return;
    setDepartmentId(initial?.departmentId ?? '');
    setAcademicYearId(initial?.academicYearId ?? academicYears.find((y) => y.isCurrent)?.id ?? academicYears[0]?.id ?? '');
    setYearOfStudy(String(initial?.yearOfStudy ?? 1));
    setSection(initial?.section ?? 'A');
    setSemester(initial ? String(initial.semester) : '');
    setSelectedSubjects(initial?.subjects.map((s) => s.id) ?? []);
    setErrors({});
    setFormError(null);
  }, [open, initial, academicYears]);

  const toggle = (id: string) =>
    setSelectedSubjects((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    if (!departmentId) return setErrors({ departmentId: 'Select a department' });
    if (!academicYearId) return setErrors({ academicYearId: 'Select an academic year' });
    if (!section.trim()) return setErrors({ section: 'A section is required' });

    const payload = {
      departmentId,
      academicYearId,
      yearOfStudy: Number(yearOfStudy),
      section: section.trim(),
      semester: semester ? Number(semester) : undefined,
      subjectIds: selectedSubjects,
    };

    setBusy(true);
    try {
      if (initial?.id) {
        await api.patch(`/api/classes/${initial.id}`, payload);
        toastSuccess('Class updated', `${initial.name} was saved.`);
      } else {
        await api.post('/api/classes', payload);
        toastSuccess('Class created', 'Students can now be enrolled into it.');
      }
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save that class.');
      toastError(error, 'Could not save that class.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={initial ? `Edit ${initial.name}` : 'Add a class'}
        size="lg"
        description="The curriculum (subjects) is what timetable generation and mark entry work from."
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Department" htmlFor="c-dept" required error={errors.departmentId}>
              <Select
                id="c-dept"
                value={departmentId}
                invalid={Boolean(errors.departmentId)}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setSelectedSubjects([]);
                }}
                placeholder="Select a department"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>
            <Field label="Academic year" htmlFor="c-year" required error={errors.academicYearId}>
              <Select
                id="c-year"
                value={academicYearId}
                invalid={Boolean(errors.academicYearId)}
                onChange={(e) => setAcademicYearId(e.target.value)}
                placeholder="Select an academic year"
                options={academicYears.map((y) => ({ value: y.id, label: `${y.name}${y.isCurrent ? ' · current' : ''}` }))}
              />
            </Field>
            <Field label="Year of study" htmlFor="c-year-of-study" error={errors.yearOfStudy}>
              <Select id="c-year-of-study" value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} options={['1', '2', '3', '4'].map((y) => ({ value: y, label: `Year ${y}` }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Section" htmlFor="c-section" required error={errors.section}>
                <Input id="c-section" value={section} invalid={Boolean(errors.section)} onChange={(e) => setSection(e.target.value.toUpperCase())} maxLength={6} />
              </Field>
              <Field label="Semester" htmlFor="c-semester" error={errors.semester} hint="Defaults from year.">
                <Input id="c-semester" type="number" min={1} max={12} value={semester} onChange={(e) => setSemester(e.target.value)} />
              </Field>
            </div>
          </div>

          <Field
            label="Curriculum subjects"
            hint="Only subjects from the chosen department are listed. Add as many as this class studies this semester."
          >
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-line bg-raised p-2.5 sm:grid-cols-2">
              {availableSubjects.length === 0 ? (
                <p className="col-span-full px-1 py-2 text-xs text-muted">
                  {departmentId ? 'No subjects in that department yet.' : 'Choose a department first.'}
                </p>
              ) : (
                availableSubjects.map((subject) => (
                  <Checkbox
                    key={subject.id}
                    id={`c-subject-${subject.id}`}
                    label={`${subject.code} · ${subject.name}`}
                    checked={selectedSubjects.includes(subject.id)}
                    onCheckedChange={() => toggle(subject.id)}
                  />
                ))
              )}
            </div>
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
              {initial ? 'Save changes' : 'Create class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AcademicYearsDialog({
  open,
  onOpenChange,
  years,
  onYearChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  years: AcademicYearRow[];
  onYearChange: () => void;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = React.useState('');
  const [startDate, setStartDate] = React.useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = React.useState(toDateInputValue(new Date()));
  const [makeCurrent, setMakeCurrent] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!name.trim() || !startDate || !endDate) {
      setFormError('Name and both dates are required.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/academic-years', {
        name: name.trim(),
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        isCurrent: makeCurrent,
      });
      invalidate('/api/classes', '/api/dashboard');
      onYearChange();
      toastSuccess('Academic year added', makeCurrent ? `${name} is now the current year.` : `${name} was added.`);
      setName('');
      setMakeCurrent(true);
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not add that academic year.');
      toastError(error, 'Could not add that academic year.');
    } finally {
      setBusy(false);
    }
  };

  const setCurrent = async (year: AcademicYearRow) => {
    try {
      await api.post('/api/academic-years', { id: year.id });
      invalidate('/api/classes', '/api/dashboard');
      onYearChange();
      toastSuccess('Current academic year changed', `${year.name} is now the active year.`);
    } catch (error) {
      toastError(error, 'Could not change the current academic year.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Academic years"
        description="The current year is what new classes default to, and what dashboards label as “this year”."
      >
        <div className="space-y-4">
          <ul className="space-y-1.5">
            {years.map((year) => (
              <li
                key={year.id}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${year.isCurrent ? 'border-brand/35 bg-brand-soft/30' : 'border-line bg-surface'}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{year.name}</p>
                  <p className="text-xs text-muted">
                    {new Date(year.startDate).toLocaleDateString()} – {new Date(year.endDate).toLocaleDateString()}
                  </p>
                </div>
                {year.isCurrent ? (
                  <Badge tone="brand" icon={<CheckCircle2 />}>
                    Current
                  </Badge>
                ) : (
                  <Button size="xs" variant="secondary" onClick={() => void setCurrent(year)}>
                    Make current
                  </Button>
                )}
              </li>
            ))}
            {years.length === 0 ? <p className="py-2 text-sm text-muted">No academic years yet — add the first below.</p> : null}
          </ul>

          <form onSubmit={submit} className="space-y-3 rounded-md border border-line bg-raised p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Add a new academic year</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name" htmlFor="ay-name">
                <Input id="ay-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="2026-27" />
              </Field>
              <Field label="Starts" htmlFor="ay-start">
                <Input id="ay-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Ends" htmlFor="ay-end">
                <Input id="ay-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            <Checkbox
              id="ay-current"
              label="Set as the current academic year"
              checked={makeCurrent}
              onCheckedChange={(checked) => setMakeCurrent(Boolean(checked))}
            />
            {formError ? (
              <p className="field-error" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" loading={busy}>
                Add year
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
