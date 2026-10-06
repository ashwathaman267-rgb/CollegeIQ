'use client';

import * as React from 'react';
import { DoorOpen, FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { useApi, useDebouncedValue, useInvalidate } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Checkbox, Field, Input, SearchInput, Select } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { DataTable, type Column } from '@/components/ui/table';
import { Tabs } from '@/components/ui/dropdown';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { roomTypeEnum } from '@/validations';

const ROOM_TYPES = roomTypeEnum.options.map((value) => ({ value, label: value.replace(/_/g, ' ').toLowerCase() }));

interface RoomRow {
  id: string;
  code: string;
  name: string;
  capacity: number;
  roomType: string;
  building: string | null;
  floor: number | null;
  hasProjector: boolean;
  departmentId: string | null;
  departmentName: string | null;
  laboratoryId: string | null;
  laboratoryName: string | null;
}

interface LabRow {
  id: string;
  name: string;
  code: string;
  capacity: number;
  equipment: string | null;
  departmentId: string;
  departmentName: string;
  rooms: { id: string; code: string }[];
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

/**
 * Physical resources: classrooms, labs, halls and the laboratory entities
 * that back them. Rooms and labs are hard constraints for the scheduler.
 */
export function RoomsView() {
  const { user } = useSession();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = React.useState<'rooms' | 'labs'>('rooms');
  const [search, setSearch] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [roomType, setRoomType] = React.useState('');
  const debounced = useDebouncedValue(search, 300);

  const data = useApi<{ rooms: RoomRow[]; laboratories: LabRow[] }>(
    '/api/rooms',
    {
      search: debounced || undefined,
      departmentId: departmentId || undefined,
      roomType: roomType || undefined,
    },
  );
  const departments = useApi<DepartmentOption[]>('/api/departments');
  const labs = useApi<LabRow[]>('/api/laboratories');

  const [roomFormOpen, setRoomFormOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<RoomRow | null>(null);
  const [deletingRoom, setDeletingRoom] = React.useState<RoomRow | null>(null);
  const [labFormOpen, setLabFormOpen] = React.useState(false);
  const [editingLab, setEditingLab] = React.useState<LabRow | null>(null);
  const [deletingLab, setDeletingLab] = React.useState<LabRow | null>(null);
  const invalidate = useInvalidate();

  const rooms = data.data?.data?.rooms ?? [];
  const laboratories = data.data?.data?.laboratories ?? [];

  const doDeleteRoom = async () => {
    if (!deletingRoom) return;
    try {
      await api.delete(`/api/rooms/${deletingRoom.id}`);
      invalidate('/api/rooms', '/api/timetable/conflicts');
      toastSuccess('Room deleted', `${deletingRoom.code} was removed.`);
    } catch (error) {
      toastError(error, 'That room is still used in a timetable, so it could not be deleted.');
    } finally {
      setDeletingRoom(null);
    }
  };

  const doDeleteLab = async () => {
    if (!deletingLab) return;
    try {
      await api.delete(`/api/laboratories/${deletingLab.id}`);
      invalidate('/api/rooms');
      toastSuccess('Laboratory deleted', `${deletingLab.code} was removed.`);
    } catch (error) {
      toastError(error, 'That laboratory is still used in a timetable, so it could not be deleted.');
    } finally {
      setDeletingLab(null);
    }
  };

  const roomColumns: Column<RoomRow>[] = [
    {
      key: 'code',
      header: 'Code',
      label: 'Code',
      cell: (row) => <span className="tnum text-sm font-semibold text-ink">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Room',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          <p className="truncate text-xs text-muted">
            {[row.building, row.floor != null ? `Floor ${row.floor}` : null, row.laboratoryName].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      label: 'Type',
      cell: (row) => <Badge tone={row.roomType === 'LABORATORY' ? 'info' : 'neutral'}>{row.roomType.replace(/_/g, ' ').toLowerCase()}</Badge>,
    },
    {
      key: 'capacity',
      header: 'Capacity',
      align: 'right',
      label: 'Capacity',
      cell: (row) => <span className="tnum text-sm text-ink">{row.capacity}</span>,
    },
    {
      key: 'extras',
      header: 'Extras',
      label: 'Extras',
      hideOnMobile: true,
      cell: (row) => (
        <span className="flex items-center gap-1.5">
          {row.hasProjector ? <Badge tone="neutral">Projector</Badge> : null}
          {row.departmentName ? <span className="text-xs text-muted">{row.departmentName}</span> : null}
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
            <Button size="xs" variant="ghost" onClick={() => setEditingRoom(row)} aria-label={`Edit ${row.name}`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button size="xs" variant="ghost" className="text-danger-fg hover:text-danger" onClick={() => setDeletingRoom(row)} aria-label={`Delete ${row.name}`}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        ) : null,
    },
  ];

  const labColumns: Column<LabRow>[] = [
    {
      key: 'code',
      header: 'Code',
      label: 'Code',
      cell: (row) => <span className="tnum text-sm font-semibold text-ink">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Laboratory',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          <p className="truncate text-xs text-muted">{row.equipment ?? 'No equipment listed'}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      label: 'Department',
      cell: (row) => <span className="text-sm text-muted">{row.departmentName}</span>,
    },
    {
      key: 'capacity',
      header: 'Capacity',
      align: 'right',
      label: 'Capacity',
      cell: (row) => <span className="tnum text-sm text-ink">{row.capacity}</span>,
    },
    {
      key: 'rooms',
      header: 'Room slots',
      label: 'Rooms',
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.rooms.map((room) => (
            <Badge key={room.id} tone="neutral">
              {room.code}
            </Badge>
          ))}
          {row.rooms.length === 0 ? <span className="text-xs text-subtle">None</span> : null}
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
            <Button size="xs" variant="ghost" onClick={() => setEditingLab(row)} aria-label={`Edit ${row.name}`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button size="xs" variant="ghost" className="text-danger-fg hover:text-danger" onClick={() => setDeletingLab(row)} aria-label={`Delete ${row.name}`}>
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
        title="Rooms & Labs"
        description="Every physical space the scheduler can place a period in. A room that appears in a published timetable can't be deleted until it is freed."
        icon={<DoorOpen />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Rooms & Labs' }]}
        actions={
          isAdmin ? (
            <Button variant="primary" size="sm" onClick={() => (tab === 'rooms' ? setRoomFormOpen(true) : setLabFormOpen(true))}>
              <Plus className="h-4 w-4" aria-hidden />
              Add {tab === 'rooms' ? 'room' : 'laboratory'}
            </Button>
          ) : null
        }
      />

      <div className="mt-5 space-y-4">
        <Tabs
          ariaLabel="Resource type"
          value={tab}
          onValueChange={(value) => setTab(value as 'rooms' | 'labs')}
          items={[
            { value: 'rooms', label: 'Rooms', count: rooms.length, icon: <DoorOpen /> },
            { value: 'labs', label: 'Laboratories', count: laboratories.length, icon: <FlaskConical /> },
          ]}
        />

        {tab === 'rooms' ? (
          <Panel>
            <PanelBody className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="min-w-52 flex-1">
                <label htmlFor="room-search" className="field-label">
                  Search
                </label>
                <SearchInput id="room-search" value={search} onValueChange={setSearch} placeholder="Name or code…" />
              </div>
              <div className="sm:w-56">
                <label htmlFor="room-dept" className="field-label">
                  Department
                </label>
                <Select
                  id="room-dept"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  placeholder="All departments"
                  options={(departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                />
              </div>
              <div className="sm:w-44">
                <label htmlFor="room-type" className="field-label">
                  Type
                </label>
                <Select id="room-type" value={roomType} onChange={(e) => setRoomType(e.target.value)} placeholder="Any type" options={ROOM_TYPES} />
              </div>
            </PanelBody>
            <PanelBody>
              <DataTable
                columns={roomColumns}
                rows={rooms}
                rowKey={(row) => row.id}
                loading={data.isLoading}
                error={data.error}
                onRetry={() => data.refetch()}
                caption="Rooms matching the current filters"
                empty={{
                  title: 'No rooms match',
                  description: 'Add a room so the timetable generator has somewhere to place periods.',
                  icon: <DoorOpen />,
                }}
              />
            </PanelBody>
          </Panel>
        ) : (
          <Panel>
            <PanelBody>
              <DataTable
                columns={labColumns}
                rows={laboratories}
                rowKey={(row) => row.id}
                loading={data.isLoading}
                error={data.error}
                onRetry={() => data.refetch()}
                caption="Laboratories matching the current department filter"
                empty={{
                  title: 'No laboratories yet',
                  description: 'Create a laboratory, then attach classroom-type rooms to it as room slots.',
                  icon: <FlaskConical />,
                }}
              />
            </PanelBody>
          </Panel>
        )}
      </div>

      <RoomFormDialog
        open={roomFormOpen}
        onOpenChange={setRoomFormOpen}
        initial={editingRoom}
        departments={departments.data?.data ?? []}
        labOptions={(labs.data?.data ?? laboratories).map((l) => ({ id: l.id, name: l.name, code: l.code }))}
        onSaved={() => {
          invalidate('/api/rooms');
          setRoomFormOpen(false);
        }}
      />

      <LabFormDialog
        open={labFormOpen}
        onOpenChange={setLabFormOpen}
        initial={editingLab}
        departments={departments.data?.data ?? []}
        onSaved={() => {
          invalidate('/api/rooms', '/api/laboratories');
          setLabFormOpen(false);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingRoom)}
        onOpenChange={(open) => !open && setDeletingRoom(null)}
        title={deletingRoom ? `Delete ${deletingRoom.code}?` : 'Delete room'}
        description="Refused automatically if the room still appears in any timetable slot."
        confirmLabel="Delete room"
        onConfirm={doDeleteRoom}
      />

      <ConfirmDialog
        open={Boolean(deletingLab)}
        onOpenChange={(open) => !open && setDeletingLab(null)}
        title={deletingLab ? `Delete ${deletingLab.code}?` : 'Delete laboratory'}
        description="Refused automatically if the laboratory still appears in any timetable slot."
        confirmLabel="Delete laboratory"
        onConfirm={doDeleteLab}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function RoomFormDialog({
  open,
  onOpenChange,
  initial,
  departments,
  labOptions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: RoomRow | null;
  departments: DepartmentOption[];
  labOptions: { id: string; name: string; code: string }[];
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [hasProjector, setHasProjector] = React.useState(false);
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
            capacity: String(initial.capacity),
            roomType: initial.roomType,
            building: initial.building ?? '',
            floor: initial.floor == null ? '' : String(initial.floor),
            departmentId: initial.departmentId ?? '',
            laboratoryId: initial.laboratoryId ?? '',
          }
        : { code: '', name: '', capacity: '60', roomType: 'CLASSROOM', building: '', floor: '', departmentId: '', laboratoryId: '' },
    );
    setHasProjector(initial?.hasProjector ?? false);
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
      capacity: Number(values.capacity),
      roomType: values.roomType,
      building: values.building?.trim() || undefined,
      floor: values.floor ? Number(values.floor) : null,
      hasProjector,
      departmentId: values.departmentId || null,
      laboratoryId: values.laboratoryId || null,
    };

    setBusy(true);
    try {
      if (initial?.id) {
        await api.patch(`/api/rooms/${initial.id}`, payload);
        toastSuccess('Room updated', `${payload.code} was saved.`);
      } else {
        await api.post('/api/rooms', payload);
        toastSuccess('Room created', `${payload.code} is available for scheduling.`);
      }
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save that room.');
      toastError(error, 'Could not save that room.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial ? `Edit ${initial.code}` : 'Add a room'} description="Rooms are hard constraints: two classes can never occupy the same room at the same time.">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" htmlFor="r-code" required error={errors.code}>
              <Input id="r-code" value={values.code ?? ''} invalid={Boolean(errors.code)} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="C-204" />
            </Field>
            <Field label="Name" htmlFor="r-name" required error={errors.name}>
              <Input id="r-name" value={values.name ?? ''} invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} placeholder="CSE Classroom 4" />
            </Field>
            <Field label="Type" htmlFor="r-type" error={errors.roomType}>
              <Select id="r-type" value={values.roomType ?? 'CLASSROOM'} onChange={(e) => set('roomType', e.target.value)} options={ROOM_TYPES} />
            </Field>
            <Field label="Capacity" htmlFor="r-capacity" required error={errors.capacity}>
              <Input id="r-capacity" type="number" min={1} max={500} value={values.capacity ?? ''} invalid={Boolean(errors.capacity)} onChange={(e) => set('capacity', e.target.value)} />
            </Field>
            <Field label="Building" htmlFor="r-building" error={errors.building}>
              <Input id="r-building" value={values.building ?? ''} onChange={(e) => set('building', e.target.value)} placeholder="Block A" />
            </Field>
            <Field label="Floor" htmlFor="r-floor" error={errors.floor}>
              <Input id="r-floor" type="number" value={values.floor ?? ''} onChange={(e) => set('floor', e.target.value)} />
            </Field>
            <Field label="Department (optional)" htmlFor="r-dept" error={errors.departmentId}>
              <Select
                id="r-dept"
                value={values.departmentId ?? ''}
                onChange={(e) => set('departmentId', e.target.value)}
                placeholder="Any department"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>
            <Field label="Laboratory (for lab rooms)" htmlFor="r-lab" error={errors.laboratoryId}>
              <Select
                id="r-lab"
                value={values.laboratoryId ?? ''}
                onChange={(e) => set('laboratoryId', e.target.value)}
                placeholder="Not a lab room"
                options={labOptions.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }))}
              />
            </Field>
          </div>
          <Checkbox id="r-projector" label="Has a projector" checked={hasProjector} onCheckedChange={(checked) => setHasProjector(Boolean(checked))} />

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
              {initial ? 'Save changes' : 'Create room'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LabFormDialog({
  open,
  onOpenChange,
  initial,
  departments,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LabRow | null;
  departments: DepartmentOption[];
  onSaved: () => void;
}) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [capacity, setCapacity] = React.useState('');
  const [equipment, setEquipment] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setCode(initial?.code ?? '');
    setCapacity(initial ? String(initial.capacity) : '');
    setEquipment(initial?.equipment ?? '');
    setDepartmentId(initial?.departmentId ?? '');
    setFormError(null);
  }, [open, initial]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      if (initial?.id) {
        toastSuccess('Laboratories are edited via their rooms', 'Rename the room or delete and recreate the lab to change its details.');
        onSaved();
      } else {
        await api.post('/api/laboratories', {
          name,
          code,
          capacity: Number(capacity),
          equipment: equipment.trim() || undefined,
          departmentId,
        });
        toastSuccess('Laboratory created', `${code} is ready for lab rooms.`);
        onSaved();
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save that laboratory.');
      toastError(error, 'Could not save that laboratory.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={initial ? initial.name : 'Add a laboratory'}
        description="A laboratory is the logical entity for lab subjects; rooms of type LABORATORY point back to it."
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="l-name" required>
              <Input id="l-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Data Structures Lab" disabled={Boolean(initial)} />
            </Field>
            <Field label="Code" htmlFor="l-code" required>
              <Input id="l-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CS-LAB-2" disabled={Boolean(initial)} />
            </Field>
            <Field label="Capacity" htmlFor="l-capacity" required>
              <Input id="l-capacity" type="number" min={1} max={300} value={capacity} onChange={(e) => setCapacity(e.target.value)} disabled={Boolean(initial)} />
            </Field>
            <Field label="Department" htmlFor="l-dept" required>
              <Select
                id="l-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                placeholder="Select a department"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                disabled={Boolean(initial)}
              />
            </Field>
          </div>
          <Field label="Equipment" htmlFor="l-equipment" hint="Optional, comma separated.">
            <Input id="l-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="30 workstations, 1 projector" disabled={Boolean(initial)} />
          </Field>

          {formError ? (
            <p className="field-error" role="alert">
              {formError}
            </p>
          ) : null}

          <DialogFooter className="-mx-5 -mb-4 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {initial ? 'Close' : 'Cancel'}
            </Button>
            {!initial ? (
              <Button type="submit" variant="primary" loading={busy}>
                Create laboratory
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
