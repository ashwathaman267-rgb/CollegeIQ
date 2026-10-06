'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  FlaskConical,
  Info,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { useConfirm } from '@/hooks/use-confirm';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Segmented, Select } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader, StackItem, StatGrid, StatTile } from '@/components/ui/panel';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Tooltip } from '@/components/ui/dropdown';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { TimetableGrid, SubjectLegend, type Cell, type GridSlot } from './timetable-grid';
import { SlotEditor } from './slot-editor';

type ViewKind = 'class' | 'faculty' | 'room' | 'laboratory';

interface TimetableMeta {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  generatedAt: string;
  notes?: string | null;
  classId: string;
  className?: string;
  academicYearId: string;
  academicYearName?: string;
}

interface ActiveTimetable {
  timetable: TimetableMeta & { conflicts?: unknown; metrics?: unknown };
  cells: Cell[];
}

interface ConflictEntry {
  type: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  day?: string;
  periodIndex?: number;
}

interface GridResponse {
  grid: GridSlot[];
  config: {
    periodMinutes: number;
    workStart: string;
    workEnd: string;
    workingDays: string[];
    breaks: { label: string; start: string; end: string }[];
    maxSameSubjectPerDay: number;
    labContiguous: boolean;
    autoAssignRooms: boolean;
    generationAttempts: number;
  };
  academic: { semester: number; currentAcademicYearId: string | null; iaExamCount: number; passMarkPercentage: number };
  subjects: { id: string; code: string; name: string; subjectType: string; weeklyPeriods: number }[];
  rooms: { id: string; code: string; name: string; capacity: number; roomType: string }[];
  laboratories: { id: string; code: string; name: string; capacity: number }[];
  classes: { id: string; name: string; departmentId: string; semester: number; subjects: { id: string; code: string; name: string; subjectType: string; weeklyPeriods: number }[] }[];
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  faculty: { id: string; name: string; employeeId: string; subjectIds: string[] }[];
}

interface GenerateResult {
  timetableId: string;
  version: number;
  status: string;
  placements: number;
  warnings: { level: string; message: string }[];
  conflicts: ConflictEntry[];
  metrics: Record<string, unknown>;
}

const VIEW_OPTIONS: { value: ViewKind; label: string; icon: React.ReactNode }[] = [
  { value: 'class', label: 'Class', icon: <Users className="h-3.5 w-3.5" /> },
  { value: 'faculty', label: 'Faculty', icon: <UserCog className="h-3.5 w-3.5" /> },
  { value: 'room', label: 'Room', icon: <Building2 className="h-3.5 w-3.5" /> },
  { value: 'laboratory', label: 'Laboratory', icon: <FlaskConical className="h-3.5 w-3.5" /> },
];

