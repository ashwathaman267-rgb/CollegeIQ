'use client';

import * as React from 'react';
import Link from 'next/link';
import { BarChart3, FileSpreadsheet, Trophy, UploadCloud } from 'lucide-react';

import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { useConfirm } from '@/hooks/use-confirm';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader, StackItem, StatGrid, StatTile } from '@/components/ui/panel';
import { CategoryBars, TrendChart } from '@/components/ui/charts';
import { ProgressBar } from '@/components/ui/progress';
import { DataTable, type Column } from '@/components/ui/table';
import { Tabs } from '@/components/ui/dropdown';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, ErrorState, SkeletonTiles } from '@/components/ui/states';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { ResultUpload } from './result-upload';
import { StudentResults } from './student-results';

interface ResultSet {
  id: string;
  name: string;
  semester: number;
  declaredOn: string;
  status: string;
  passPercentage: number;
  totalStudents: number;
  passedStudents?: number;
  failedStudents?: number;
  arrearCount: number;
  departmentName: string | null;
  summary?: { extractionMode?: string; strategy?: string } | null;
}

interface ResultAnalyticsData {
  overallPassPercentage: number;
  resultSetCount: number;
  openArrears: number;
  totalArrears: number;
  clearedArrears: number;
  subjectPassRates: { subjectId: string; code: string; name: string; total: number; passed: number; passPercentage: number }[];
  semesterTrend: { semester: number; label: string; passPercentage: number; arrears: number }[];
  topArrearStudents: { studentId: string; name: string; registerNumber: string; openArrears: number }[];
}

type Tab = 'upload' | 'sets' | 'analytics';

