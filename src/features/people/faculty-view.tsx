'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarCheck2, Pencil, Plus, Trash2, UserCog } from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useApi, useDebouncedValue, useInvalidate, usePagedApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { PersonCell } from '@/components/ui/avatar';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { SearchInput, Select } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { DataTable, type Column } from '@/components/ui/table';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { FacultyFormDialog, type FacultyFormValues } from './faculty-form';

interface FacultyRow {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  designation: string | null;
  specialization: string | null;
  qualification: string | null;
  experienceYears: number | null;
  departmentId: string;
  departmentName: string;
  subjects: { id: string; code: string; name: string }[];
  sessionCount: number;
  status: string;
  lastLoginAt: string | null;
}

interface AvailabilityCell {
  day: string;
  dayLabel: string;
  periodIndex: number;
  teachingIndex: number;
  startTime: string;
  endTime: string;
  label: string;
  isAvailable: boolean;
  reason: string | null;
}

/**
 * Faculty directory: who teaches what, their contact details and their weekly
 * availability (which the scheduler treats as a hard constraint).
 */
export function FacultyView() {
  const { user } = useSession();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebouncedValue(search, 300);

  const { items, meta, isLoading, error, refetch } = usePagedApi<FacultyRow>('/api/faculty', {
    search: debounced || undefined,
    departmentId: departmentId || undefined,
    page,
    pageSize: 15,
  });
  const departments = useApi<{ id: string; name: string; code: string }[]>('/api/departments');

  React.useEffect(() => setPage(1), [debounced, departmentId]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FacultyFormValues | null>(null);
  const [availabilityFor, setAvailabilityFor] = React.useState<FacultyRow | null>(null);
  const [deleting, setDeleting] = React.useState<FacultyRow | null>(null);
  const invalidate = useInvalidate();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (row: FacultyRow) => {
    setEditing({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      employeeId: row.employeeId,
      departmentId: row.departmentId,
      designation: row.designation ?? undefined,
      specialization: row.specialization ?? undefined,
      qualification: row.qualification ?? undefined,
      experienceYears: row.experienceYears ?? undefined,
      phone: row.phone ?? undefined,
      subjectIds: row.subjects.map((s) => s.id),
      academicStatus: row.status,
    });
    setFormOpen(true);
  };

  const doDelete = async (row: FacultyRow) => {
    try {
      await api.delete(`/api/faculty/${row.id}`);
      invalidate('/api/faculty', '/api/analytics');
      toastSuccess('Faculty member removed', `${row.name}'s account was deactivated.`);
    } catch (err) {
      toastError(err, 'Could not remove that faculty member.');
    } finally {
      setDeleting(null);
    }
  };

  const columns: Column<FacultyRow>[] = [
    {
      key: 'name',
      header: 'Faculty',
      primary: true,
      cell: (row) => <PersonCell name={row.name} meta={`${row.employeeId}${row.designation ? ` · ${row.designation}` : ''}`} />,
    },
    {
      key: 'department',
      header: 'Department',
      label: 'Department',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{row.departmentName}</p>
          <p className="truncate text-xs text-muted">{row.specialization ?? row.qualification ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'subjects',
      header: 'Teaches',
      label: 'Subjects',
      cell: (row) =>
        row.subjects.length === 0 ? (
          <span className="text-xs text-subtle">No subjects assigned</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.subjects.slice(0, 3).map((subject) => (
              <Badge key={subject.id} tone="neutral">
                {subject.code}
              </Badge>
            ))}
            {row.subjects.length > 3 ? <span className="text-xs text-subtle">+{row.subjects.length - 3}</span> : null}
          </div>
        ),
    },
    {
      key: 'sessions',
      header: 'Sessions marked',
      align: 'right',
      label: 'Sessions',
      cell: (row) => <span className="tnum text-sm text-muted">{row.sessionCount}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      label: 'Status',
      hideOnMobile: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="xs" variant="ghost" onClick={() => setAvailabilityFor(row)}>
            <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
            Availability
          </Button>
          {isAdmin ? (
            <>
              <Button size="xs" variant="ghost" onClick={() => openEdit(row)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </Button>
              <Button size="xs" variant="ghost" className="text-danger-fg hover:text-danger" onClick={() => setDeleting(row)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Remove {row.name}</span>
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Faculty"
        description="Teaching staff, the subjects they own and the weekly hours they are available — the two inputs the timetable generator relies on."
        icon={<UserCog />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Faculty' }]}
        actions={
          isAdmin ? (
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Add faculty
            </Button>
          ) : null
        }
      />

      <div className="mt-5 space-y-4">
        <Panel>
          <PanelBody className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="min-w-52 flex-1">
              <label htmlFor="faculty-search" className="field-label">
                Search
              </label>
              <SearchInput id="faculty-search" value={search} onValueChange={setSearch} placeholder="Name, employee ID, designation…" />
            </div>
            <div className="sm:w-64">
              <label htmlFor="faculty-dept" className="field-label">
                Department
              </label>
              <Select
                id="faculty-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                placeholder="All departments"
                options={(departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title={debounced ? `Results for “${debounced}”` : 'Faculty directory'}
            subtitle={meta ? `${meta.total} member${meta.total === 1 ? '' : 's'} match${meta.total === 1 ? 'es' : ''}` : undefined}
          />
          <PanelBody>
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(row) => row.id}
              loading={isLoading}
              error={error}
              onRetry={refetch}
              page={meta?.page}
              pageSize={meta?.pageSize}
              total={meta?.total}
              totalPages={meta?.totalPages}
              onPageChange={setPage}
              caption="Faculty members matching the current filters"
              empty={{
                title: debounced || departmentId ? 'No faculty match these filters' : 'No faculty yet',
                description: debounced || departmentId ? 'Try a different search or department.' : 'Add your first faculty member to start scheduling.',
                icon: <UserCog />,
              }}
            />
          </PanelBody>
        </Panel>
      </div>

      <FacultyFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} departments={departments.data?.data ?? []} />
      <AvailabilityDialog faculty={availabilityFor} onOpenChange={(open) => !open && setAvailabilityFor(null)} />
      <DeleteDialog row={deleting} onOpenChange={(open) => !open && setDeleting(null)} onConfirm={() => deleting && void doDelete(deleting)} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function AvailabilityDialog({ faculty, onOpenChange }: { faculty: FacultyRow | null; onOpenChange: (open: boolean) => void }) {
  const availability = useApi<AvailabilityCell[]>(`/api/faculty/${faculty?.id}/availability`, undefined, { enabled: Boolean(faculty) });
  const invalidate = useInvalidate();
  const [toggles, setToggles] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (availability.data?.data && faculty) {
      const next: Record<string, boolean> = {};
      for (const cell of availability.data.data) next[keyOf(cell)] = cell.isAvailable;
      setToggles(next);
    }
  }, [availability.data, faculty]);

  if (!faculty) return null;

  const days = Array.from(new Set((availability.data?.data ?? []).map((cell) => cell.day)));
  const isChanged = (cell: AvailabilityCell) => toggles[keyOf(cell)] !== cell.isAvailable;

  const save = async () => {
    if (!availability.data?.data) return;
    const entries = availability.data.data.filter(isChanged).map((cell) => ({
      dayOfWeek: cell.day,
      periodIndex: cell.periodIndex,
      isAvailable: toggles[keyOf(cell)],
    }));
    setSaving(true);
    try {
      await api.put(`/api/faculty/${faculty.id}/availability`, { entries });
      invalidate(`/api/faculty/${faculty.id}/availability`);
      toastSuccess('Availability saved', `${entries.length} slot${entries.length === 1 ? '' : 's'} updated. New timetables respect it immediately.`);
      onOpenChange(false);
    } catch (error) {
      toastError(error, 'Could not save availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(faculty)} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Availability — ${faculty.name}`}
        size="lg"
        description="Unticked slots are treated as hard conflicts by the timetable generator. Default is fully available."
      >
        {availability.isLoading ? (
          <p className="py-8 text-center text-sm text-muted">Loading the week…</p>
        ) : availability.error ? (
          <p className="py-8 text-center text-sm text-muted">Could not load availability.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-full">
              <thead>
                <tr>
                  <th className="text-left" scope="col">
                    <span className="sr-only">Period</span>
                  </th>
                  {days.map((day) => (
                    <th key={day} scope="col" className="text-center">
                      {(availability.data?.data ?? []).find((c) => c.day === day)?.dayLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(availability.data?.data ?? [])
                  .map((cell) => cell)
                  .reduce<AvailabilityCell[]>((acc, cell) => {
                    if (acc.some((c) => c.day === cell.day && c.teachingIndex === cell.teachingIndex)) return acc;
                    acc.push(cell);
                    return acc;
                  }, [])
                  .sort((a, b) => a.teachingIndex - b.teachingIndex || a.day.localeCompare(b.day))
                  .map((row) => (
                    <tr key={row.teachingIndex}>
                      <th scope="row" className="whitespace-nowrap text-left text-xs font-medium text-muted">
                        {row.startTime}–{row.endTime}
                      </th>
                      {days.map((day) => {
                        const cell = (availability.data?.data ?? []).find((c) => c.day === day && c.teachingIndex === row.teachingIndex);
                        if (!cell) return <td key={day} className="text-center text-subtle">—</td>;
                        const available = toggles[keyOf(cell)] ?? cell.isAvailable;
                        return (
                          <td key={day} className="text-center">
                            <input
                              type="checkbox"
                              aria-label={`${cell.dayLabel} period ${cell.teachingIndex}: ${available ? 'available' : 'unavailable'}`}
                              checked={available}
                              onChange={(event) => setToggles((prev) => ({ ...prev, [keyOf(cell)]: event.target.checked }))}
                              className="h-4 w-4 cursor-pointer rounded border-line-strong accent-[rgb(var(--brand))] disabled:cursor-not-allowed"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="-mx-5 -mb-4 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={availability.isLoading}>
            Save availability
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function keyOf(cell: AvailabilityCell) {
  return `${cell.day}|${cell.periodIndex}`;
}

function DeleteDialog({
  row,
  onOpenChange,
  onConfirm,
}: {
  row: FacultyRow | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!row) setBusy(false);
  }, [row]);

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent
        title={row ? `Remove ${row.name}?` : 'Remove faculty member'}
        description={
          row ? `${row.employeeId} will lose access immediately. Their attendance records and timetable history remain for auditing.` : undefined
        }
      >
        <DialogFooter className="-mx-5 -mb-4 mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove faculty member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
