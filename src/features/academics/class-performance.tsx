'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, BookOpen, Medal, TrendingDown, TrendingUp, Users } from 'lucide-react';

import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader, StackItem, StatGrid, StatTile } from '@/components/ui/panel';
import { CategoryBars, GroupedBars } from '@/components/ui/charts';
import { DeltaTag, ProgressBar, toneFor } from '@/components/ui/progress';
import { DataTable, type Column } from '@/components/ui/table';
import { Tabs } from '@/components/ui/dropdown';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, ErrorState, SkeletonTiles } from '@/components/ui/states';

interface StudentRow {
  studentId: string;
  registerNumber: string;
  name: string;
  overall: number;
  rank?: number;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  delta: number;
  openArrears: number;
  needsAttention: boolean;
  subjects: { subjectId: string; code: string; name: string; percentage: number }[];
}

interface ClassPerformanceData {
  classId: string;
  className: string;
  studentCount: number;
  examCount: number;
  average: number;
  improving: number;
  declining: number;
  stable: number;
  attentionRequired: number;
  topPerformers: { studentId: string; name: string; registerNumber: string; overall: number }[];
  students: StudentRow[];
  subjectAverages: { subjectId: string; code: string; name: string; average: number; students: number; exams: number }[];
  examComparison: { examId: string; name: string; examNumber: number; subjectId: string; subjectName: string; subjectCode: string; maxMarks: number; average: number; highest: number; lowest: number; entries: number; absent: number }[];
  passMarkPercentage: number;
}

type Cohort = 'all' | 'improving' | 'declining' | 'attention' | 'top';

