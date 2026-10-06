'use client';

import * as React from 'react';
import { BookOpen, GraduationCap, Medal, TrendingUp } from 'lucide-react';

import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { Badge } from '@/components/ui/badge';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { GroupedBars, TrendChart } from '@/components/ui/charts';
import { MetricRow } from '@/components/ui/progress';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, ErrorState, SkeletonTiles } from '@/components/ui/states';

interface ExamMark {
  id: string;
  name: string;
  examNumber: number;
  marks: number | null;
  maxMarks: number;
  percentage: number | null;
  isAbsent: boolean;
  date: string;
}

interface StudentAcademics {
  subjects: { subjectId: string; code: string; name: string; percentage: number; exams: ExamMark[] }[];
  overall: number;
  trend: { name: string; percentage: number }[];
  examCount: number;
  rank: number | null;
  classSize?: number;
  classAverage: number;
}

export function StudentAcademics({ studentId: studentIdProp }: { studentId?: string | null }) {
  const { user, academic } = useSession();
  const studentId = studentIdProp ?? user?.studentId;
  const query = useApi<{ student: StudentAcademics }>('/api/academics', { studentId }, { enabled: Boolean(studentId) });
  const data = query.data?.data?.student;

  if (query.isLoading) return <SkeletonTiles count={4} />;
  if (query.isError || !data) return <ErrorState error={query.error} onRetry={() => query.refetch()} title="Could not load your academics" />;

  const columns: Column<{ subjectId: string; code: string; name: string; percentage: number; exams: ExamMark[] }>[] = [
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
    ...Array.from({ length: Math.max(1, ...data.subjects.map((s) => s.exams.length), 1) }).map((_, index) => ({
      key: `exam-${index}`,
      header: data.subjects.map((s) => s.exams[index]?.name).filter(Boolean)[0] ?? `IA ${index + 1}`,
      label: `IA ${index + 1}`,
      align: 'center' as const,
      hideOnMobile: index > 1,
      cell: (row: { exams: ExamMark[] }) => {
        const exam = row.exams[index];
        if (!exam) return <span className="text-xs text-subtle">—</span>;
        if (exam.isAbsent) return <Badge tone="danger">Absent</Badge>;
        return (
          <span className="tnum text-sm text-ink">
            {exam.marks}
            <span className="text-xs text-subtle">/{exam.maxMarks}</span>
          </span>
        );
      },
    })),
    {
      key: 'average',
      header: 'Average',
      align: 'right',
      label: 'Average',
      cell: (row) => (
        <span className={cnTone(row.percentage, academic?.passMarkPercentage ?? 50)}>
          {row.percentage.toFixed(1)}%
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <StatGrid columns={4}>
        <StatTile
          label="Overall IA average"
          value={`${data.overall.toFixed(1)}%`}
          tone={data.overall >= (academic?.passMarkPercentage ?? 50) ? 'ok' : 'danger'}
          hint={`Across ${data.examCount} assessment${data.examCount === 1 ? '' : 's'}`}
          icon={<BookOpen />}
        />
        <StatTile
          label="Class rank"
          value={data.rank ? `${data.rank} / ${data.classSize ?? '—'}` : '—'}
          tone="brand"
          hint={data.rank && data.rank <= 3 ? 'Top three in your class' : `Class average ${data.classAverage.toFixed(1)}%`}
          icon={<Medal />}
        />
        <StatTile
          label="Subjects tracked"
          value={data.subjects.length}
          hint="With at least one internal assessment"
          icon={<GraduationCap />}
        />
        <StatTile
          label="Latest trend"
          value={data.trend.length >= 2 ? `${(data.trend[data.trend.length - 1].percentage - data.trend[0].percentage >= 0 ? '+' : '')}${(data.trend[data.trend.length - 1].percentage - data.trend[0].percentage).toFixed(1)}%` : '—'}
          tone={data.trend.length >= 2 && data.trend[data.trend.length - 1].percentage >= data.trend[0].percentage ? 'ok' : 'warn'}
          hint="Change from the first to the latest assessment"
          icon={<TrendingUp />}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Assessment trend" subtitle="Your average across each internal assessment" icon={<TrendingUp />} />
          <PanelBody>
            <TrendChart
              data={data.trend}
              xKey="name"
              series={[{ key: 'percentage', label: 'Average' }]}
              suffix="%"
              height={240}
              emptyMessage="Trend appears after two assessments."
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Subject averages" subtitle="Internal assessment percentage per subject" icon={<BookOpen />} />
          <PanelBody className="py-3">
            {data.subjects.length === 0 ? (
              <EmptyState compact title="No internal marks yet" description="Your subject averages appear once faculty publish IA marks." />
            ) : (
              <div className="space-y-0.5">
                {data.subjects.map((subject) => (
                  <MetricRow
                    key={subject.subjectId}
                    label={`${subject.code} · ${subject.name}`}
                    value={subject.percentage}
                    tone={subject.percentage >= 70 ? 'ok' : subject.percentage >= (academic?.passMarkPercentage ?? 50) ? 'warn' : 'danger'}
                    threshold={academic?.passMarkPercentage ?? 50}
                    sublabel={`${subject.exams.filter((e) => !e.isAbsent).length} assessment(s) recorded`}
                  />
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Marks by assessment" subtitle="Every internal assessment, subject by subject" icon={<BookOpen />} />
        <DataTable
          columns={columns}
          rows={data.subjects}
          rowKey={(row) => row.subjectId}
          empty={{ title: 'No internal marks published yet', description: 'When your faculty enter IA marks they appear here subject by subject.' }}
        />
      </Panel>

      {data.subjects.some((subject) => subject.exams.length > 1) ? (
        <Panel>
          <PanelHeader title="First vs latest assessment" subtitle="Where you improved and where you slipped" icon={<TrendingUp />} />
          <PanelBody>
            <GroupedBars
              data={data.subjects.map((subject) => ({
                label: subject.code,
                first: subject.exams[0]?.percentage ?? 0,
                latest: subject.exams[subject.exams.length - 1]?.percentage ?? 0,
              }))}
              xKey="label"
              series={[
                { key: 'first', label: data.subjects[0]?.exams[0]?.name ?? 'First IA' },
                { key: 'latest', label: 'Latest IA' },
              ]}
              height={260}
            />
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}

function cnTone(value: number, pass: number) {
  return `tnum text-sm font-semibold ${value >= 70 ? 'text-ok-fg' : value >= pass ? 'text-warn-fg' : 'text-danger-fg'}`;
}
