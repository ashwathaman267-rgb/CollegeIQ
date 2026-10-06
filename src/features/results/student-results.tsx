'use client';

import * as React from 'react';
import { Award, CalendarClock, CheckCircle2, FileSpreadsheet, Trophy, XCircle } from 'lucide-react';

import { formatDate } from '@/lib/format';
import { useApi } from '@/hooks/use-api';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { TrendChart } from '@/components/ui/charts';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, ErrorState, SkeletonTiles } from '@/components/ui/states';
import { Tabs } from '@/components/ui/dropdown';

interface SubjectResult {
  subjectId: string;
  code: string;
  name: string;
  marks: number | null;
  grade: string | null;
  status: string;
}

interface ResultRow {
  id: string;
  universityResultId: string;
  name: string;
  semester: number;
  declaredOn: string;
  gpa: number | null;
  aggregate: number | null;
  status: string;
  arrearsCount: number;
  subjects: SubjectResult[];
}

interface TimelineEntry {
  semester: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  status: 'OPEN' | 'CLEARED';
  firstAttempt: string;
  clearedAt?: string | null;
  attempts: number;
}

interface StudentHistory {
  registerNumber: string;
  results: ResultRow[];
  timeline: TimelineEntry[];
  openArrears: TimelineEntry[];
  clearedArrears: TimelineEntry[];
  cgpa: number | null;
  averageGpa: number | null;
}

