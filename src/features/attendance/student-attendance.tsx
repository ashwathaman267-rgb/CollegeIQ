'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarRange, ClipboardCheck, Info, ShieldAlert, TrendingUp } from 'lucide-react';

import { cn, round } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { Alert } from '@/components/ui/alert';
import { BandBadge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { DistributionDonut, TrendChart } from '@/components/ui/charts';
import { DeltaTag, MetricRow, ProgressBar, toneFor } from '@/components/ui/progress';
import { DataTable, type Column } from '@/components/ui/table';
import { Field, Select } from '@/components/ui/form';
import { EmptyState, ErrorState, SkeletonRows, SkeletonTiles } from '@/components/ui/states';
import { Tabs } from '@/components/ui/dropdown';

interface AttendanceTotals {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
  band: { key: string; label: string; description?: string };
  bandKey: string;
}

interface SubjectAttendance extends AttendanceTotals {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  classesNeeded: number;
  lastClass?: string;
}

interface Summary {
  overall: AttendanceTotals;
  subjects: SubjectAttendance[];
  monthly: { key: string; label: string; total: number; present: number; percentage: number }[];
  delta: number | null;
  atRiskSubjects: SubjectAttendance[];
  classesNeededForSafe: number;
  thresholds: { safe: number; fine: number; debar: number; countLateAsPresent: boolean };
  lastUpdated?: string;
}

interface HistoryItem {
  id: string;
  date: string;
  status: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  periodIndex: number;
  sessionId: string;
  remarks?: string | null;
  faculty?: string | null;
}

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'EXCUSED', label: 'Excused' },
];

