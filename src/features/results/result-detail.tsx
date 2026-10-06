'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileWarning, Trophy, Users } from 'lucide-react';

import { formatDate } from '@/lib/format';
import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { CategoryBars, DistributionDonut, chartColor } from '@/components/ui/charts';
import { DataTable, type Column } from '@/components/ui/table';
import { Field, SearchInput, Select } from '@/components/ui/form';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, ErrorState, SkeletonTiles } from '@/components/ui/states';

interface StudentRow {
  id: string;
  studentId: string;
  registerNumber: string;
  name: string;
  gpa: number | null;
  aggregate: number | null;
  arrearsCount: number;
  status: string;
  subjects: { subjectId: string; code: string; name: string; marks: number | null; grade: string | null; status: string }[];
}

interface Detail {
  result: {
    id: string;
    name: string;
    semester: number;
    declaredOn: string;
    status: string;
    passPercentage: number;
    totalStudents: number;
    passedStudents: number;
    failedStudents: number;
    arrearCount: number;
    departmentName: string | null;
    fileName: string | null;
    summary?: { extractionMode?: string; strategy?: string; warnings?: string[]; unmatched?: string[] } | null;
  };
  students: StudentRow[];
  subjectStats: { subjectId: string; code: string; name: string; appeared: number; passed: number; failed: number; passPercentage: number; averageMarks: number }[];
  gradeDistribution: { grade: string; count: number }[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function ResultDetail({ resultId }: { resultId: string }) {
  const { user } = useSession();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('ALL');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useApi<Detail>(`/api/results/${resultId}`, { page, pageSize: 20, search: debounced, status }, { keepPreviousData: true });
  const data = query.data?.data;

  if (query.isLoading) return <SkeletonTiles count={4} />;
  if (query.isError || !data) return <ErrorState error={query.error} onRetry={() => query.refetch()} title="Could not load this result set" />;

  const simulated = data.result.summary?.extractionMode === 'SIMULATED';

  const exportCsv = () => {
    const header = ['Register number', 'Name', 'GPA', 'Aggregate', 'Arrears', 'Status', ...data.subjectStats.map((s) => s.code)];
    const rows = data.students.map((student) => [
      student.registerNumber,
      student.name,
      String(student.gpa ?? ''),
      String(student.aggregate ?? ''),
      String(student.arrearsCount),
      student.status,
      ...data.subjectStats.map((subject) => {
        const entry = student.subjects.find((s) => s.subjectId === subject.subjectId);
        return entry ? `${entry.marks ?? ''}${entry.grade ? ` (${entry.grade})` : ''}` : '';
      }),
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.result.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
    { key: 'gpa', header: 'GPA', align: 'right', label: 'GPA', cell: (row) => <span className="tnum text-sm font-semibold text-ink">{row.gpa ? row.gpa.toFixed(2) : '—'}</span> },
    {
      key: 'aggregate',
      header: 'Aggregate',
      align: 'right',
      label: 'Aggregate',
      hideOnMobile: true,
      cell: (row) => <span className="tnum text-sm text-muted">{row.aggregate ? `${row.aggregate.toFixed(1)}%` : '—'}</span>,
    },
    {
      key: 'arrears',
      header: 'Arrears',
      align: 'center',
      label: 'Arrears',
      cell: (row) => (row.arrearsCount > 0 ? <Badge tone="danger">{row.arrearsCount}</Badge> : <Badge tone="ok">0</Badge>),
    },
    { key: 'status', header: 'Result', align: 'center', label: 'Result', cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'profile',
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
    <>
      <PageHeader
        title={data.result.name}
        description={`Semester ${data.result.semester} · declared ${formatDate(data.result.declaredOn, { day: '2-digit', month: 'long', year: 'numeric' })}${data.result.departmentName ? ` · ${data.result.departmentName}` : ''}${data.result.fileName ? ` · source ${data.result.fileName}` : ''}`}
        icon={<Trophy />}
        breadcrumbs={[{ label: 'Results', href: '/results' }, { label: data.result.name }]}
        meta={
          <>
            <StatusBadge status={data.result.status} />
            <Badge tone={data.result.passPercentage >= 70 ? 'ok' : data.result.passPercentage >= 50 ? 'warn' : 'danger'}>
              {data.result.passPercentage.toFixed(1)}% pass
            </Badge>
            {simulated ? <Badge tone="warn" icon={<FileWarning />}>Simulated extraction</Badge> : <Badge tone="info">Strategy: {data.result.summary?.strategy ?? 'parsed'}</Badge>}
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/results">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                All result sets
              </Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!data.students.length}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              Export CSV
            </Button>
          </>
        }
      />

      {simulated ? (
        <Alert tone="warning" title="This result set was simulated" icon={<FileWarning />}>
          The uploaded document contained no rows CampusIQ could read, so a demo result set was generated for the selected class. Re-upload a
          text-based PDF or CSV to replace these figures with extracted ones.
          {data.result.summary?.warnings?.length ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              {data.result.summary.warnings.slice(0, 4).map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <StatGrid columns={5}>
        <StatTile label="Pass percentage" value={`${data.result.passPercentage.toFixed(1)}%`} tone={data.result.passPercentage >= 70 ? 'ok' : 'warn'} hint={`${data.result.totalStudents} students processed`} icon={<Trophy />} />
        <StatTile label="Passed" value={data.result.passedStudents} tone="ok" hint="No arrears in this semester" />
        <StatTile label="With arrears" value={data.result.failedStudents} tone={data.result.failedStudents > 0 ? 'danger' : 'ok'} hint="One or more subjects failed" />
        <StatTile label="Arrear records" value={data.result.arrearCount} tone="brand" hint="Subject-level failures tracked" />
        <StatTile label="Subjects" value={data.subjectStats.length} hint="With result rows" icon={<Users />} />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Subject-wise pass percentage" subtitle="Lowest first" icon={<Trophy />} />
          <PanelBody>
            <CategoryBars
              data={data.subjectStats.map((subject) => ({ label: subject.code || subject.name, name: subject.name, passPercentage: subject.passPercentage }))}
              xKey="label"
              yKey="passPercentage"
              suffix="%"
              horizontal
              height={Math.max(220, data.subjectStats.length * 34)}
              label="Pass %"
              color={(row) => (Number(row.passPercentage) >= 75 ? 'rgb(var(--ok))' : Number(row.passPercentage) >= 50 ? 'rgb(var(--warn))' : 'rgb(var(--danger))')}
              emptyMessage="No subject rows were extracted."
            />
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Grade distribution" subtitle="Grades awarded across all subjects" icon={<Trophy />} />
            <PanelBody>
              <DistributionDonut
                data={data.gradeDistribution.map((grade, index) => ({ label: grade.grade, value: grade.count, color: chartColor(index) }))}
                height={220}
                centerValue={data.gradeDistribution.reduce((sum, grade) => sum + grade.count, 0)}
                centerLabel="Grades"
                emptyMessage="No grades recorded."
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Subject averages" subtitle="Mean marks per subject" icon={<Users />} />
            <PanelBody className="py-2">
              {data.subjectStats.length === 0 ? (
                <EmptyState compact title="No subjects" description="Subject averages appear once rows are matched." />
              ) : (
                <ul className="divide-y divide-line/70">
                  {data.subjectStats.map((subject) => (
                    <li key={subject.subjectId} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] font-medium text-ink">{subject.name}</span>
                        <span className="block text-xs text-muted">
                          {subject.code} · {subject.passed}/{subject.appeared} passed
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-sm font-semibold text-ink">{subject.averageMarks.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHeader title="Student results" subtitle={`${data.meta.total} student${data.meta.total === 1 ? '' : 's'} in this result set`} icon={<Users />} />
        <PanelBody className="border-b border-line bg-raised/60 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field label="Search">
              <SearchInput value={search} onValueChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search by name or register number" aria-label="Search students" />
            </Field>
            <Field label="Result">
              <Select
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All results' },
                  { value: 'PASS', label: 'Passed' },
                  { value: 'PASS_WITH_ARREARS', label: 'Pass with arrears' },
                  { value: 'FAIL', label: 'Failed' },
                ]}
              />
            </Field>
          </div>
        </PanelBody>
        <DataTable
          columns={columns}
          rows={data.students}
          rowKey={(row) => row.id}
          loading={query.isFetching}
          error={query.error}
          onRetry={() => query.refetch()}
          page={page}
          pageSize={20}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
          empty={{
            title: debounced || status !== 'ALL' ? 'No students match these filters' : 'No students in this result set',
            description: debounced || status !== 'ALL' ? 'Clear the search or choose a different result filter.' : 'Rows are created for every student matched by register number.',
          }}
        />
      </Panel>

      {user?.role === 'ADMIN' ? (
        <p className="text-xs text-muted">
          Archiving a result set removes it from every screen and from analytics. Use <Link className="link" href="/results">All result sets</Link> to archive it.
        </p>
      ) : null}

      <span className="sr-only" aria-live="polite">
        {query.isFetching ? 'Loading student results' : `${data.students.length} students shown`}
      </span>
    </>
  );
}