export function StudentResults() {
  const history = useApi<StudentHistory>('/api/results/me');
  const data = history.data?.data;
  const [tab, setTab] = React.useState<'results' | 'arrears'>('results');
  const [openResult, setOpenResult] = React.useState<string | null>(null);

  if (history.isLoading) return <SkeletonTiles count={4} />;
  if (history.isError || !data) return <ErrorState error={history.error} onRetry={() => history.refetch()} title="Could not load your results" />;

  const latest = data.results[0];
  const expanded = openResult ?? latest?.id ?? null;
  const expandedResult = data.results.find((result) => result.id === expanded) ?? null;

  const subjectColumns: Column<SubjectResult>[] = [
    {
      key: 'subject',
      header: 'Subject',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          <p className="text-xs text-subtle">{row.code}</p>
        </div>
      ),
    },
    { key: 'marks', header: 'Marks', align: 'right', label: 'Marks', cell: (row) => <span className="tnum text-sm text-ink">{row.marks ?? '—'}</span> },
    { key: 'grade', header: 'Grade', align: 'center', label: 'Grade', cell: (row) => <Badge tone={row.status === 'PASS' ? 'ok' : 'danger'}>{row.grade ?? '—'}</Badge> },
    { key: 'status', header: 'Result', align: 'center', label: 'Result', cell: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-4">
      <StatGrid columns={4}>
        <StatTile label="CGPA" value={data.cgpa ? data.cgpa.toFixed(2) : '—'} tone="brand" hint={data.registerNumber ? `Register ${data.registerNumber}` : undefined} icon={<Award />} />
        <StatTile
          label="Latest semester GPA"
          value={latest?.gpa ? latest.gpa.toFixed(2) : '—'}
          tone={latest && latest.gpa !== null && latest.gpa >= 7 ? 'ok' : 'warn'}
          hint={latest ? `Semester ${latest.semester} · ${formatDate(latest.declaredOn, { month: 'short', year: 'numeric' })}` : 'No results published'}
          icon={<Trophy />}
        />
        <StatTile label="Open arrears" value={data.openArrears.length} tone={data.openArrears.length ? 'danger' : 'ok'} hint={data.openArrears.length ? data.openArrears.map((a) => a.subjectCode).slice(0, 3).join(', ') : 'Nothing outstanding'} icon={<XCircle />} />
        <StatTile label="Cleared arrears" value={data.clearedArrears.length} tone="ok" hint="Previously failed, now passed" icon={<CheckCircle2 />} />
      </StatGrid>

      <Panel>
        <PanelHeader title="GPA trend" subtitle="Semester by semester" icon={<TrendingChartIcon />} />
        <PanelBody>
          <TrendChart
            data={[...data.results].reverse().map((result) => ({ label: `Sem ${result.semester}`, gpa: result.gpa ?? 0 }))}
            xKey="label"
            series={[{ key: 'gpa', label: 'GPA' }]}
            suffix=""
            height={220}
            yDomain={[0, 10]}
            emptyMessage="Your GPA trend appears after your first published result."
          />
        </PanelBody>
      </Panel>

      <Tabs
        ariaLabel="Result sections"
        value={tab}
        onValueChange={(value) => setTab(value as 'results' | 'arrears')}
        items={[
          { value: 'results', label: 'Results', count: data.results.length, icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
          { value: 'arrears', label: 'Arrear timeline', count: data.timeline.length, icon: <CalendarClock className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'results' ? (
        data.results.length === 0 ? (
          <Panel>
            <EmptyState icon={<FileSpreadsheet />} title="No results published yet" description="When your university results are processed by your department, they appear here semester by semester." />
          </Panel>
        ) : (
          <div className="space-y-3">
            {data.results.map((result) => {
              const isOpen = result.id === expanded;
              return (
                <Panel key={result.id}>
                  <PanelHeader
                    title={result.name}
                    subtitle={`Semester ${result.semester} · declared ${formatDate(result.declaredOn, { day: '2-digit', month: 'short', year: 'numeric' })}`}
                    icon={<FileSpreadsheet />}
                    actions={
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={result.status} />
                        <Badge tone="neutral">GPA {result.gpa ? result.gpa.toFixed(2) : '—'}</Badge>
                        {result.arrearsCount > 0 ? <Badge tone="danger">{result.arrearsCount} arrear{result.arrearsCount === 1 ? '' : 's'}</Badge> : null}
                        <button
                          type="button"
                          onClick={() => setOpenResult(isOpen ? null : result.id)}
                          className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? 'Hide subjects' : 'Show subjects'}
                        </button>
                      </div>
                    }
                  />
                  {isOpen ? (
                    <>
                      <PanelBody className="grid grid-cols-2 gap-3 border-b border-line bg-raised/60 sm:grid-cols-4">
                        {[
                          { label: 'GPA', value: result.gpa ? result.gpa.toFixed(2) : '—' },
                          { label: 'Aggregate', value: result.aggregate ? `${result.aggregate.toFixed(1)}%` : '—' },
                          { label: 'Subjects', value: result.subjects.length },
                          { label: 'Failed', value: result.subjects.filter((s) => s.status !== 'PASS').length },
                        ].map((tile) => (
                          <div key={tile.label}>
                            <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">{tile.label}</p>
                            <p className="tnum mt-0.5 text-lg font-semibold text-ink">{tile.value}</p>
                          </div>
                        ))}
                      </PanelBody>
                      <DataTable columns={subjectColumns} rows={result.subjects} rowKey={(row) => row.subjectId} dense />
                    </>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        )
      ) : (
        <Panel>
          <PanelHeader
            title="Arrear timeline"
            subtitle="Every subject you have had to reappear for, and when it was cleared"
            icon={<CalendarClock />}
            actions={<Badge tone={data.openArrears.length ? 'danger' : 'ok'}>{data.openArrears.length} open</Badge>}
          />
          <PanelBody className="py-3">
            {data.timeline.length === 0 ? (
              <EmptyState compact icon={<CheckCircle2 />} title="No arrears on record" description="You have cleared every subject in the first attempt so far." />
            ) : (
              <ol className="relative space-y-3 border-l border-line pl-5">
                {data.timeline.map((entry) => (
                  <li key={`${entry.subjectId}-${entry.semester}`} className="relative">
                    <span
                      className={`absolute -left-[1.65rem] top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 border-surface ${entry.status === 'CLEARED' ? 'bg-ok' : 'bg-danger'}`}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink">
                        {entry.subjectCode} · {entry.subjectName}
                      </p>
                      <StatusBadge status={entry.status} />
                      <Badge tone="neutral">Semester {entry.semester}</Badge>
                      {entry.attempts > 1 ? <Badge tone="warn">{entry.attempts} attempts</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      First attempt {formatDate(entry.firstAttempt, { day: '2-digit', month: 'short', year: 'numeric' })}
                      {entry.clearedAt ? ` · cleared ${formatDate(entry.clearedAt, { day: '2-digit', month: 'short', year: 'numeric' })}` : ' · still open'}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </PanelBody>
        </Panel>
      )}

      {expandedResult ? <span className="sr-only">Showing subjects for {expandedResult.name}</span> : null}
    </div>
  );
}

function TrendingChartIcon() {
  return <Trophy className="h-4 w-4" aria-hidden />;
}