export function StudentAttendance({ studentId: studentIdProp }: { studentId?: string | null }) {
  const { user, thresholds: sessionThresholds } = useSession();
  const studentId = studentIdProp ?? user?.studentId ?? undefined;

  const [view, setView] = React.useState<'overview' | 'history'>('overview');
  const [subjectFilter, setSubjectFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);

  const summary = useApi<Summary>('/api/attendance/summary', { studentId }, { enabled: Boolean(studentId) });
  const history = useApi<HistoryItem[]>(
    '/api/attendance/history',
    { studentId, page, pageSize: 15, subjectId: subjectFilter, status: statusFilter, from, to },
    { enabled: Boolean(studentId), keepPreviousData: true },
  );

  const data = summary.data?.data;
  const historyRows = history.data?.data ?? [];
  const historyMeta = history.data?.meta;
  const thresholds = data?.thresholds ?? sessionThresholds ?? { safe: 80, fine: 75, debar: 70, countLateAsPresent: true };

  if (!studentId) {
    return (
      <EmptyState
        icon={<ClipboardCheck />}
        title="No student profile is linked to this account"
        description="An administrator must link your student record before attendance can be shown."
      />
    );
  }

  if (summary.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonTiles count={4} />
        <div className="skeleton h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (summary.isError || !data) {
    return <ErrorState error={summary.error} onRetry={() => summary.refetch()} title="Could not load attendance" />;
  }

  const columns: Column<HistoryItem>[] = [
    {
      key: 'date',
      header: 'Date',
      primary: true,
      sortable: false,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{formatDate(row.date, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</p>
          <p className="text-xs text-muted">
            Period {row.periodIndex}
            {row.faculty ? ` · ${row.faculty}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      label: 'Subject',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-sm text-ink">{row.subjectName}</span>
          <span className="block text-xs text-subtle">{row.subjectCode}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      label: 'Status',
      align: 'center',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'remarks',
      header: 'Remarks',
      label: 'Remarks',
      hideOnMobile: true,
      cell: (row) => <span className="block max-w-[16rem] truncate text-xs text-muted">{row.remarks || '—'}</span>,
    },
  ];

  const distribution = [
    { label: 'Present', value: data.overall.present, color: 'rgb(var(--ok))' },
    { label: 'Late', value: data.overall.late, color: 'rgb(var(--warn))' },
    { label: 'Excused', value: data.overall.excused, color: 'rgb(var(--info))' },
    { label: 'Absent', value: data.overall.absent, color: 'rgb(var(--danger))' },
  ];

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatTile
          label="Overall attendance"
          value={`${data.overall.percentage.toFixed(1)}%`}
          tone={data.overall.percentage >= thresholds.safe ? 'ok' : data.overall.percentage >= thresholds.fine ? 'warn' : 'danger'}
          hint={<BandBadge band={data.overall.bandKey} label={data.overall.band.label} />}
          icon={<ClipboardCheck />}
        />
        <StatTile
          label="Classes attended"
          value={`${data.overall.present + (thresholds.countLateAsPresent ? data.overall.late : 0)}/${data.overall.total}`}
          tone="brand"
          delta={data.delta}
          hint={<span className="flex items-center gap-1.5">vs last month <DeltaTag delta={data.delta} /></span>}
        />
        <StatTile
          label="Classes missed"
          value={data.overall.absent}
          tone={data.overall.absent > 0 ? 'danger' : 'ok'}
          hint={`${data.overall.late} late · ${data.overall.excused} excused`}
          icon={<ShieldAlert />}
        />
        <StatTile
          label="To reach safe range"
          value={data.classesNeededForSafe > 0 ? `${data.classesNeededForSafe}` : '0'}
          tone={data.classesNeededForSafe > 0 ? 'warn' : 'ok'}
          hint={data.classesNeededForSafe > 0 ? `consecutive classes at ≥ ${thresholds.safe}%` : `Already at or above ${thresholds.safe}%`}
          icon={<TrendingUp />}
        />
      </StatGrid>

      {data.overall.bandKey === 'DEBARRED' ? (
        <Alert tone="danger" title={`You are below the ${thresholds.debar}% debar line`} icon={<ShieldAlert />}>
          University rules allow the institution to withhold exam registration below {thresholds.debar}% attendance. Meet your faculty
          advisor or head of department to discuss condonation.
        </Alert>
      ) : data.overall.bandKey === 'AT_RISK' || data.overall.bandKey === 'FINE' ? (
        <Alert tone="warning" title={`Attendance is below the ${thresholds.safe}% safe range`} icon={<ShieldAlert />}>
          Attending the next {data.classesNeededForSafe} class{data.classesNeededForSafe === 1 ? '' : 'es'} without absence brings you
          back above {thresholds.safe}%.
        </Alert>
      ) : null}

      <Tabs
        ariaLabel="Attendance views"
        value={view}
        onValueChange={(value) => setView(value as 'overview' | 'history')}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'history', label: 'History', count: history.data?.meta?.total },
        ]}
      />

      {view === 'overview' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel>
            <PanelHeader
              title="Subject-wise attendance"
              subtitle={`Marks against the configured limits: safe ≥ ${thresholds.safe}%, fine below ${thresholds.fine}%, debar below ${thresholds.debar}%`}
              icon={<ClipboardCheck />}
            />
            <PanelBody className="py-3">
              {data.subjects.length === 0 ? (
                <EmptyState compact title="No subjects tracked yet" description="Attendance per subject appears after your first recorded session." />
              ) : (
                <div className="space-y-0.5">
                  {data.subjects.map((subject) => (
                    <MetricRow
                      key={subject.subjectId}
                      label={`${subject.subjectCode} · ${subject.subjectName}`}
                      value={subject.percentage}
                      tone={toneFor(subject.percentage, thresholds)}
                      threshold={thresholds.safe}
                      sublabel={
                        subject.classesNeeded > 0
                          ? `${subject.present}/${subject.total} attended · ${subject.classesNeeded} more to reach ${thresholds.safe}%`
                          : `${subject.present}/${subject.total} attended · above the ${thresholds.safe}% safe line`
                      }
                      trailing={<BandBadge band={subject.bandKey} label={subject.band.label} />}
                    />
                  ))}
                </div>
              )}
            </PanelBody>
          </Panel>

          <div className="space-y-4">
            <Panel>
              <PanelHeader title="Attendance split" icon={<CalendarRange />} />
              <PanelBody>
                <DistributionDonut
                  data={distribution}
                  height={220}
                  centerValue={`${data.overall.percentage.toFixed(0)}%`}
                  centerLabel="Overall"
                  emptyMessage="No attendance recorded yet."
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader title="Monthly trend" subtitle="Attendance percentage per month" icon={<TrendingUp />} />
              <PanelBody>
                <TrendChart
                  data={data.monthly.map((month) => ({ label: formatDate(`${month.key}-01`, { month: 'short', year: '2-digit' }), percentage: month.percentage }))}
                  xKey="label"
                  series={[{ key: 'percentage', label: 'Attendance' }]}
                  area
                  suffix="%"
                  height={200}
                  yDomain={[0, 100]}
                  emptyMessage="Monthly trend appears after two months of data."
                />
              </PanelBody>
            </Panel>
          </div>
        </div>
      ) : (
        <Panel>
          <PanelHeader
            title="Attendance history"
            subtitle="Every recorded session, newest first"
            icon={<CalendarRange />}
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/timetable">Timetable</Link>
              </Button>
            }
          />
          <PanelBody className="border-b border-line bg-raised/60 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Subject">
                <Select
                  value={subjectFilter}
                  onChange={(event) => {
                    setSubjectFilter(event.target.value);
                    setPage(1);
                  }}
                  placeholder="All subjects"
                  options={data.subjects.map((subject) => ({ value: subject.subjectId, label: `${subject.subjectCode} — ${subject.subjectName}` }))}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  options={STATUS_FILTERS}
                />
              </Field>
              <Field label="From">
                <input type="date" className="input" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
              </Field>
              <Field label="To">
                <input type="date" className="input" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
              </Field>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    setSubjectFilter('');
                    setStatusFilter('');
                    setFrom('');
                    setTo('');
                    setPage(1);
                  }}
                  disabled={!subjectFilter && !statusFilter && !from && !to}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          </PanelBody>

          {history.isLoading ? (
            <PanelBody>
              <SkeletonRows rows={6} />
            </PanelBody>
          ) : (
            <DataTable
              columns={columns}
              rows={historyRows}
              rowKey={(row) => row.id}
              loading={history.isFetching}
              error={history.error}
              onRetry={() => history.refetch()}
              page={page}
              pageSize={15}
              total={historyMeta?.total ?? 0}
              totalPages={historyMeta?.totalPages ?? 1}
              onPageChange={setPage}
              empty={{
                title: subjectFilter || statusFilter || from || to ? 'No sessions match these filters' : 'No attendance recorded yet',
                description:
                  subjectFilter || statusFilter || from || to
                    ? 'Widen the date range or clear the filters to see more sessions.'
                    : 'Your history builds up as faculty record each class.',
                action:
                  subjectFilter || statusFilter || from || to ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSubjectFilter('');
                        setStatusFilter('');
                        setFrom('');
                        setTo('');
                        setPage(1);
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined,
              }}
            />
          )}
        </Panel>
      )}

      <Panel>
        <PanelHeader title="How these numbers are calculated" icon={<Info />} />
        <PanelBody className="space-y-2 text-[0.8125rem] leading-relaxed text-muted">
          <p>
            Attendance percentage counts a class as attended when it is marked <strong className="font-semibold text-ink">Present</strong>
            {thresholds.countLateAsPresent ? (
              <>
                , <strong className="font-semibold text-ink">Late</strong>
              </>
            ) : null}{' '}
            or <strong className="font-semibold text-ink">Excused</strong>. These limits are institutional settings and can be changed by an
            administrator at any time.
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Safe', value: `≥ ${thresholds.safe}%`, tone: 'ok' as const },
              { label: 'At risk', value: `< ${thresholds.safe}%`, tone: 'warn' as const },
              { label: 'Fine applicable', value: `< ${thresholds.fine}%`, tone: 'info' as const },
              { label: 'Debarred', value: `< ${thresholds.debar}%`, tone: 'danger' as const },
            ].map((rule) => (
              <li key={rule.label} className="flex items-center justify-between gap-2 rounded-md border border-line bg-raised px-3 py-2">
                <span className="text-xs font-medium text-ink">{rule.label}</span>
                <span className="flex items-center gap-2">
                  <span className="tnum text-xs text-muted">{rule.value}</span>
                  <BandBadge band={rule.label === 'Safe' ? 'SAFE' : rule.label === 'At risk' ? 'AT_RISK' : rule.label === 'Fine applicable' ? 'FINE' : 'DEBARRED'} />
                </span>
              </li>
            ))}
          </ul>
          <p className={cn('text-xs text-subtle')}>
            Last recorded session: {data.lastUpdated ? formatDate(data.lastUpdated, { day: '2-digit', month: 'short', year: 'numeric' }) : 'none yet'} ·
            overall {round(data.overall.percentage, 1)}% of {data.overall.total} classes.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
