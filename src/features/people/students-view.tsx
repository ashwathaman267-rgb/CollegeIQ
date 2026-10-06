'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  KeyRound,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

import { api } from '@/lib/api-client';
import { formatGpa } from '@/lib/format';
import { useApi, useDebouncedValue, useInvalidate, usePagedApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { useConfirm } from '@/hooks/use-confirm';
import { PageHeader } from '@/components/layout/page-header';
import { PersonCell } from '@/components/ui/avatar';
import { BandBadge, Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { Checkbox, Field, SearchInput, Select } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { ProgressBar } from '@/components/ui/progress';
import { DataTable, type Column } from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { StudentFormDialog, type StudentFormValues } from './student-form';

interface StudentRow {
  id: string;
  userId: string;
  registerNumber: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  classId: string | null;
  className: string | null;
  section: string | null;
  yearOfStudy: number | null;
  semester: number;
  cgpa: number | null;
  academicStatus: string;
  openArrears: number;
  attendancePercentage: number | null;
  lastLoginAt: string | null;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface ClassOption {
  id: string;
  name: string;
  section: string;
  yearOfStudy: number;
  departmentId: string;
}

/**
 * Student directory — search, filter, sort and manage the people in your
 * institution. Students see exactly one row: themselves.
 */
export function StudentsView() {
  const { user, can, thresholds } = useSession();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [yearOfStudy, setYearOfStudy] = React.useState('');
  const [atRisk, setAtRisk] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<{ sortBy?: string; sortDir?: 'asc' | 'desc' }>({ sortBy: 'registerNumber', sortDir: 'asc' });

  const debounced = useDebouncedValue(search, 300);
  const { items, meta, isLoading, error, refetch } = usePagedApi<StudentRow>('/api/students', {
    search: debounced || undefined,
    departmentId: departmentId || undefined,
    classId: classId || undefined,
    yearOfStudy: yearOfStudy || undefined,
    atRisk: atRisk || undefined,
    page,
    pageSize: 15,
    sortBy: sort.sortBy,
    sortDir: sort.sortDir,
  });

  const departments = useApi<DepartmentOption[]>('/api/departments');
  const classList = useApi<{ classes: ClassOption[] }>('/api/classes', {
    departmentId: departmentId || undefined,
  });
  const classOptions = (classList.data?.data?.classes ?? [])
    .filter((c) => !departmentId || c.departmentId === departmentId)
    .map((c) => ({ value: c.id, label: `${c.name} · ${c.section} · Y${c.yearOfStudy}` }));

  React.useEffect(() => {
    setPage(1);
  }, [debounced, departmentId, classId, yearOfStudy, atRisk]);
  React.useEffect(() => {
    setClassId('');
  }, [departmentId]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StudentFormValues | null>(null);

  const invalidate = useInvalidate();

  const [unlocking, setUnlocking] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (row: StudentRow) => {
    setEditing({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      registerNumber: row.registerNumber,
      rollNumber: row.rollNumber ?? undefined,
      departmentId: row.departmentId,
      classId: row.classId,
      semester: row.semester,
      academicStatus: row.academicStatus,
      cgpa: row.cgpa,
    });
    setFormOpen(true);
  };

  const doUnlock = async (row: StudentRow) => {
    setUnlocking(row.id);
    try {
      await api.post(`/api/students/${row.id}/unlock`);
      invalidate('/api/students');
      toastSuccess('Account unlocked', `${row.name} can sign in again.`);
    } catch (error) {
      toastError(error, 'Could not unlock that account.');
    } finally {
      setUnlocking(null);
    }
  };
  const doReset = async (row: StudentRow) => {
    const agreed = await confirm({
      title: `Reset ${row.name}'s password?`,
      description: 'Their current password stops working immediately and every open session is signed out.',
      confirmLabel: 'Reset password',
      tone: 'brand',
    });
    if (!agreed) return;
    setResetting(row.id);
    try {
      const result = await api.post<{ temporaryPassword?: string }>(`/api/students/${row.id}/unlock?action=reset-password`);
      invalidate('/api/students');
      if (result.data.temporaryPassword) {
        const temporary = result.data.temporaryPassword;
        toastSuccess('Password reset', 'A one-time password was generated.');
        void confirm({
          title: 'Share this one-time password',
          description: (
            <p>
              <span className="block font-mono text-sm font-semibold text-ink">{temporary}</span>
              <span className="mt-1 block text-xs">
                It signs {row.firstName} in once and revokes their other sessions. The student should change it from Profile.
              </span>
            </p>
          ),
          tone: 'brand',
          confirmLabel: 'Got it',
        });
      }
    } catch (error) {
      toastError(error, 'Could not reset that password.');
    } finally {
      setResetting(null);
    }
  };
  const doDelete = async (row: StudentRow) => {
    const agreed = await confirm({
      title: `Remove ${row.name}?`,
      description: `Register number ${row.registerNumber} will be deactivated and their session ended. Attendance, marks and results history stay for auditing.`,
      confirmLabel: 'Remove student',
    });
    if (!agreed) return;
    setDeleting(row.id);
    try {
      await api.delete(`/api/students/${row.id}`);
      invalidate('/api/students', '/api/dashboard', '/api/analytics');
      toastSuccess('Student removed from CampusIQ', `${row.name}'s account was deactivated.`);
    } catch (error) {
      toastError(error, 'Could not remove that student.');
    } finally {
      setDeleting(null);
    }
  };

  const columns: Column<StudentRow>[] = [
    {
      key: 'name',
      header: 'Student',
      primary: true,
      sortable: true,
      cell: (row) => (
        <PersonCell
          name={row.name}
          meta={`${row.registerNumber}${row.rollNumber ? ` · Roll ${row.rollNumber}` : ''}`}
        />
      ),
    },
    {
      key: 'class',
      header: 'Class',
      label: 'Class',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{row.className ?? 'Not assigned'}</p>
          <p className="truncate text-xs text-muted">
            {row.departmentName} · Semester {row.semester}
          </p>
        </div>
      ),
    },
    {
      key: 'attendance',
      header: 'Attendance',
      label: 'Attendance',
      sortable: true,
      cell: (row) =>
        row.attendancePercentage == null ? (
          <Badge tone="neutral">No records</Badge>
        ) : (
          <span className="flex items-center gap-2">
            <ProgressBar
              value={row.attendancePercentage}
              size="sm"
              className="w-16"
              tone={row.attendancePercentage >= (thresholds?.safe ?? 80) ? 'ok' : row.attendancePercentage >= (thresholds?.debar ?? 70) ? 'warn' : 'danger'}
            />
            <span className="tnum w-11 text-right text-sm font-semibold text-ink">{row.attendancePercentage.toFixed(1)}%</span>
            <BandBadge band={attendanceBand(row.attendancePercentage, thresholds)} className="hidden xl:inline-flex" />
          </span>
        ),
    },
    {
      key: 'cgpa',
      header: 'CGPA',
      align: 'right',
      label: 'CGPA',
      sortable: true,
      cell: (row) => <span className="tnum text-sm font-medium text-ink">{formatGpa(row.cgpa)}</span>,
    },
    {
      key: 'arrears',
      header: 'Arrears',
      align: 'right',
      label: 'Open arrears',
      cell: (row) =>
        row.openArrears > 0 ? (
          <Badge tone="danger" icon={<AlertTriangle />}>
            {row.openArrears}
          </Badge>
        ) : (
          <span className="text-xs text-subtle">None</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      label: 'Status',
      hideOnMobile: true,
      cell: (row) => <StatusBadge status={row.academicStatus} />,
    },
    {
      key: 'login',
      header: 'Last active',
      label: 'Last active',
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-xs text-muted">{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString() : 'Never'}</span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <Dropdown>
          <DropdownTrigger asChild>
            <Button size="xs" variant="ghost" aria-label={`Actions for ${row.name}`}>
              <span className="tnum px-1">⋯</span>
            </Button>
          </DropdownTrigger>
          <DropdownContent align="end" className="w-52">
            <DropdownItem onSelect={(event) => event.preventDefault()}>
              <Link href={`/students/${row.id}`}>View full profile</Link>
            </DropdownItem>
            <DropdownSeparator />
            {isAdmin ? (
              <>
                <DropdownItem onSelect={() => openEdit(row)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit details
                </DropdownItem>
                <DropdownItem onSelect={() => void doReset(row)}>
                  <KeyRound className="h-3.5 w-3.5" aria-hidden />
                  Reset password
                </DropdownItem>
                <DropdownItem onSelect={() => void doUnlock(row)}>
                  <LockOpen className="h-3.5 w-3.5" aria-hidden />
                  Unlock account
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem tone="danger" onSelect={() => void doDelete(row)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove student
                </DropdownItem>
              </>
            ) : null}
          </DropdownContent>
        </Dropdown>
      ),
    },
  ];

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Students"
        description={
          user.role === 'STUDENT'
            ? 'Your CampusIQ record.'
            : 'Search and manage student records: attendance standing, academics, arrears and account access.'
        }
        icon={<Users />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Students' }]}
        actions={
          isAdmin ? (
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Add student
            </Button>
          ) : null
        }
      />

      <div className="mt-5 space-y-4">
        {atRisk && (
          <Alert tone="warning" title="Showing students below the attendance safety line" icon={<AlertTriangle />}>
            Thresholds come from Settings — currently safe ≥ {thresholds?.safe ?? 80}%, fine &lt; {thresholds?.fine ?? 75}%,
            debarred &lt; {thresholds?.debar ?? 70}%.
          </Alert>
        )}

        <Panel>
          <PanelBody className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-end">
            <Field label="Search" htmlFor="student-search" className="min-w-52 flex-1">
              <SearchInput id="student-search" value={search} onValueChange={setSearch} placeholder="Name, register number, email…" />
            </Field>
            <Field label="Department" htmlFor="student-dept">
              <Select
                id="student-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                placeholder="All departments"
                options={(departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>
            <Field label="Class" htmlFor="student-class">
              <Select
                id="student-class"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                placeholder="All classes"
                options={classOptions}
                disabled={classList.isLoading}
              />
            </Field>
            <Field label="Year" htmlFor="student-year">
              <Select
                id="student-year"
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(e.target.value)}
                placeholder="Any year"
                options={['1', '2', '3', '4'].map((y) => ({ value: y, label: `Year ${y}` }))}
              />
            </Field>
            <div className="pb-1">
              <Checkbox
                id="student-atrisk"
                label={`Attendance below ${thresholds?.safe ?? 80}%`}
                checked={atRisk}
                onCheckedChange={(checked) => setAtRisk(Boolean(checked))}
              />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title={debounced ? `Results for “${debounced}”` : 'Student directory'}
            subtitle={
              meta ? `${meta.total} student${meta.total === 1 ? '' : 's'} match${meta.total === 1 ? 'es' : ''} these filters` : undefined
            }
          />
          <PanelBody>
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(row) => row.id}
              loading={isLoading}
              error={error}
              onRetry={refetch}
              rowHref={(row) => `/students/${row.id}`}
              page={meta?.page}
              pageSize={meta?.pageSize}
              total={meta?.total}
              totalPages={meta?.totalPages}
              onPageChange={setPage}
              sort={sort}
              onSortChange={(sortBy, sortDir) => setSort({ sortBy, sortDir })}
              caption="Students matching the current filters"
              empty={{
                title: debounced || departmentId || classId || yearOfStudy || atRisk ? 'No students match these filters' : 'No students yet',
                description: debounced || departmentId || classId || yearOfStudy || atRisk
                  ? 'Try widening the search or clearing a filter.'
                  : 'Add your first student to get started.',
                icon: <Users />,
              }}
            />
          </PanelBody>
        </Panel>
      </div>

      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        departments={departments.data?.data ?? []}
      />
    </>
  );
}

function attendanceBand(
  pct: number | null,
  thresholds?: { safe: number; fine: number; debar: number } | null,
): 'SAFE' | 'AT_RISK' | 'FINE' | 'DEBARRED' | 'NO_DATA' {
  if (pct == null) return 'NO_DATA';
  const safe = thresholds?.safe ?? 80;
  const fine = thresholds?.fine ?? 75;
  const debar = thresholds?.debar ?? 70;
  if (pct >= safe) return 'SAFE';
  if (pct >= fine) return 'AT_RISK';
  if (pct >= debar) return 'FINE';
  return 'DEBARRED';
}