export function TimetableView() {
  const { user, can } = useSession();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [view, setView] = React.useState<ViewKind>('class');
  const [classId, setClassId] = React.useState('');
  const [facultyId, setFacultyId] = React.useState(user?.facultyId ?? '');
  const [roomId, setRoomId] = React.useState('');
  const [laboratoryId, setLaboratoryId] = React.useState('');
  const [academicYearId, setAcademicYearId] = React.useState('');
  const [timetableId, setTimetableId] = React.useState('');
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<{ day: string; slot: GridSlot; cell?: Cell } | null>(null);
  const [generateResult, setGenerateResult] = React.useState<GenerateResult | null>(null);

  const grid = useApi<GridResponse>('/api/timetable/grid');
  const gridData = grid.data?.data;

  // Default to the signed-in user's class / the first class / current year.
  React.useEffect(() => {
    if (!gridData) return;
    if (!academicYearId) {
      setAcademicYearId(gridData.academicYears.find((y) => y.isCurrent)?.id ?? gridData.academicYears[0]?.id ?? '');
    }
    if (!classId) setClassId(user?.classId ?? gridData.classes[0]?.id ?? '');
    if (!facultyId && user?.facultyId) setFacultyId(user.facultyId);
    if (!roomId) setRoomId(gridData.rooms[0]?.id ?? '');
    if (!laboratoryId) setLaboratoryId(gridData.laboratories[0]?.id ?? '');
  }, [gridData, academicYearId, classId, facultyId, roomId, laboratoryId, user]);

  const query = React.useMemo(() => {
    if (view === 'class') return { classId, academicYearId };
    if (view === 'faculty') return { view: 'faculty', facultyId, academicYearId };
    if (view === 'room') return { view: 'room', roomId, academicYearId };
    return { view: 'laboratory', laboratoryId, academicYearId };
  }, [view, classId, facultyId, roomId, laboratoryId, academicYearId]);

  const enabled = view === 'class' ? Boolean(classId) : view === 'faculty' ? Boolean(facultyId) : view === 'room' ? Boolean(roomId) : Boolean(laboratoryId);
  const timetable = useApi<{ timetables: TimetableMeta[]; active: ActiveTimetable | null } | { cells: Cell[]; count: number }>(
    '/api/timetable',
    query,
    { enabled },
  );

  const payload = timetable.data?.data as { timetables?: TimetableMeta[]; active?: ActiveTimetable | null; cells?: Cell[] } | undefined;
  const versionQuery = useApi<ActiveTimetable>(`/api/timetable/${timetableId}`, undefined, {
    enabled: view === 'class' && Boolean(timetableId),
  });
  const active = view === 'class' ? (timetableId ? (versionQuery.data?.data ?? null) : (payload?.active ?? null)) : null;
  const cells: Cell[] = view === 'class' ? (active?.cells ?? []) : (payload?.cells ?? []);
  const versions = payload?.timetables ?? [];

  const conflicts = useApi<{ conflicts: ConflictEntry[]; total: number; errors: number; warnings: number }>(
    '/api/timetable/conflicts',
    active?.timetable.id ? { timetableId: active.timetable.id } : { academicYearId },
    { enabled: user?.role !== 'STUDENT' },
  );
  const conflictRows = conflicts.data?.data?.conflicts ?? [];

  const days = gridData?.config.workingDays ?? [];
  const gridSlots = gridData?.grid ?? [];
  const canEdit = Boolean(user && user.role !== 'STUDENT' && view === 'class' && active?.timetable.id);

  const classSubjects = React.useMemo(
    () => gridData?.classes.find((c) => c.id === classId)?.subjects ?? [],
    [gridData, classId],
  );

  const perSubject = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const cell of cells) {
      if (!cell.subjectId || cell.isBreak) continue;
      counts.set(cell.subjectId, (counts.get(cell.subjectId) ?? 0) + 1);
    }
    return classSubjects
      .map((subject) => ({ ...subject, scheduled: counts.get(subject.id) ?? 0 }))
      .filter((subject) => subject.weeklyPeriods > 0)
      .sort((a, b) => a.scheduled - b.scheduled);
  }, [cells, classSubjects]);

  const runGenerate = async (publish: boolean, seed?: number) => {
    if (!classId) return;
    const yearId = academicYearId || gridData?.academic.currentAcademicYearId || '';
    if (!yearId) {
      toastError(new Error('Create an academic year first'), 'No academic year selected.');
      return;
    }
    try {
      const result = await api.post<GenerateResult>('/api/timetable/generate', { classId, academicYearId: yearId, publish, seed });
      setGenerateResult(result.data);
      toastSuccess(
        publish ? 'Timetable generated and published' : 'Timetable generated as a draft',
        `${result.data.placements} periods placed · ${result.data.conflicts.filter((c) => c.severity === 'ERROR').length} conflicts`,
      );
      void queryClient.invalidateQueries({ queryKey: ['api', '/api/timetable'] });
      void queryClient.invalidateQueries({ queryKey: ['api', '/api/timetable/conflicts'] });
      void grid.refetch();
    } catch (error) {
      toastError(error, 'The timetable could not be generated.');
    }
  };

  const changeStatus = async (status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    if (!active?.timetable.id) return;
    if (status !== 'DRAFT') {
      const ok = await confirm({
        title: status === 'PUBLISHED' ? 'Publish this timetable?' : 'Archive this timetable?',
        description:
          status === 'PUBLISHED'
            ? 'Students and faculty will see this schedule immediately, and other versions for the class are archived.'
            : 'The timetable is hidden from students and faculty. You can restore it by publishing another version.',
        confirmLabel: status === 'PUBLISHED' ? 'Publish' : 'Archive',
        tone: 'brand',
      });
      if (!ok) return;
    }
    try {
      await api.patch(`/api/timetable/${active.timetable.id}/status`, { status });
      toastSuccess(status === 'PUBLISHED' ? 'Timetable published' : status === 'DRAFT' ? 'Moved back to draft' : 'Timetable archived');
      void queryClient.invalidateQueries({ queryKey: ['api', '/api/timetable'] });
    } catch (error) {
      toastError(error, 'The status could not be changed.');
    }
  };

  const removeTimetable = async () => {
    if (!active?.timetable.id) return;
    const ok = await confirm({
      title: 'Delete this timetable version?',
      description: `Version ${active.timetable.version} for ${active.timetable.className ?? 'this class'} will be removed. Published schedules for other versions are unaffected.`,
      confirmLabel: 'Delete version',
    });
    if (!ok) return;
    try {
      await api.delete(`/api/timetable/${active.timetable.id}`);
      toastSuccess('Timetable version deleted');
      void queryClient.invalidateQueries({ queryKey: ['api', '/api/timetable'] });
    } catch (error) {
      toastError(error, 'That timetable could not be deleted.');
    }
  };

  if (grid.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Timetable"
        description={
          user?.role === 'STUDENT'
            ? 'Your published weekly schedule with rooms, laboratories and faculty for every period.'
            : 'Generate conflict-free weekly schedules, then review, adjust, publish and export them. Breaks, period length and working days come from institutional settings.'
        }
        icon={<CalendarDays />}
        meta={
          gridData ? (
            <>
              <Badge tone="neutral">{gridData.config.periodMinutes}-minute periods</Badge>
              <Badge tone="neutral">
                {gridData.config.workStart}–{gridData.config.workEnd}
              </Badge>
              <Badge tone="neutral">{gridData.config.workingDays.length} working days</Badge>
              {gridData.config.breaks.map((brk) => (
                <Badge key={brk.label} tone="info">
                  {brk.label} {brk.start}–{brk.end}
                </Badge>
              ))}
            </>
          ) : null
        }
        actions={
          user?.role !== 'STUDENT' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => window.print()} className="no-print">
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Print
              </Button>
              {active?.timetable.id ? (
                <>
                  <Button variant="secondary" size="sm" asChild className="no-print">
                    <a href={`/api/timetable/${active.timetable.id}/export?format=csv`} download>
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      CSV
                    </a>
                  </Button>
                  <Button variant="secondary" size="sm" asChild className="no-print">
                    <a href={`/api/timetable/${active.timetable.id}/export?format=ics`} download>
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Calendar
                    </a>
                  </Button>
                </>
              ) : null}
              <Button variant="primary" size="sm" onClick={() => setGenerateOpen(true)} className="no-print">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {active ? 'Regenerate' : 'Generate'}
              </Button>
            </>
          ) : null
        }
      />

      <Panel className="no-print">
        <PanelBody className="flex flex-wrap items-end gap-3">
          <Segmented value={view} onChange={(next) => setView(next)} options={VIEW_OPTIONS} ariaLabel="Timetable view" />

          {view === 'class' ? (
            <Field label="Class" className="min-w-[14rem] flex-1">
              <Select
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setTimetableId('');
                }}
                placeholder="Select a class"
                options={(gridData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · semester ${c.semester}` }))}
              />
            </Field>
          ) : view === 'faculty' ? (
            <Field label="Faculty" className="min-w-[14rem] flex-1">
              <Select
                value={facultyId}
                onChange={(event) => setFacultyId(event.target.value)}
                placeholder="Select a faculty member"
                options={(gridData?.faculty ?? []).map((f) => ({ value: f.id, label: `${f.name} (${f.employeeId})` }))}
              />
            </Field>
          ) : view === 'room' ? (
            <Field label="Room" className="min-w-[14rem] flex-1">
              <Select
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                placeholder="Select a room"
                options={(gridData?.rooms ?? []).map((room) => ({ value: room.id, label: `${room.code} — ${room.name}` }))}
              />
            </Field>
          ) : (
            <Field label="Laboratory" className="min-w-[14rem] flex-1">
              <Select
                value={laboratoryId}
                onChange={(event) => setLaboratoryId(event.target.value)}
                placeholder="Select a laboratory"
                options={(gridData?.laboratories ?? []).map((lab) => ({ value: lab.id, label: `${lab.code} — ${lab.name}` }))}
              />
            </Field>
          )}

          <Field label="Academic year" className="min-w-[11rem]">
            <Select
              value={academicYearId}
              onChange={(event) => setAcademicYearId(event.target.value)}
              placeholder="All years"
              options={(gridData?.academicYears ?? []).map((year) => ({ value: year.id, label: year.name + (year.isCurrent ? ' (current)' : '') }))}
            />
          </Field>

          {view === 'class' && versions.length > 1 ? (
            <Field label="Version" className="min-w-[12rem]">
              <Select
                value={timetableId || active?.timetable.id || ''}
                onChange={(event) => setTimetableId(event.target.value)}
                options={versions.map((version) => ({
                  value: version.id,
                  label: `v${version.version} · ${version.status.toLowerCase()} · ${formatDate(version.generatedAt, { day: '2-digit', month: 'short' })}`,
                }))}
              />
            </Field>
          ) : null}
        </PanelBody>
      </Panel>

      {view === 'class' && active ? (
        <StatGrid columns={4} className="no-print">
          <StatTile
            label="Status"
            value={active.timetable.status === 'PUBLISHED' ? 'Published' : active.timetable.status === 'DRAFT' ? 'Draft' : 'Archived'}
            tone={active.timetable.status === 'PUBLISHED' ? 'ok' : 'warn'}
            hint={`Version ${active.timetable.version} · generated ${formatDate(active.timetable.generatedAt, { day: '2-digit', month: 'short', year: 'numeric' })}`}
            icon={<ShieldCheck />}
          />
          <StatTile label="Periods scheduled" value={cells.filter((cell) => cell.subjectId && !cell.isBreak).length} tone="brand" hint={`Across ${days.length} working days`} />
          <StatTile
            label="Hard conflicts"
            value={conflicts.data?.data?.errors ?? 0}
            tone={(conflicts.data?.data?.errors ?? 0) > 0 ? 'danger' : 'ok'}
            hint={`${conflicts.data?.data?.warnings ?? 0} warnings`}
            icon={<AlertTriangle />}
          />
          <StatTile
            label="Subjects below requirement"
            value={perSubject.filter((subject) => subject.scheduled < subject.weeklyPeriods).length}
            tone={perSubject.some((subject) => subject.scheduled < subject.weeklyPeriods) ? 'warn' : 'ok'}
            hint="Weekly periods placed vs required"
          />
        </StatGrid>
      ) : null}

      {view === 'class' && active ? (
        <Panel className="no-print">
          <PanelHeader
            title={`${active.timetable.className ?? 'Class'} · version ${active.timetable.version}`}
            subtitle={active.timetable.notes ?? 'Generated by the CampusIQ constraint engine'}
            icon={<CalendarDays />}
            actions={
              <div className="flex flex-wrap items-center gap-1.5">
                {active.timetable.status !== 'PUBLISHED' ? (
                  <Button size="sm" variant="primary" onClick={() => changeStatus('PUBLISHED')}>
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Publish
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => changeStatus('DRAFT')}>
                    Move to draft
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => changeStatus('ARCHIVED')}>
                  Archive
                </Button>
                <Button size="sm" variant="ghost" onClick={removeTimetable} className="text-danger-fg">
                  Delete
                </Button>
              </div>
            }
          />
        </Panel>
      ) : null}

      {conflictRows.length > 0 && view === 'class' ? (
        <Alert
          tone={conflictRows.some((c) => c.severity === 'ERROR') ? 'danger' : 'warning'}
          title={`${conflictRows.filter((c) => c.severity === 'ERROR').length} hard conflict(s), ${conflictRows.filter((c) => c.severity === 'WARNING').length} warning(s)`}
          icon={<AlertTriangle />}
        >
          Review the conflict report below before publishing.
        </Alert>
      ) : null}

      <Panel>
        <PanelHeader
          title={view === 'class' ? 'Weekly schedule' : view === 'faculty' ? 'Faculty schedule' : view === 'room' ? 'Room schedule' : 'Laboratory schedule'}
          subtitle={canEdit ? 'Click any period to change the subject, faculty, room or laboratory.' : 'Read-only view of the published schedule.'}
          icon={<CalendarDays />}
          actions={<SubjectLegend cells={cells} />}
        />
        {timetable.isLoading ? (
          <PanelBody>
            <Skeleton className="h-80 w-full rounded" />
          </PanelBody>
        ) : timetable.isError ? (
          <ErrorState error={timetable.error} onRetry={() => timetable.refetch()} title="Could not load the timetable" />
        ) : cells.length === 0 && view !== 'class' ? (
          <EmptyState
            icon={<CalendarDays />}
            title="Nothing scheduled"
            description={
              view === 'faculty'
                ? 'This faculty member has no periods in the selected academic year.'
                : view === 'room'
                  ? 'This room is not used by any published timetable yet.'
                  : 'This laboratory is not used by any published timetable yet.'
            }
          />
        ) : view === 'class' && !active ? (
          <EmptyState
            icon={<Sparkles />}
            title="No timetable for this class yet"
            description={
              user?.role === 'STUDENT'
                ? 'Your department has not published a schedule for this class. You will be notified as soon as it is available.'
                : 'Generate one with the constraint engine — it respects faculty availability, rooms, laboratories, weekly period requirements and your configured breaks.'
            }
            action={
              user?.role !== 'STUDENT' ? (
                <Button variant="primary" size="sm" onClick={() => setGenerateOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Generate timetable
                </Button>
              ) : undefined
            }
          />
        ) : (
          <PanelBody className="p-2 sm:p-3">
            <TimetableGrid
              grid={gridSlots}
              days={days}
              cells={cells}
              showClass={view !== 'class'}
              showFaculty={view !== 'faculty'}
              caption="Weekly timetable"
              onCellClick={canEdit ? (day, slot, cell) => setEditing({ day, slot, cell }) : undefined}
            />
          </PanelBody>
        )}
      </Panel>

      {view === 'class' && active ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel className="no-print">
            <PanelHeader title="Weekly requirement check" subtitle="Periods placed against each subject’s weekly requirement" icon={<Info />} />
            <PanelBody className="py-2">
              {perSubject.length === 0 ? (
                <EmptyState compact title="No subjects placed" description="Generate a timetable to see requirement coverage." />
              ) : (
                <ul className="divide-y divide-line/70">
                  {perSubject.map((subject) => {
                    const shortfall = subject.weeklyPeriods - subject.scheduled;
                    return (
                      <li key={subject.id}>
                        <StackItem
                          tone={shortfall > 0 ? 'warn' : 'ok'}
                          title={`${subject.code} · ${subject.name}`}
                          detail={
                            shortfall > 0
                              ? `${shortfall} period${shortfall === 1 ? '' : 's'} short of the ${subject.weeklyPeriods} weekly requirement`
                              : `All ${subject.weeklyPeriods} weekly periods placed`
                          }
                          metric={`${subject.scheduled}/${subject.weeklyPeriods}`}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel className="no-print">
            <PanelHeader
              title="Conflict report"
              subtitle="Faculty, room, laboratory, break and distribution checks"
              icon={<ShieldCheck />}
              actions={
                <Button size="sm" variant="ghost" onClick={() => conflicts.refetch()} disabled={conflicts.isFetching}>
                  <RefreshCcw className={cn('h-3.5 w-3.5', conflicts.isFetching && 'animate-spin')} aria-hidden />
                  Re-check
                </Button>
              }
            />
            <PanelBody className="py-2">
              {conflicts.isLoading ? (
                <Skeleton className="h-32 w-full rounded" />
              ) : conflictRows.length === 0 ? (
                <EmptyState compact icon={<CheckCircle2 />} title="No conflicts detected" description="Every hard constraint is satisfied for this timetable." />
              ) : (
                <ul className="divide-y divide-line/70">
                  {conflictRows.map((conflict, index) => (
                    <li key={`${conflict.type}-${index}`}>
                      <StackItem
                        tone={conflict.severity === 'ERROR' ? 'danger' : 'warn'}
                        title={
                          <span className="flex flex-wrap items-center gap-2">
                            {conflict.type.replace(/_/g, ' ').toLowerCase()}
                            <Badge tone={conflict.severity === 'ERROR' ? 'danger' : 'warn'}>{conflict.severity}</Badge>
                            {conflict.day ? <Badge tone="neutral">{conflict.day.slice(0, 3)} P{conflict.periodIndex}</Badge> : null}
                          </span>
                        }
                        detail={conflict.message}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>
      ) : null}

      {editing && active?.timetable.id ? (
        <SlotEditor
          open
          onOpenChange={(open) => !open && setEditing(null)}
          timetableId={active.timetable.id}
          day={editing.day}
          slot={editing.slot}
          cell={editing.cell}
          classSubjects={classSubjects}
          onSaved={() => {
            void timetable.refetch();
            void conflicts.refetch();
          }}
        />
      ) : null}

      <GenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        classes={gridData?.classes ?? []}
        academicYears={gridData?.academicYears ?? []}
        defaultClassId={classId}
        defaultYearId={academicYearId || gridData?.academic.currentAcademicYearId || ''}
        result={generateResult}
        onResult={setGenerateResult}
        onGenerate={runGenerate}
      />
    </>
  );
}

function GenerateDialog({
  open,
  onOpenChange,
  classes,
  academicYears,
  defaultClassId,
  defaultYearId,
  result,
  onResult,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: { id: string; name: string }[];
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  defaultClassId: string;
  defaultYearId: string;
  result: GenerateResult | null;
  onResult: (result: GenerateResult | null) => void;
  onGenerate: (publish: boolean, seed?: number) => Promise<void>;
}) {
  const [classId, setClassId] = React.useState(defaultClassId);
  const [yearId, setYearId] = React.useState(defaultYearId);
  const [publish, setPublish] = React.useState(false);
  const [seed, setSeed] = React.useState('');
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setClassId(defaultClassId);
    setYearId(defaultYearId);
    onResult(null);
  }, [open, defaultClassId, defaultYearId, onResult]);

  const run = async (randomSeed: boolean) => {
    setRunning(true);
    try {
      const parsed = Number(seed);
      const value = randomSeed
        ? Math.floor(Math.random() * 999999)
        : seed.trim() && Number.isFinite(parsed)
          ? parsed
          : undefined;
      await onGenerate(publish, value);
    } finally {
      setRunning(false);
    }
  };

  const errors = result?.conflicts.filter((c) => c.severity === 'ERROR') ?? [];
  const warnings = result?.conflicts.filter((c) => c.severity === 'WARNING') ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Generate a timetable" description="The scheduler places every weekly period while respecting faculty availability, rooms, laboratories and your configured breaks.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Class" htmlFor="gen-class" required>
              <Select id="gen-class" value={classId} onChange={(event) => setClassId(event.target.value)} placeholder="Select a class" options={classes.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label="Academic year" htmlFor="gen-year" required>
              <Select
                id="gen-year"
                value={yearId}
                onChange={(event) => setYearId(event.target.value)}
                placeholder="Select an academic year"
                options={academicYears.map((year) => ({ value: year.id, label: year.name + (year.isCurrent ? ' (current)' : '') }))}
              />
            </Field>
          </div>

          <Field label="Random seed (optional)" htmlFor="gen-seed" hint="Leave blank for a fresh arrangement each run.">
            <Input
              id="gen-seed"
              type="number"
              min={0}
              max={999999}
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              placeholder="e.g. 4242"
            />
          </Field>

          <div className="rounded-md border border-line bg-raised p-3">
            <Checkbox
              id="gen-publish"
              label="Publish immediately"
              checked={publish}
              onCheckedChange={(value) => setPublish(value === true)}
            />
            <p className="mt-1.5 text-xs text-muted">
              Unpublished timetables are saved as drafts. Publishing notifies every student in the class and archives older versions.
            </p>
          </div>

          {result ? (
            <div className="space-y-3 rounded-md border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={errors.length ? 'danger' : 'ok'}>{errors.length} hard conflicts</Badge>
                <Badge tone={warnings.length ? 'warn' : 'neutral'}>{warnings.length} warnings</Badge>
                <Badge tone="brand">{result.placements} periods placed</Badge>
                <Badge tone="neutral">Version {result.version}</Badge>
                <Badge tone={result.status === 'PUBLISHED' ? 'ok' : 'info'}>{result.status.toLowerCase()}</Badge>
              </div>

              {result.warnings.length ? (
                <ul className="space-y-1">
                  {result.warnings.slice(0, 6).map((warning, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs text-muted">
                      <span
                        className={cn(
                          'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                          warning.level === 'ERROR' ? 'bg-danger' : warning.level === 'WARN' ? 'bg-warn' : 'bg-info',
                        )}
                        aria-hidden
                      />
                      {warning.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              {errors.length ? (
                <Alert tone="danger" title="Resolve these before publishing">
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {errors.slice(0, 5).map((conflict, index) => (
                      <li key={index}>{conflict.message}</li>
                    ))}
                  </ul>
                </Alert>
              ) : (
                <Alert tone="success" title="Every hard constraint is satisfied" icon={<CheckCircle2 className="h-4 w-4" />}>
                  You can publish this version, or regenerate for a different arrangement.
                </Alert>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Tooltip label="Try a different arrangement with another random seed">
            <span>
              <Button variant="secondary" size="sm" onClick={() => run(true)} loading={running} disabled={running || !classId || !yearId}>
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                {result ? 'Regenerate' : 'Generate alternative'}
              </Button>
            </span>
          </Tooltip>
          <Button variant="primary" size="sm" onClick={() => run(false)} loading={running} disabled={running || !classId || !yearId}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {result ? 'Generate again' : 'Generate timetable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
