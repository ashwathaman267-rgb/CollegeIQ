'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, ClipboardCheck, Flame, PieChart, TrendingUp, Users } from 'lucide-react';

import { api } from '@/lib/api-client';
import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { Badge, BandBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { CategoryBars, DistributionDonut, Heatmap, TrendChart, chartColor } from '@/components/ui/charts';
import { ProgressBar, toneFor } from '@/components/ui/progress';
import { DataTable, type Column } from '@/components/ui/table';
import { Field, Select } from '@/components/ui/form';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, ErrorState, SkeletonTiles } from '@/components/ui/states';

interface SubjectComparison {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  percentage: number;
  total: number;
  absent: number;
  bandKey: string;
}

interface AtRiskStudent {
  studentId: string;
  userId: string;
  registerNumber: string;
  name: string;
  percentage: number;
  bandKey: string;
  absentCount: number;
  worstSubject?: string;
}

interface Analytics {
  classAverage: number;
  distribution: { label: string; min: number; max: number; count: number }[];
  monthly: { key: string; label: string; percentage: number; total: number }[];
  subjectComparison: SubjectComparison[];
  studentComparison: AtRiskStudent[];
  atRisk: AtRiskStudent[];
  totals: { total: number; present: number; absent: number; late: number; excused: number; percentage: number; bandKey: string };
  thresholds: { safe: number; fine: number; debar: number };
  recordCount: number;
}

interface HeatmapData {
  days: string[];
  periods: number[];
  cells: { day: string; period: number; total: number; percentage: number | null }[];
}

