'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  CheckCheck,
  ClipboardCheck,
  Clock,
  Eraser,
  ListChecks,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  Users,
} from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn, percent } from '@/lib/utils';
import { formatDate, toDateInputValue } from '@/lib/format';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { useConfirm } from '@/hooks/use-confirm';
import { Alert } from '@/components/ui/alert';
import { Badge, BandBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader, StackItem, StatGrid, StatTile } from '@/components/ui/panel';
import { Field, Input, SearchInput, Select } from '@/components/ui/form';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/dialog';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/states';
import { ProgressBar, toneFor } from '@/components/ui/progress';
import { toastError, toastSuccess } from '@/components/ui/toaster';

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface RosterStudent {
  id: string;
  registerNumber: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  subjectPercentage: number;
  overallPercentage: number;
  existingStatus?: Status;
}

interface RosterResponse {
  roster: RosterStudent[];
  session: {
    id: string;
    date: string;
    periodIndex: number;
    topic?: string | null;
    notes?: string | null;
    status: string;
    totalStudents: number;
    presentCount: number;
    absentCount: number;
  } | null;
  thresholds: { safe: number; fine: number; debar: number };
}

interface GridSlot {
  index: number;
  teachingIndex: number | null;
  kind: 'PERIOD' | 'BREAK';
  label: string;
  startTime: string;
  endTime: string;
}

interface ClassOption {
  id: string;
  name: string;
  yearOfStudy: number;
  section: string;
  semester: number;
  departmentId: string;
  departmentName: string;
  studentCount: number;
  subjects: { id: string; code: string; name: string; weeklyPeriods: number; subjectType: string }[];
}

interface QueueItem {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  takenToday: boolean;
}

interface RecentSession {
  id: string;
  date: string;
  periodIndex: number;
  subjectName: string;
  subjectCode: string;
  className: string;
  presentCount: number;
  totalStudents: number;
  percentage: number;
}

const STATUS_OPTIONS: { value: Status; label: string; short: string; tone: string }[] = [
  { value: 'PRESENT', label: 'Present', short: 'P', tone: 'bg-ok text-white' },
  { value: 'ABSENT', label: 'Absent', short: 'A', tone: 'bg-danger text-white' },
  { value: 'LATE', label: 'Late', short: 'L', tone: 'bg-warn text-white' },
  { value: 'EXCUSED', label: 'Excused', short: 'E', tone: 'bg-info text-white' },
];

/**
 * Faculty attendance marking.
 *
 * Flow: pick date → class → subject → period, then mark the roster with a
 * single tap per student (or "Mark all present"). Nothing is written until Save,
 * and the last saved session can be undone (deleted) from the confirmation.
 */