export function ResultsView() {
  const { user, academic } = useSession();
  const [tab, setTab] = React.useState<Tab>('upload');
  const [page, setPage] = React.useState(1);

  const sets = useApi<ResultSet[]>('/api/results', { page, pageSize: 12 }, { enabled: user?.role !== 'STUDENT', keepPreviousData: true });
  const analytics = useApi<ResultAnalyticsData>('/api/results/analytics', undefined, { enabled: user?.role !== 'STUDENT' });

  if (!user) return null;

  if (user.role === 'STUDENT') {
    return (
      <>
        <PageHeader
          title="My results"
          description="Every published university result, subject by subject, with your GPA trend and arrear timeline."
          icon={<Trophy />}
          meta={academic ? <span className="text-xs text-muted">Semester {academic.semester}</span> : null}
        />
        <StudentResults />
      </>
    );
  }

  const rows = sets.data?.data ?? [];
  const meta = sets.data?.meta;
  const stats = analytics.data?.data;

  const columns: Column<ResultSet>[] = [
    {
      key: 'name',
      header: 'Result set',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          <p className="truncate text-xs text-muted">
            Semester {row.semester} · declared {formatDate(row.declaredOn, { day: '2-digit', month: 'short', year: 'numeric' })}
            {row.departmentName ? ` · ${row.departmentName}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'pass',
      header: 'Pass %',
      label: 'Pass %',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <ProgressBar value={row.passPercentage} size="sm" className="w-16" tone={row.passPercentage >= 70 ? 'ok' : row.passPercentage >= 50 ? 'warn' : 'danger'} />
          <span className="tnum w-12 text-right text-sm font-semibold text-ink">{row.passPercentage.toFixed(1)}%</span>
        </span>
      ),
    },
    {
      key: 'students',
      header: 'Students',
      align: 'right',
      label: 'Students',
      hideOnMobile: true,
      cell: (row) => (
        <span className="tnum text-sm text-muted">
          {row.totalStudents}
          {typeof row.passedStudents === 'number' ? ` · ${row.passedStudents} passed` : ''}
        </span>
      ),
    },
    {
      key: 'arrears',
      header: 'Arrears',
      align: 'center',
      label: 'Arrears',
      cell: (row) => (row.arrearCount > 0 ? <Badge tone="danger">{row.arrearCount}</Badge> : <Badge tone="ok">None</Badge>),
    },
    {
      key: 'source',
      header: 'Source',
      label: 'Source',
      hideOnMobile: true,
      cell: (row) => (
        <Badge tone={row.summary?.extractionMode === 'SIMULATED' ? 'warn' : 'info'}>
          {row.summary?.extractionMode === 'SIMULATED' ? 'Simulated' : (row.summary?.strategy ?? 'parsed')}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      label: 'Status',
      align: 'center',
      hideOnMobile: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="University results"
        description={
          user.role === 'ADMIN'
            ? 'Upload result sheets, then analyse pass percentage, subject-wise performance, failures and arrear history across the institution.'
            : 'Upload a result sheet for your class and review pass percentage, subject-wise performance and arrears.'
        }
        icon={<Trophy />}
        meta={stats ? <span className="text-xs text-muted">{stats.resultSetCount} result set(s) processed · {stats.openArrears} open arrears</span> : null}
      />

      <Tabs
        ariaLabel="Results sections"
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        items={[
          { value: 'upload', label: 'Upload', icon: <UploadCloud className="h-3.5 w-3.5" /> },
          { value: 'sets', label: 'Result sets', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, count: meta?.total },
          { value: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'upload' ? <ResultUpload onProcessed={() => { void sets.refetch(); void analytics.refetch(); }} /> : null}

      {tab === 'sets' ? (
        <Panel>
          <PanelHeader title="Processed result sets" subtitle="Newest first — open one for the full report" icon={<FileSpreadsheet />} />
          <ResultSetsTable
            rows={rows}
            columns={columns}
            loading={sets.isLoading}
            fetching={sets.isFetching}
            error={sets.error}
            onRetry={() => sets.refetch()}
            page={page}
            pageSize={12}
            total={meta?.total ?? 0}
            totalPages={meta?.totalPages ?? 1}
            onPageChange={setPage}
            onChanged={() => {
              void sets.refetch();
              void analytics.refetch();
            }}
            canDelete={user.role === 'ADMIN'}
          />
        </Panel>
      ) : null}

      {tab === 'analytics' ? <AnalyticsPanel stats={stats} loading={analytics.isLoading} error={analytics.error} onRetry={() => analytics.refetch()} /> : null}
    </>
  );
}

function ResultSetsTable({
  rows,
  columns,
  loading,
  fetching,
  error,
  onRetry,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onChanged,
  canDelete,
}: {
  rows: ResultSet[];
  columns: Column<ResultSet>[];
  loading: boolean;
  fetching: boolean;
  error: unknown;
  onRetry: () => void;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onChanged: () => void;
  canDelete: boolean;
}) {
  const confirm = useConfirm();

  const remove = async (row: ResultSet) => {
    const ok = await confirm({
      title: `Archive “${row.name}”?`,
      description:
        'The result set is hidden from every screen and its pass percentage no longer counts towards analytics. Student arrear records are kept.',
      confirmLabel: 'Archive result set',
    });
    if (!ok) return;
    try {
      await api.delete(`/api/results/${row.id}`);
      toastSuccess('Result set archived');
      onChanged();
    } catch (err) {
      toastError(err, 'That result set could not be archived.');
    }
  };

  const withActions: Column<ResultSet>[] = canDelete
    ? [
        ...columns,
        {
          key: 'actions',
          header: '',
          label: 'Actions',
          align: 'right',
          cell: (row) => (
            <Button size="xs" variant="ghost" className="text-danger-fg" onClick={() => remove(row)}>
              Archive
            </Button>
          ),
        },
      ]
    : columns;

  return (
    <DataTable
      columns={withActions}
      rows={rows}
      rowKey={(row) => row.id}
      loading={loading || fetching}
      error={error}
      onRetry={onRetry}
      rowHref={(row) => `/results/${row.id}`}
      page={page}
      pageSize={pageSize}
      total={total}
      totalPages={totalPages}
      onPageChange={onPageChange}
      empty={{
        title: 'No result sets processed yet',
        description: 'Upload a university result sheet and CampusIQ extracts rows, computes pass percentage and records arrears.',
        icon: <UploadCloud />,
        action: <span className="text-xs text-muted">Use the Upload tab to get started.</span>,
      }}
    />
  );
}

function AnalyticsPanel({ stats, loading, error, onRetry }: { stats?: ResultAnalyticsData; loading: boolean; error: unknown; onRetry: () => void }) {
  if (loading) return <SkeletonTiles count={4} />;
  if (error || !stats) return <ErrorState error={error} onRetry={onRetry} title="Could not load result analytics" />;

  return (
    <div className="space-y-4">
      <StatGrid columns={5}>
        <StatTile
          label="Overall pass %"
          value={`${stats.overallPassPercentage.toFixed(1)}%`}
          tone={stats.overallPassPercentage >= 70 ? 'ok' : stats.overallPassPercentage >= 50 ? 'warn' : 'danger'}
          hint={`Across ${stats.resultSetCount} result set(s)`}
          icon={<Trophy />}
        />
        <StatTile label="Open arrears" value={stats.openArrears} tone={stats.openArrears > 0 ? 'danger' : 'ok'} hint="Currently uncleared" />
        <StatTile label="Cleared arrears" value={stats.clearedArrears} tone="ok" hint={`${stats.totalArrears} recorded in total`} />
        <StatTile
          label="Clearance rate"
          value={`${stats.totalArrears ? ((stats.clearedArrears / stats.totalArrears) * 100).toFixed(0) : '0'}%`}
          tone="brand"
          hint="Cleared ÷ recorded"
        />
        <StatTile label="Subjects tracked" value={stats.subjectPassRates.length} hint="With at least one result row" icon={<FileSpreadsheet />} />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Pass percentage by semester" subtitle="Trend across every processed result set" icon={<BarChart3 />} />
          <PanelBody>
            <TrendChart
              data={stats.semesterTrend.map((row) => ({ label: row.label, passPercentage: row.passPercentage, arrears: row.arrears }))}
              xKey="label"
              series={[
                { key: 'passPercentage', label: 'Pass %' },
                { key: 'arrears', label: 'Arrears' },
              ]}
              suffix=""
              height={250}
              emptyMessage="Process a result sheet to build the semester trend."
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Subject-wise pass percentage" subtitle="Lowest first — the subjects that need intervention" icon={<BarChart3 />} />
          <PanelBody>
            <CategoryBars
              data={stats.subjectPassRates.map((subject) => ({ label: subject.code || subject.name, passPercentage: subject.passPercentage }))}
              xKey="label"
              yKey="passPercentage"
              suffix="%"
              horizontal
              height={Math.max(220, stats.subjectPassRates.length * 32)}
              label="Pass %"
              color={(row) => (Number(row.passPercentage) >= 75 ? 'rgb(var(--ok))' : Number(row.passPercentage) >= 50 ? 'rgb(var(--warn))' : 'rgb(var(--danger))')}
              emptyMessage="No subject-level result data yet."
            />
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Students with the most open arrears"
          subtitle="Ranked by uncleared subjects"
          icon={<Trophy />}
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link href="/students">All students</Link>
            </Button>
          }
        />
        <PanelBody className="py-2">
          {stats.topArrearStudents.length === 0 ? (
            <EmptyState compact title="No open arrears" description="Every recorded arrear has been cleared." />
          ) : (
            <ul className="divide-y divide-line/70">
              {stats.topArrearStudents.map((student) => (
                <li key={student.studentId}>
                  <StackItem
                    href={`/students/${student.studentId}`}
                    tone={student.openArrears >= 3 ? 'danger' : 'warn'}
                    title={
                      <span className="flex items-center gap-2.5">
                        <Avatar name={student.name} size="xs" />
                        {student.name}
                      </span>
                    }
                    detail={student.registerNumber}
                    metric={`${student.openArrears} open`}
                  />
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