export function ClassPerformance({ classId }: { classId: string }) {
  const { thresholds } = useSession();
  const [cohort, setCohort] = React.useState<Cohort>('all');
  const query = useApi<{ performance: ClassPerformanceData }>('/api/classes/' + classId, undefined, { enabled: Boolean(classId), keepPreviousData: true });
  const data = query.data?.data?.performance;

  if (!classId) {
    return <EmptyState icon={<Users />} title="Select a class" description="Class performance covers internal assessments for every student in a class." />;
  }
  if (query.isLoading) return <SkeletonTiles count={4} />;
  if (query.isError || !data) return <ErrorState error={query.error} onRetry={() => query.refetch()} title="Could not load class performance" />;

  const rows = data.students.filter((student) => {
    if (cohort === 'improving') return student.trend === 'IMPROVING';
    if (cohort === 'declining') return student.trend === 'DECLINING';
    if (cohort === 'attention') return student.needsAttention || student.openArrears > 0;
    if (cohort === 'top') return (student.rank ?? 999) <= 5;
    return true;
  });

  // IA-1 vs IA-2 per subject
  const examNumbers = Array.from(new Set(data.examComparison.map((exam) => exam.examNumber))).sort((a, b) => a - b);
  const grouped = data.subjectAverages.map((subject) => {
    const row: Record<string, string | number> = { label: subject.code || subject.name };
    for (const number of examNumbers) {
      const exam = data.examComparison.find((e) => e.subjectId === subject.subjectId && e.examNumber === number);
      row[`ia${number}`] = exam?.average ?? 0;
    }
    return row;
  });

  const columns: Column<StudentRow>[] = [
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
      key: 'rank',
      header: 'Rank',
      align: 'center',
      label: 'Rank',
      hideOnMobile: true,
      cell: (row) =>
        row.rank ? (
          <span className="tnum inline-flex items-center gap-1 text-sm font-semibold text-ink">
            {row.rank <= 3 ? <Medal className="h-3.5 w-3.5 text-warn" aria-hidden /> : null}
            {row.rank}
          </span>
        ) : (
          <span className="text-xs text-subtle">—</span>
        ),
    },
    {
      key: 'overall',
      header: 'IA average',
      label: 'IA average',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <ProgressBar value={row.overall} size="sm" className="w-20" tone={row.overall >= 70 ? 'ok' : row.overall >= data.passMarkPercentage ? 'warn' : 'danger'} />
          <span className="tnum w-12 text-right text-sm font-semibold text-ink">{row.overall.toFixed(1)}%</span>
        </span>
      ),
    },
    {
      key: 'trend',
      header: 'Trend',
      label: 'Trend',
      align: 'center',
      cell: (row) => (
        <span className="flex items-center justify-center gap-1.5">
          {row.trend === 'IMPROVING' ? <TrendingUp className="h-3.5 w-3.5 text-ok" aria-hidden /> : row.trend === 'DECLINING' ? <TrendingDown className="h-3.5 w-3.5 text-danger" aria-hidden /> : null}
          <DeltaTag delta={row.delta} />
        </span>
      ),
    },
    {
      key: 'weakest',
      header: 'Weakest subject',
      label: 'Weakest',
      hideOnMobile: true,
      cell: (row) => {
        const weakest = [...row.subjects].sort((a, b) => a.percentage - b.percentage)[0];
        if (!weakest) return <span className="text-xs text-subtle">—</span>;
        return (
          <span className="block max-w-[13rem] truncate text-xs text-muted">
            <span className={weakest.percentage < data.passMarkPercentage ? 'font-semibold text-danger-fg' : ''}>{weakest.code}</span> ·{' '}
            {weakest.percentage.toFixed(0)}%
          </span>
        );
      },
    },
    {
      key: 'arrears',
      header: 'Arrears',
      align: 'center',
      label: 'Arrears',
      cell: (row) => (row.openArrears > 0 ? <Badge tone="danger">{row.openArrears} open</Badge> : <Badge tone="ok">Clear</Badge>),
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

  return (
    <div className="space-y-4">
      <StatGrid columns={5}>
        <StatTile
          label="Class average"
          value={`${data.average.toFixed(1)}%`}
          tone={data.average >= 60 ? 'ok' : data.average >= data.passMarkPercentage ? 'warn' : 'danger'}
          hint={`${data.examCount} assessment${data.examCount === 1 ? '' : 's'} · ${data.studentCount} students`}
          icon={<BookOpen />}
        />
        <StatTile label="Improving" value={data.improving} tone="ok" hint="+3% or better since the first assessment" icon={<TrendingUp />} />
        <StatTile label="Declining" value={data.declining} tone={data.declining > 0 ? 'danger' : 'ok'} hint="−3% or worse since the first assessment" icon={<TrendingDown />} />
        <StatTile label="Needs attention" value={data.attentionRequired} tone={data.attentionRequired > 0 ? 'warn' : 'ok'} hint={`Below the ${data.passMarkPercentage}% pass mark`} icon={<AlertTriangle />} />
        <StatTile
          label="Top performer"
          value={data.topPerformers[0] ? `${data.topPerformers[0].overall.toFixed(0)}%` : '—'}
          tone="brand"
          hint={data.topPerformers[0]?.name ?? 'No marks recorded yet'}
          icon={<Medal />}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Assessment comparison by subject" subtitle={examNumbers.map((n) => `IA ${n}`).join(' vs ') || 'No assessments yet'} icon={<BookOpen />} />
          <PanelBody>
            <GroupedBars
              data={grouped}
              xKey="label"
              series={examNumbers.map((number, index) => ({
                key: `ia${number}`,
                label: data.examComparison.find((e) => e.examNumber === number)?.name ?? `IA ${number}`,
                color: index === 0 ? undefined : 'rgb(var(--chart-2))',
              }))}
              height={260}
              emptyMessage="Create at least two assessments to compare them."
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Subject averages" subtitle="Class average per subject across all assessments" icon={<BookOpen />} />
          <PanelBody>
            <CategoryBars
              data={data.subjectAverages.map((subject) => ({ label: subject.code || subject.name, average: subject.average }))}
              xKey="label"
              yKey="average"
              suffix="%"
              label="Class average"
              height={Math.max(220, data.subjectAverages.length * 34)}
              horizontal={data.subjectAverages.length > 6}
              color={(row) => (Number(row.average) >= 70 ? 'rgb(var(--ok))' : Number(row.average) >= data.passMarkPercentage ? 'rgb(var(--warn))' : 'rgb(var(--danger))')}
              emptyMessage="No internal marks recorded yet."
            />
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Assessment summary" subtitle="Averages, extremes and completion for each assessment" icon={<BookOpen />} />
        <DataTable
          columns={[
            { key: 'name', header: 'Assessment', primary: true, cell: (row) => <span className="text-sm font-medium text-ink">{row.name}</span> },
            { key: 'subject', header: 'Subject', label: 'Subject', cell: (row) => <span className="text-sm text-muted">{row.subjectCode} · {row.subjectName}</span> },
            { key: 'average', header: 'Average', align: 'right', label: 'Average', cell: (row) => <span className="tnum text-sm font-semibold text-ink">{row.average.toFixed(1)}%</span> },
            { key: 'range', header: 'High / low', align: 'right', label: 'High / low', hideOnMobile: true, cell: (row) => <span className="tnum text-sm text-muted">{row.highest} / {row.lowest}</span> },
            { key: 'entries', header: 'Entered', align: 'right', label: 'Entered', cell: (row) => <span className="tnum text-sm text-muted">{row.entries}{row.absent ? ` · ${row.absent} absent` : ''}</span> },
          ] as Column<(typeof data.examComparison)[number]>[]}
          rows={data.examComparison}
          rowKey={(row) => row.examId}
          dense
          empty={{ title: 'No assessments yet', description: 'Create IA-1 or IA-2 to see averages, extremes and completion here.' }}
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Students"
          subtitle={`${data.students.length} student${data.students.length === 1 ? '' : 's'} ranked by internal assessment average`}
          icon={<Users />}
        />
        <PanelBody className="border-b border-line py-3">
          <Tabs
            ariaLabel="Student cohorts"
            value={cohort}
            onValueChange={(value) => setCohort(value as Cohort)}
            items={[
              { value: 'all', label: 'All', count: data.students.length },
              { value: 'top', label: 'Top performers', count: data.topPerformers.length },
              { value: 'improving', label: 'Improving', count: data.improving },
              { value: 'declining', label: 'Declining', count: data.declining },
              { value: 'attention', label: 'Needs attention', count: data.attentionRequired },
            ]}
          />
        </PanelBody>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.studentId}
          loading={query.isFetching}
          sort={{ sortBy: 'overall', sortDir: 'desc' }}
          empty={{
            title: cohort === 'all' ? 'No students in this class' : 'No students in this cohort',
            description:
              cohort === 'all'
                ? 'Add students to the class to see internal assessment performance.'
                : 'Switch cohort to see the rest of the class.',
          }}
        />
      </Panel>

      {thresholds ? (
        <Panel>
          <PanelHeader title="How this is calculated" icon={<AlertTriangle />} />
          <PanelBody className="space-y-2 text-[0.8125rem] leading-relaxed text-muted">
            <p>
              A student is <strong className="font-semibold text-ink">improving</strong> when their latest assessment average is at least 3
              percentage points above their first, and <strong className="font-semibold text-ink">declining</strong> when it is 3 points or more
              below. <strong className="font-semibold text-ink">Needs attention</strong> means an average under the configured pass mark of{' '}
              {data.passMarkPercentage}%.
            </p>
            <ul className="space-y-0.5 pt-1">
              {data.subjectAverages.slice(0, 3).map((subject) => (
                <li key={subject.subjectId}>
                  <StackItem
                    tone={toneFor(subject.average, { safe: 70, fine: data.passMarkPercentage, debar: 40 })}
                    title={`${subject.code} · ${subject.name}`}
                    detail={`${subject.exams} assessment(s) · ${subject.students} student(s) marked`}
                    metric={`${subject.average.toFixed(1)}%`}
                  />
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