export function AttendanceMarking() {
  const { user, thresholds: sessionThresholds } = useSession();
  const confirm = useConfirm();
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();

  const [date, setDate] = React.useState(() => toDateInputValue(new Date()));
  const [classId, setClassId] = React.useState('');
  const [subjectId, setSubjectId] = React.useState('');
  const [periodIndex, setPeriodIndex] = React.useState<number | ''>('');
  const [topic, setTopic] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [statuses, setStatuses] = React.useState<Record<string, Status>>({});
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [lastSaved, setLastSaved] = React.useState<{ sessionId: string; label: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [undoOpen, setUndoOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const gridQuery = useApi<{ grid: GridSlot[] }>('/api/timetable/grid');
  const classesQuery = useApi<{ classes: ClassOption[] }>('/api/classes');
  const analyticsQuery = useApi<{ queue: { pending: QueueItem[]; recent: RecentSession[]; todayTaken: number } | null }>('/api/attendance/analytics');

  const rosterQuery = useApi<RosterResponse>(
    '/api/attendance/roster',
    { classId, subjectId, date, periodIndex },
    { enabled: Boolean(classId && subjectId && periodIndex !== '') },
  );

  const roster = rosterQuery.data?.data?.roster ?? [];
  const existingSession = rosterQuery.data?.data?.session ?? null;
  const thresholds = rosterQuery.data?.data?.thresholds ?? sessionThresholds ?? { safe: 80, fine: 75, debar: 70 };
  const classes = classesQuery.data?.data?.classes ?? [];
  const grid = (gridQuery.data?.data?.grid ?? []).filter((slot) => slot.kind === 'PERIOD');
  const queue = analyticsQuery.data?.data?.queue;

  const selectedClass = classes.find((c) => c.id === classId);
  const subjectsForClass = selectedClass?.subjects ?? [];

  // Load the stored session (edit mode) or start from "everyone present".
  React.useEffect(() => {
    if (!rosterQuery.data) return;
    const next: Record<string, Status> = {};
    for (const student of rosterQuery.data.data.roster) {
      next[student.id] = student.existingStatus ?? 'PRESENT';
    }
    setStatuses(next);
    setSessionId(rosterQuery.data.data.session?.id ?? null);
    setTopic(rosterQuery.data.data.session?.topic ?? '');
    setNotes(rosterQuery.data.data.session?.notes ?? '');
  }, [rosterQuery.data]);

  const setAll = (status: Status) => setStatuses((current) => Object.fromEntries(Object.keys(current).map((id) => [id, status])));
  const setStatus = (id: string, status: Status) => setStatuses((current) => ({ ...current, [id]: status }));

  const counts = React.useMemo(() => {
    const values = Object.values(statuses);
    return {
      total: values.length,
      present: values.filter((v) => v === 'PRESENT').length,
      absent: values.filter((v) => v === 'ABSENT').length,
      late: values.filter((v) => v === 'LATE').length,
      excused: values.filter((v) => v === 'EXCUSED').length,
    };
  }, [statuses]);

  const credited = counts.present + counts.excused + counts.late;
  const percentage = counts.total ? percent(credited, counts.total) : 0;

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roster;
    return roster.filter((student) =>
      [student.firstName, student.lastName, student.registerNumber, student.rollNumber ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [roster, search]);

  const canSave = Boolean(classId && subjectId && periodIndex !== '' && counts.total > 0);

  const save = async () => {
    if (!canSave || !selectedClass) return;
    setFormError(null);
    setSaving(true);
    const slot = grid.find((g) => g.index === periodIndex);
    try {
      const result = await api.post<{ sessionId: string }>('/api/attendance', {
        subjectId,
        classId,
        date: new Date(`${date}T00:00:00.000Z`),
        periodIndex,
        startTime: slot?.startTime,
        endTime: slot?.endTime,
        topic: topic.trim() || undefined,
        notes: notes.trim() || undefined,
        status: 'COMPLETED',
        records: Object.entries(statuses).map(([studentId, status]) => ({ studentId, status })),
      });
      const id = result.data.sessionId;
      setSessionId(id);
      setLastSaved({
        sessionId: id,
        label: `${subjectsForClass.find((s) => s.id === subjectId)?.code ?? 'Subject'} · ${selectedClass.name} · ${formatDate(date, { day: '2-digit', month: 'short' })} P${slot?.teachingIndex ?? periodIndex}`,
      });
      toastSuccess(existingSession ? 'Attendance updated' : 'Attendance saved', `${counts.present + counts.late + counts.excused} of ${counts.total} marked present.`);
      invalidate('/api/attendance', '/api/dashboard');
      void queryClient.invalidateQueries({ queryKey: ['api', '/api/attendance/roster'] });
      void analyticsQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Attendance could not be saved.';
      setFormError(message);
      toastError(error, 'Attendance was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const undoLast = async () => {
    if (!lastSaved) return;
    try {
      await api.delete(`/api/attendance/sessions/${lastSaved.sessionId}`);
      toastSuccess('Session removed', 'The saved attendance was deleted. You can mark it again.');
      setLastSaved(null);
      setSessionId(null);
      invalidate('/api/attendance', '/api/dashboard');
      void rosterQuery.refetch();
      void analyticsQuery.refetch();
    } catch (error) {
      toastError(error, 'That session could not be removed.');
    } finally {
      setUndoOpen(false);
    }
  };

  const reset = () => {
    setClassId('');
    setSubjectId('');
    setPeriodIndex('');
    setTopic('');
    setNotes('');
    setSessionId(null);
    setStatuses({});
    setFormError(null);
  };

  const takeFromQueue = (item: QueueItem) => {
    setClassId(item.classId);
    setSubjectId(item.subjectId);
    setFormError(null);
  };

  return (
    <div className="space-y-4">
      {queue ? (
        <StatGrid columns={4}>
          <StatTile label="Periods today" value={queue.pending.length + queue.todayTaken} tone="brand" hint={`${queue.todayTaken} already marked`} icon={<Clock />} />
          <StatTile label="Still to mark" value={queue.pending.filter((p) => !p.takenToday).length} tone={queue.pending.some((p) => !p.takenToday) ? 'warn' : 'ok'} hint="From your assigned classes" icon={<ListChecks />} />
          <StatTile label="Selected roster" value={counts.total} hint={selectedClass ? selectedClass.name : 'Choose a class'} icon={<Users />} />
          <StatTile
            label="This session"
            value={counts.total ? `${percentage.toFixed(0)}%` : '—'}
            tone={counts.total ? (percentage >= thresholds.safe ? 'ok' : percentage >= thresholds.fine ? 'warn' : 'danger') : 'neutral'}
            hint={`${counts.present + counts.late + counts.excused} present · ${counts.absent} absent`}
            icon={<CalendarCheck />}
          />
        </StatGrid>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="1 · Choose the session"
              subtitle={existingSession ? 'Editing a session that already exists — saving will update it.' : 'Pick a date, class, subject and period to load the roster.'}
              icon={<ClipboardCheck />}
              actions={
                existingSession ? (
                  <Badge tone="info" icon={<Pencil />}>
                    Editing
                  </Badge>
                ) : (classId || subjectId || periodIndex !== '') && (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <Eraser className="h-3.5 w-3.5" aria-hidden />
                    Clear
                  </Button>
                )
              }
            />
            <PanelBody>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Date" htmlFor="mark-date" required>
                  <Input id="mark-date" type="date" value={date} max={toDateInputValue(new Date())} onChange={(event) => setDate(event.target.value)} />
                </Field>

                <Field label="Class" htmlFor="mark-class" required hint={selectedClass ? `${selectedClass.studentCount} students · semester ${selectedClass.semester}` : undefined}>
                  <Select
                    id="mark-class"
                    value={classId}
                    onChange={(event) => {
                      setClassId(event.target.value);
                      setSubjectId('');
                    }}
                    placeholder={classesQuery.isLoading ? 'Loading classes…' : 'Select a class'}
                    options={classes.map((c) => ({ value: c.id, label: `${c.departmentName} · ${c.name}` }))}
                  />
                </Field>

                <Field label="Subject" htmlFor="mark-subject" required>
                  <Select
                    id="mark-subject"
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
                    placeholder={classId ? 'Select a subject' : 'Choose a class first'}
                    options={subjectsForClass.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
                  />
                </Field>

                <Field label="Period" htmlFor="mark-period" required>
                  <Select
                    id="mark-period"
                    value={periodIndex === '' ? '' : String(periodIndex)}
                    onChange={(event) => setPeriodIndex(event.target.value === '' ? '' : Number(event.target.value))}
                    placeholder="Select a period"
                    options={grid.map((slot) => ({
                      value: String(slot.index),
                      label: `P${slot.teachingIndex} · ${slot.startTime}–${slot.endTime}`,
                    }))}
                  />
                </Field>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="Topic covered (optional)" htmlFor="mark-topic">
                  <Input id="mark-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. Normalisation and 3NF" maxLength={160} />
                </Field>
                <Field label="Notes (optional)" htmlFor="mark-notes">
                  <Input id="mark-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Visible to students in their history" maxLength={400} />
                </Field>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="2 · Mark the roster"
              subtitle={
                roster.length
                  ? `${roster.length} student${roster.length === 1 ? '' : 's'} · default is Present, tap to change`
                  : 'Load a session to see the student list'
              }
              icon={<Users />}
              actions={
                roster.length ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setAll('PRESENT')}>
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                      Mark all present
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAll('ABSENT')}>
                      All absent
                    </Button>
                  </div>
                ) : null
              }
            />

            {roster.length > 0 ? (
              <PanelBody className="border-b border-line bg-raised/60 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <SearchInput
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Find a student by name or register number"
                    className="min-w-[14rem] flex-1"
                    aria-label="Search roster"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {STATUS_OPTIONS.map((option) => (
                      <span key={option.value} className="flex items-center gap-1.5">
                        <span className={cn('grid h-5 w-5 place-items-center rounded text-2xs font-bold text-white', option.tone)} aria-hidden>
                          {option.short}
                        </span>
                        {counts[option.value.toLowerCase() as 'present' | 'absent' | 'late' | 'excused']}
                      </span>
                    ))}
                  </div>
                </div>
              </PanelBody>
            ) : null}

            <PanelBody className="py-2">
              {rosterQuery.isLoading ? (
                <SkeletonRows rows={6} />
              ) : rosterQuery.isError ? (
                <ErrorState error={rosterQuery.error} onRetry={() => rosterQuery.refetch()} title="Could not load the roster" />
              ) : roster.length === 0 ? (
                <EmptyState
                  icon={<Users />}
                  title="No roster loaded"
                  description="Choose a date, class, subject and period above. Students appear here with their current subject and overall attendance."
                />
              ) : filtered.length === 0 ? (
                <EmptyState compact title={`No student matches “${search}”`} description="Clear the search to see the full roster." />
              ) : (
                <ul className="divide-y divide-line/70">
                  {filtered.map((student) => {
                    const status = statuses[student.id] ?? 'PRESENT';
                    return (
                      <li key={student.id} className="flex flex-wrap items-center gap-3 py-2.5">
                        <Avatar name={`${student.firstName} ${student.lastName}`} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.8125rem] font-medium text-ink">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {student.registerNumber}
                            {student.rollNumber ? ` · Roll ${student.rollNumber}` : ''}
                          </p>
                        </div>

                        <div className="hidden w-40 shrink-0 sm:block">
                          <p className="mb-1 flex items-center justify-between text-2xs text-subtle">
                            <span>Subject</span>
                            <span className="tnum font-semibold text-muted">{student.subjectPercentage.toFixed(0)}%</span>
                          </p>
                          <ProgressBar value={student.subjectPercentage} tone={toneFor(student.subjectPercentage, thresholds)} size="sm" label={`${student.firstName} subject attendance`} />
                          <p className="mt-1 flex items-center justify-between text-2xs text-subtle">
                            <span>Overall</span>
                            <span className="tnum font-semibold text-muted">{student.overallPercentage.toFixed(0)}%</span>
                          </p>
                          <ProgressBar value={student.overallPercentage} tone={toneFor(student.overallPercentage, thresholds)} size="sm" label={`${student.firstName} overall attendance`} />
                        </div>

                        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Attendance for ${student.firstName} ${student.lastName}`}>
                          {STATUS_OPTIONS.map((option) => {
                            const active = status === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setStatus(student.id, option.value)}
                                aria-pressed={active}
                                title={option.label}
                                className={cn(
                                  'grid h-8 w-8 place-items-center rounded-md border text-2xs font-bold transition-all duration-150',
                                  active
                                    ? cn(option.tone, 'border-transparent shadow-card')
                                    : 'border-line bg-surface text-subtle hover:border-line-strong hover:text-ink',
                                )}
                              >
                                {option.short}
                                <span className="sr-only">{option.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>

            {roster.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-raised px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="tnum">
                    <strong className="font-semibold text-ink">{counts.present + counts.late + counts.excused}</strong>/{counts.total} present
                  </span>
                  <span className="tnum flex items-center gap-1.5">
                    Session percentage
                    <strong className="font-semibold text-ink">{percentage.toFixed(1)}%</strong>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lastSaved ? (
                    <Button variant="ghost" size="sm" onClick={() => setUndoOpen(true)}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      Undo last save
                    </Button>
                  ) : null}
                  <Button variant="primary" size="md" onClick={save} loading={saving} disabled={!canSave || saving}>
                    <Save className="h-4 w-4" aria-hidden />
                    {existingSession ? 'Update attendance' : 'Save attendance'}
                  </Button>
                </div>
              </div>
            ) : null}
          </Panel>

          {formError ? (
            <Alert tone="danger" title="Attendance was not saved" onDismiss={() => setFormError(null)}>
              {formError}
            </Alert>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Today’s queue" subtitle="Classes you teach, straight from the timetable" icon={<ListChecks />} />
            <PanelBody className="py-2">
              {!queue?.pending.length ? (
                <EmptyState compact title="No classes assigned" description="Once subjects are assigned to you, today’s classes appear here for one-tap marking." />
              ) : (
                <ul className="divide-y divide-line/70">
                  {queue.pending.map((item) => (
                    <li key={`${item.classId}-${item.subjectId}`}>
                      <StackItem
                        onClick={() => takeFromQueue(item)}
                        tone={item.takenToday ? 'ok' : 'warn'}
                        title={`${item.subjectCode} · ${item.className}`}
                        detail={item.subjectName}
                        metric={item.takenToday ? 'Done' : 'Mark'}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Recent sessions" subtitle="Edit or remove a session you already saved" icon={<Clock />} />
            <RecentSessions
              sessions={queue?.recent ?? []}
              loading={analyticsQuery.isLoading}
              onDelete={async (session) => {
                const confirmed = await confirm({
                  title: 'Delete this attendance session?',
                  description: (
                    <>
                      Removing <strong className="font-semibold text-ink">{session.subjectName}</strong> for{' '}
                      <strong className="font-semibold text-ink">{session.className}</strong> on{' '}
                      {formatDate(session.date, { day: '2-digit', month: 'short', year: 'numeric' })} deletes{' '}
                      {session.totalStudents} student records. Attendance percentages recalculate immediately.
                    </>
                  ),
                  confirmLabel: 'Delete session',
                });
                if (!confirmed) return;
                try {
                  await api.delete(`/api/attendance/sessions/${session.id}`);
                  toastSuccess('Session deleted');
                  invalidate('/api/attendance', '/api/dashboard');
                  void analyticsQuery.refetch();
                  void rosterQuery.refetch();
                } catch (error) {
                  toastError(error, 'That session could not be deleted.');
                }
              }}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Attendance analytics" icon={<ClipboardCheck />} />
            <PanelBody className="space-y-2 text-[0.8125rem] text-muted">
              <p>
                Percentages credit <strong className="font-semibold text-ink">Present</strong>
                {thresholds.safe ? ', ' : ''}
                <strong className="font-semibold text-ink">Excused</strong> and (per your settings){' '}
                <strong className="font-semibold text-ink">Late</strong>. Limits: safe ≥ {thresholds.safe}%, fine below {thresholds.fine}%,
                debar below {thresholds.debar}%.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <BandBadge band="SAFE" />
                <BandBadge band="AT_RISK" />
                <BandBadge band="FINE" />
                <BandBadge band="DEBARRED" />
              </div>
              <Button variant="secondary" size="sm" className="mt-2 w-full justify-center" asChild>
                <Link href="/analytics">Open full analytics</Link>
              </Button>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={undoOpen}
        onOpenChange={setUndoOpen}
        title="Undo the last saved session?"
        description={
          lastSaved ? (
            <>
              This deletes <strong className="font-semibold text-ink">{lastSaved.label}</strong> and every student record in it. You can
              mark the session again straight away.
            </>
          ) : null
        }
        confirmLabel="Delete session"
        onConfirm={undoLast}
      />
    </div>
  );
}

function RecentSessions({
  sessions,
  loading,
  onDelete,
}: {
  sessions: RecentSession[];
  loading?: boolean;
  onDelete: (session: RecentSession) => void;
}) {
  const columns: Column<RecentSession>[] = [
    {
      key: 'session',
      header: 'Session',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.subjectName}</p>
          <p className="truncate text-xs text-muted">
            {formatDate(row.date, { day: '2-digit', month: 'short' })} · P{row.periodIndex} · {row.className}
          </p>
        </div>
      ),
    },
    {
      key: 'percentage',
      header: 'Present',
      align: 'right',
      label: 'Present',
      cell: (row) => (
        <span className="tnum text-sm text-ink">
          {row.presentCount}/{row.totalStudents}
          <span className="ml-1.5 text-xs text-muted">{row.percentage.toFixed(0)}%</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      label: 'Actions',
      align: 'right',
      cell: (row) => (
        <Button size="xs" variant="ghost" onClick={() => onDelete(row)} aria-label={`Delete ${row.subjectName} session on ${formatDate(row.date)}`}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Delete
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <PanelBody>
        <SkeletonRows rows={4} />
      </PanelBody>
    );
  }
  if (!sessions.length) {
    return <EmptyState compact title="No sessions yet" description="Saved sessions appear here so you can correct or remove them." />;
  }

  return <DataTable columns={columns} rows={sessions} rowKey={(row) => row.id} dense />;
}

export function SessionsBrowser() {
  const { user } = useSession();
  const [page, setPage] = React.useState(1);
  const [classId, setClassId] = React.useState('');
  const [subjectId, setSubjectId] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');

  const classesQuery = useApi<{ classes: ClassOption[] }>('/api/classes');
  const classes = classesQuery.data?.data?.classes ?? [];
  const subjects = React.useMemo(() => {
    const selected = classes.find((c) => c.id === classId);
    const list = selected ? selected.subjects : classes.flatMap((c) => c.subjects);
    const seen = new Map<string, { id: string; code: string; name: string }>();
    for (const subject of list) seen.set(subject.id, subject);
    return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [classes, classId]);

  const sessions = useApi<RecentSession[]>(
    '/api/attendance/sessions',
    { page, pageSize: 20, classId, subjectId, from, to, facultyId: user?.role === 'FACULTY' ? user.facultyId : undefined },
    { keepPreviousData: true },
  );

  const rows = sessions.data?.data ?? [];
  const meta = sessions.data?.meta;

  const columns: Column<RecentSession & { id: string }>[] = [
    {
      key: 'date',
      header: 'Date',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{formatDate(row.date, { weekday: 'short', day: '2-digit', month: 'short' })}</p>
          <p className="truncate text-xs text-muted">Period {row.periodIndex}</p>
        </div>
      ),
    },
    { key: 'subject', header: 'Subject', label: 'Subject', cell: (row) => <span className="text-sm text-ink">{row.subjectName}</span> },
    { key: 'class', header: 'Class', label: 'Class', cell: (row) => <span className="text-sm text-muted">{row.className}</span> },
    {
      key: 'present',
      header: 'Present',
      align: 'right',
      label: 'Present',
      cell: (row) => (
        <span className="tnum text-sm text-ink">
          {row.presentCount}/{row.totalStudents}
        </span>
      ),
    },
    {
      key: 'percentage',
      header: '%',
      align: 'right',
      label: 'Percentage',
      cell: (row) => (
        <span className="flex items-center justify-end gap-2">
          <ProgressBar value={row.percentage} size="sm" className="w-14" tone={row.percentage >= 80 ? 'ok' : row.percentage >= 70 ? 'warn' : 'danger'} />
          <span className="tnum w-10 text-right text-sm font-semibold text-ink">{row.percentage.toFixed(0)}%</span>
        </span>
      ),
    },
  ];

  return (
    <Panel>
      <PanelHeader title="Recorded sessions" subtitle="Every saved attendance session, newest first" icon={<CalendarCheck />} />
      <PanelBody className="border-b border-line bg-raised/60 py-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Class">
            <Select value={classId} onChange={(event) => { setClassId(event.target.value); setPage(1); }} placeholder="All classes" options={classes.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="Subject">
            <Select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setPage(1); }} placeholder="All subjects" options={subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))} />
          </Field>
          <Field label="From">
            <input type="date" className="input" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          </Field>
          <Field label="To">
            <input type="date" className="input" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          </Field>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              disabled={!classId && !subjectId && !from && !to}
              onClick={() => {
                setClassId('');
                setSubjectId('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </PanelBody>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={sessions.isLoading}
        error={sessions.error}
        onRetry={() => sessions.refetch()}
        page={page}
        pageSize={20}
        total={meta?.total ?? 0}
        totalPages={meta?.totalPages ?? 1}
        onPageChange={setPage}
        empty={{ title: 'No sessions recorded', description: 'Mark attendance and the sessions will be listed here.' }}
        onRowClick={undefined}
      />
      <div className="border-t border-line px-4 py-2 text-xs text-muted">
        Tip: re-saving the same date, class, subject and period updates that session instead of creating a duplicate.
      </div>
    </Panel>
  );
}