interface ClassOption {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  subjects: { id: string; code: string; name: string }[];
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

export function AttendanceAnalytics() {
  const { thresholds: sessionThresholds } = useSession();
  const [departmentId, setDepartmentId] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [subjectId, setSubjectId] = React.useState('');

  const departments = useApi<DepartmentOption[]>('/api/departments');
  const classes = useApi<{ classes: ClassOption[] }>('/api/classes', { departmentId });
  const analytics = useApi<{ analytics: Analytics }>('/api/attendance/analytics', { departmentId, classId, subjectId });
  const heatmap = useApi<HeatmapData>('/api/attendance/heatmap', { departmentId });

  const data = analytics.data?.data?.analytics;
  const thresholds = data?.thresholds ?? sessionThresholds ?? { safe: 80, fine: 75, debar: 70 };
  const classOptions = classes.data?.data?.classes ?? [];
  const subjectOptions = React.useMemo(() => {
    const selected = classOptions.find((c) => c.id === classId);
    const list = selected ? selected.subjects : classOptions.flatMap((c) => c.subjects);
    const seen = new Map<string, { id: string; code: string; name: string }>();
    for (const subject of list) seen.set(subject.id, subject);
    return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [classOptions, classId]);

  const exportCsv = async () => {
    const rows = [
      ['Student', 'Register number', 'Attendance %', 'Status', 'Absent classes', 'Weakest subject'],
      ...(data?.studentComparison ?? []).map((student) => [
        student.name,
        student.registerNumber,
        student.percentage.toFixed(1),
        student.bandKey,
        String(student.absentCount),
        student.worstSubject ?? '',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `campusiq-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    void api;
  };

  if (analytics.isLoading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonTiles count={4} />
        <div className="skeleton h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (analytics.isError || !data) {
    return <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} title="Could not load attendance analytics" />;
  }

  const riskColumns: Column<AtRiskStudent>[] = [
    {
      key: 'student',
      header: 'Student',
      primary: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{row.name}</p>
            <p className="truncate text-xs text-muted">{row.registerNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'percentage',
      header: 'Attendance',
      label: 'Attendance',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <ProgressBar value={row.percentage} tone={toneFor(row.percentage, thresholds)} size="sm" className="w-20" />
          <span className="tnum w-12 text-right text-sm font-semibold text-ink">{row.percentage.toFixed(1)}%</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', label: 'Status', align: 'center', cell: (row) => <BandBadge band={row.bandKey} /> },
    {
      key: 'absent',
      header: 'Absent',
      align: 'right',
      label: 'Absent',
      cell: (row) => <span className="tnum text-sm text-muted">{row.absentCount}</span>,
    },
    {
      key: 'worst',
      header: 'Weakest subject',
      label: 'Weakest subject',
      hideOnMobile: true,
      cell: (row) => <span className="block max-w-[14rem] truncate text-xs text-muted">{row.worstSubject ?? '—'}</span>,
    },
    {
      key: 'open',
      header: '',
      label: 'Profile',
      align: 'right',
      cell: (row) => (
        <Button size="xs" variant="ghost" asChild>
          <Link href={`/students/${row.studentId}`}>Open</Link>
        </Button>
      ),
    },
  ];

  const heatCells = new Map(heatmap.data?.data?.cells.map((cell) => [`${cell.day}:${cell.period}`, cell]) ?? []);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Filters"
          subtitle="Analytics recompute across the selected department, class and subject"
          icon={<BarChart3 />}
          actions={
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!data.studentComparison.length}>
              Export CSV
            </Button>
          }
        />
        <PanelBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Department">
              <Select
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setClassId('');
                }}
                placeholder="All departments"
                options={(departments.data?.data ?? []).map((department) => ({ value: department.id, label: `${department.code} — ${department.name}` }))}
              />
            </Field>
            <Field label="Class">
              <Select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                placeholder="All classes"
                options={classOptions.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
            <Field label="Subject">
              <Select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                placeholder="All subjects"
                options={subjectOptions.map((subject) => ({ value: subject.id, label: `${subject.code} — ${subject.name}` }))}
              />
            </Field>
          </div>
        </PanelBody>
      </Panel>

      <StatGrid columns={5}>
        <StatTile label="Records analysed" value={data.recordCount} tone="brand" hint={`${data.totals.total} student-session rows`} icon={<ClipboardCheck />} />
        <StatTile label="Average attendance" value={`${data.classAverage.toFixed(1)}%`} tone={data.classAverage >= thresholds.safe ? 'ok' : 'warn'} hint={<BandBadge band={data.totals.bandKey} />} icon={<TrendingUp />} />
        <StatTile label="Present" value={data.totals.present} tone="ok" hint={`${data.totals.late} late · ${data.totals.excused} excused`} />
        <StatTile label="Absent" value={data.totals.absent} tone={data.totals.absent > 0 ? 'danger' : 'ok'} hint={`${data.recordCount ? ((data.totals.absent / data.recordCount) * 100).toFixed(1) : '0.0'}% of all records`} />
        <StatTile label="Below safe range" value={data.atRisk.length} tone={data.atRisk.length > 0 ? 'danger' : 'ok'} hint={`Safe line is ${thresholds.safe}%`} icon={<AlertTriangle />} />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Subject comparison" subtitle="Average attendance per subject" icon={<BarChart3 />} />
          <PanelBody>
            <CategoryBars
              data={data.subjectComparison.map((subject) => ({
                label: subject.subjectCode || subject.subjectName,
                name: subject.subjectName,
                percentage: subject.percentage,
              }))}
              xKey="label"
              yKey="percentage"
              suffix="%"
              label="Attendance"
              height={Math.max(220, data.subjectComparison.length * 34)}
              horizontal={data.subjectComparison.length > 6}
              color={(row) => (Number(row.percentage) >= thresholds.safe ? 'rgb(var(--ok))' : Number(row.percentage) >= thresholds.debar ? 'rgb(var(--warn))' : 'rgb(var(--danger))')}
              emptyMessage="No subject-level attendance yet."
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Monthly trend" subtitle="Attendance percentage across the year" icon={<TrendingUp />} />
          <PanelBody>
            <TrendChart
              data={data.monthly.map((month) => ({ label: month.label, percentage: month.percentage }))}
              xKey="label"
              series={[{ key: 'percentage', label: 'Attendance' }]}
              suffix="%"
              area
              height={260}
              yDomain={[0, 100]}
              emptyMessage="Monthly trend appears after two months of records."
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Attendance distribution" subtitle="Students grouped against the configured limits" icon={<PieChart />} />
          <PanelBody>
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
              <DistributionDonut
                data={data.distribution.map((bucket, index) => ({ label: bucket.label, value: bucket.count, color: chartColor(index) }))}
                height={210}
                centerValue={data.studentComparison.length}
                centerLabel="Students"
                emptyMessage="No students tracked yet."
              />
              <ul className="space-y-1.5">
                {data.distribution.map((bucket, index) => (
                  <li key={bucket.label} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: chartColor(index) }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-muted">{bucket.label}</span>
                    <span className="tnum font-semibold text-ink">{bucket.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Weekday × period heatmap" subtitle="Where attendance dips during the week" icon={<Flame />} />
          <PanelBody>
            {heatmap.isLoading ? (
              <div className="skeleton h-40 w-full rounded" />
            ) : (
              <Heatmap
                days={heatmap.data?.data?.days ?? []}
                periods={heatmap.data?.data?.periods ?? []}
                value={(day, period) => heatCells.get(`${day}:${period}`)?.percentage ?? null}
              />
            )}
            <p className="mt-2 text-xs text-muted">
              Values are attendance percentages. Empty cells mean no session was recorded for that weekday and period.
            </p>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="At-risk students"
          subtitle={`Below the ${thresholds.safe}% safe line — sorted by attendance`}
          icon={<Users />}
          actions={<Badge tone={data.atRisk.length > 0 ? 'danger' : 'ok'}>{data.atRisk.length}</Badge>}
        />
        <DataTable
          columns={riskColumns}
          rows={data.atRisk}
          rowKey={(row) => row.studentId}
          loading={analytics.isFetching}
          empty={{
            title: 'No students below the safe range',
            description: `Everyone in this selection is at or above ${thresholds.safe}% attendance.`,
            icon: <ClipboardCheck />,
          }}
        />
      </Panel>
    </div>
  );
}
