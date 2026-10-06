'use client';

import * as React from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { EmptyState, SkeletonTiles } from '@/components/ui/states';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { departmentSchema } from '@/validations';

interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  building: string | null;
  headOfDepartment: { id: string; name: string } | null;
  studentCount: number;
  facultyCount: number;
  subjectCount: number;
  classCount: number;
}

/**
 * Academic departments — the top of the academic tree. Everything (subjects,
 * classes, people) hangs off a department, so deletions are refused while
 * anything still references one.
 */
export function DepartmentsView() {
  const { user } = useSession();
  const departments = useApi<DepartmentRow[]>('/api/departments');
  const invalidate = useInvalidate();
  const isAdmin = user?.role === 'ADMIN';

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DepartmentRow | null>(null);
  const [deleting, setDeleting] = React.useState<DepartmentRow | null>(null);

  const rows = departments.data?.data ?? [];

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/api/departments/${deleting.id}`);
      invalidate('/api/departments', '/api/analytics');
      toastSuccess('Department deleted', `${deleting.name} was removed.`);
    } catch (error) {
      toastError(error, 'That department still has data attached to it, so it could not be deleted.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Departments"
        description="Academic departments and their head of department. Departments hold subjects, classes and people."
        icon={<Building2 />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Departments' }]}
        actions={
          isAdmin ? (
            <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add department
            </Button>
          ) : null
        }
      />

      <div className="mt-5">
        {departments.isLoading ? (
          <SkeletonTiles count={4} />
        ) : departments.error ? (
          <p className="text-sm text-muted">Could not load departments.</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title="No departments yet"
            description="Create your first department to start adding subjects and classes."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((dept) => (
              <Panel key={dept.id} className="h-full">
                <PanelBody className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-ink">{dept.name}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span className="tnum rounded bg-line px-1.5 py-0.5 font-semibold text-ink">{dept.code}</span>
                        {dept.building ? <span>· {dept.building}</span> : null}
                      </p>
                    </div>
                    {isAdmin ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button size="xs" variant="ghost" onClick={() => setEditing(dept)} aria-label={`Edit ${dept.name}`}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button size="xs" variant="ghost" className="text-danger-fg hover:text-danger" onClick={() => setDeleting(dept)} aria-label={`Delete ${dept.name}`}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {dept.description ? <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-muted">{dept.description}</p> : null}

                  <div className="mt-auto space-y-2">
                    <p className="text-xs text-muted">
                      Head of department: <span className="font-medium text-ink">{dept.headOfDepartment?.name ?? 'Not assigned'}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="neutral">{dept.studentCount} students</Badge>
                      <Badge tone="neutral">{dept.facultyCount} faculty</Badge>
                      <Badge tone="neutral">{dept.subjectCount} subjects</Badge>
                      <Badge tone="neutral">{dept.classCount} classes</Badge>
                    </div>
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        )}
      </div>

      <DepartmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={() => {
          invalidate('/api/departments', '/api/analytics');
          setFormOpen(false);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete department'}
        description="Only possible while the department has no students, faculty or subjects. Its history stays in the audit log."
        confirmLabel="Delete department"
        onConfirm={doDelete}
      />
    </>
  );
}

function DepartmentFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: DepartmentRow | null;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [building, setBuilding] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setCode(initial?.code ?? '');
    setDescription(initial?.description ?? '');
    setBuilding(initial?.building ?? '');
    setErrors({});
    setFormError(null);
  }, [open, initial]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const parsed = departmentSchema.safeParse({
      name,
      code,
      description: description.trim() || undefined,
      building: building.trim() || undefined,
    });
    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) issues[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(issues);
      return;
    }

    setBusy(true);
    try {
      if (initial?.id) {
        await api.patch(`/api/departments/${initial.id}`, parsed.data);
        toastSuccess('Department updated', `${name} was saved.`);
      } else {
        await api.post('/api/departments', parsed.data);
        toastSuccess('Department created', `${name} is ready for subjects and classes.`);
      }
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save that department.');
      toastError(error, 'Could not save that department.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={initial ? `Edit ${initial.name}` : 'Add a department'}
        description="The code is used in class names and report headers, so keep it short."
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" htmlFor="d-name" required error={errors.name} className="sm:col-span-2">
              <Input id="d-name" value={name} invalid={Boolean(errors.name)} onChange={(e) => setName(e.target.value)} placeholder="Computer Science & Engineering" />
            </Field>
            <Field label="Code" htmlFor="d-code" required error={errors.code}>
              <Input id="d-code" value={code} invalid={Boolean(errors.code)} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CSE" maxLength={10} />
            </Field>
          </div>
          <Field label="Building" htmlFor="d-building" error={errors.building}>
            <Input id="d-building" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="Block A" />
          </Field>
          <Field label="Description" htmlFor="d-description" error={errors.description} hint="Optional — shown on department cards.">
            <Textarea id="d-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
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
              {initial ? 'Save changes' : 'Create department'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
