'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, BookOpen, CalendarDays, ClipboardCheck, FlaskConical, Trophy, Users } from 'lucide-react';

import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { CategoryBars, DistributionDonut, GroupedBars, Heatmap, TrendChart } from '@/components/ui/charts';
import { ProgressBar } from '@/components/ui/progress';
import { DataTable, type Column } from '@/components/ui/table';
import { Field, Select } from '@/components/ui/form';
import { Avatar } from '@/components/ui/avatar';

interface AnalyticsData {
  generatedAt: string;
  attendance: {
    classAverage: number;
    distribution: { label: string; min: number; max: number; count: number }[];
    monthly: { key: string; label: string; total: number; present: number; percentage: number }[];
    subjectComparison: { subjectId: string; subjectCode: string; subjectName: string; percentage: number; total: number; absent: number; bandKey: string }[];
    studentComparison: { studentId: string; name: string; registerNumber: string; percentage: number; bandKey: string; absentCount: number; worstSubject?: string }[];
    atRisk: { studentId: string; registerNumber: string; name: string; percentage: number; bandKey: string; absentCount: number; worstSubject?: string }[];
    totals: { total: number; present: number; absent: number; late: number; excused: number; percentage: number; bandKey: string };
    thresholds: { safe: number; fine: number; debar: number; countLateAsPresent: boolean };
    recordCount: number;
  };
  academics: {
    averageScore: number;
    entries: number;
    absent: number;
    averageCgpa: number | null;
    classRanking: { classId: string; className: string; average: number; entries: number }[];
    subjectPerformance: { subjectId: string; code: string; name: string; average: number; ia1Average: number; latestAverage: number; entries: number }[];
    examTrend: { examNumber: number; label: string; average: number; entries: number }[];
  };
  results: {
    overallPassPercentage: number;
    resultSetCount: number;
    openArrears: number;
    totalArrears: number;
    clearedArrears: number;
    subjectPassRates: { subjectId: string; code: string; name: string; total: number; passed: number; passPercentage: number }[];
    semesterTrend: { semester: number; label: string; passPercentage: number; arrears: number }[];
    topArrearStudents: { studentId: string; name: string; registerNumber: string; openArrears: number }[];
  };
  timetable: { total: number; published: number; draft: number; archived: number; conflicts: number };
  demographics: {
    students: number;
    activeStudents: number;
    suspendedStudents: number;
    graduatedStudents: number;
    departmentBreakdown: { id: string; name: string; code: string; students: number; faculty: number; subjects: number; classes: number; averageCgpa: number | null; activeStudents: number }[];
    semesterBreakdown: { semester: number; students: number }[];
    genderBreakdown: { label: string; count: number }[];
  };
  engagement: { totalUsers: number; activeLast30Days: number; activityRate: number; admins: number; faculty: number; students: number; suspendedUsers: number };
}

interface HeatmapData {
  days: string[];
  periods: number[];
  cells: { day: string; period: number; total: number; percentage: number | null }[];
}

/**
 * Institution-wide analytics for administrators and faculty: attendance,
 * academics, results, timetables, demographics and engagement in one place.
 */
export function AnalyticsView() {
  const { thresholds } = useSession();
  const [departmentId, setDepartmentId] = React.useState('');
  const [classId, setClassId] = React.useState('');

  const departments = useApi<{ id: string; name: string; code: string }[]>('/api/departments');
  const classes = useApi<{ classes: { id: string; name: string; section: string; yearOfStudy: number; departmentId: string }[] }>(
    '/api/classes',
    { departmentId: departmentId || undefined },
  );

  const analytics = useApi<AnalyticsData>('/api/analytics', {
    departmentId: departmentId || undefined,
    classId: classId || undefined,
  });
  const heatmap = useApi<HeatmapData>('/api/attendance/heatmap', { departmentId: departmentId || undefined });

  const data = analytics.data?.data;

  const atRiskColumns: Column<AnalyticsData['attendance']['atRisk'][number]>[] = [
    {
      key: 'name',
      header: 'Student',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.name}</p>
          <p className="tnum truncate text-xs text-muted">{row.registerNumber}</p>
        </div>
      ),
    },
    {
      key: 'pct',
      header: 'Attendance',
      label: 'Attendance',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <ProgressBar
            value={row.percentage}
            size="sm"
            className="w-16"
            tone={row.percentage >= (thresholds?.safe ?? 80) ? 'ok' : row.percentage >= (thresholds?.debar ?? 70) ? 'warn' : 'danger'}
          />
          <span className="tnum w-11 text-right text-sm font-semibold text-ink">{row.percentage.toFixed(1)}%</span>
        </span>
      ),
    },
    {
      key: 'absent',
      header: 'Absent',
      align: 'right',
      label: 'Absent',
      cell: (row) => <span className="tnum text-sm text-muted">{row.absentCount}</span>,
    },
    {
      key: 'worst',
      header: 'Worst subject',
      label: 'Worst subject',
      cell: (row) => <span className="text-xs text-muted">{row.worstSubject ?? '—'}</span>,
    },
    {
      key: 'open',
      header: <span className="sr-only">Open</span>,
      align: 'right',
      cell: (row) => (
        <span>
          <Link href={`/students/${row.studentId}`} className="text-xs font-medium text-brand underline-offset-2 hover:underline">
            View profile
          </Link>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Institution-wide signals — where attendance is slipping, which subjects need attention, and how results are trending."
        icon={<BarChart3 />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Analytics' }]}
        meta={data ? <span className="text-xs text-subtle">Generated {new Date(data.generatedAt).toLocaleString()}</span> : null}
      />

      <div className="mt-5 space-y-5">
        <Panel>
          <PanelBody className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="min-w-52 flex-1">
              <Field label="Department" htmlFor="an-dept">
                <Select
                  id="an-dept"
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setClassId('');
                  }}
                  placeholder="Whole institution"
                  options={(departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                />
              </Field>
            </div>
            <div className="min-w-52 flex-1">
              <Field label="Class" htmlFor="an-class">
                <Select
                  id="an-class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  placeholder="All classes"
                  options={(classes.data?.data?.classes ?? []).filter((c) => !departmentId || c.departmentId === departmentId).map((c) => ({
                    value: c.id,
                    label: `${c.name} · ${c.section}`,
                  }))}
                />
              </Field>
            </div>
          </PanelBody>
        </Panel>

        {data ? (
          <>
            <StatGrid columns={4}>
              <StatTile
                label="Institution attendance"
                value={`${data.attendance.totals.percentage.toFixed(1)}%`}
                hint={`${data.attendance.totals.present} present of ${data.attendance.totals.total} records`}
                tone={data.attendance.totals.percentage >= (thresholds?.safe ?? 80) ? 'ok' : 'warn'}
                icon={<ClipboardCheck />}
              />
              <StatTile
                label="At-risk students"
                value={data.attendance.atRisk.length}
                hint={`Below ${thresholds?.safe ?? 80}% attendance`}
                tone={data.attendance.atRisk.length > 0 ? 'danger' : 'ok'}
                icon={<AlertTriangle />}
              />
              <StatTile
                label="Average IA score"
                value={data.academics.entries ? `${data.academics.averageScore.toFixed(1)}%` : '—'}
                hint={data.academics.entries ? `${data.academics.entries} marks recorded` : 'No IA marks yet'}
                tone="brand"
                icon={<BookOpen />}
              />
              <StatTile
                label="Result pass rate"
                value={data.results.resultSetCount ? `${data.results.overallPassPercentage.toFixed(1)}%` : '—'}
                hint={data.results.resultSetCount ? `${data.results.openArrears} open arrears` : 'No university results yet'}
                tone={data.results.resultSetCount && data.results.overallPassPercentage < 70 ? 'warn' : 'ok'}
                icon={<Trophy />}
              />
            </StatGrid>

            <section aria-labelledby="an-attendance">
              <h2 id="an-attendance" className="section-rule">
                Attendance
              </h2>
              <div className="mt-3 grid gap-5 xl:grid-cols-2">
                <Panel>
                  <PanelHeader title="Monthly trend" icon={<ClipboardCheck />} actions={<Badge tone="neutral">Class avg {data.attendance.classAverage.toFixed(1)}%</Badge>} />
                  <PanelBody>
                    <TrendChart
                      data={data.attendance.monthly.map((m) => ({ label: m.label, attendance: m.percentage }))}
                      xKey="label"
                      series={[{ key: 'attendance', label: 'Attendance' }]}
                      suffix="%"
                      height={240}
                    />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Distribution of students" subtitle="How many students sit in each attendance band." icon={<ClipboardCheck />} />
                  <PanelBody>
                    <CategoryBars
                      data={data.attendance.distribution.map((b) => ({ label: b.label, count: b.count }))}
                      xKey="label"
                      yKey="count"
                      label="Students"
                      height={240}
                      suffix=""
                    />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Subject comparison" subtitle="Average attendance per subject, lowest first is where intervention pays off." icon={<ClipboardCheck />} />
                  <PanelBody>
                    <CategoryBars
                      data={data.attendance.subjectComparison
                        .slice()
                        .sort((a, b) => a.percentage - b.percentage)
                        .slice(0, 12)
                        .map((s) => ({ label: s.subjectCode, percentage: s.percentage }))}
                      xKey="label"
                      yKey="percentage"
                      label="Attendance"
                      height={240}
                      suffix="%"
                    />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Attendance by day & period" subtitle="Where the institution shows up — and where it doesn't." icon={<ClipboardCheck />} />
                  <PanelBody>
                    {heatmap.data?.data ? (
                      (() => {
                        const heat = heatmap.data.data;
                        const lookup = new Map(heat.cells.map((c) => [`${c.day}:${c.period}`, c.percentage]));
                        return <Heatmap days={heat.days} periods={heat.periods} value={(day, period) => lookup.get(`${day}:${period}`) ?? null} />;
                      })()
                    ) : (
                      <p className="py-6 text-center text-sm text-muted">Loading the heatmap…</p>
                    )}
                  </PanelBody>
                </Panel>
              </div>
            </section>

            {data.attendance.atRisk.length > 0 ? (
              <Panel>
                <PanelHeader
                  title={`${data.attendance.atRisk.length} student(s) below the safety line`}
                  subtitle={`Safe requires ${thresholds?.safe ?? 80}% or higher. Open a profile to see exactly which classes close the gap.`}
                  icon={<AlertTriangle />}
                />
                <PanelBody>
                  <DataTable
                    columns={atRiskColumns}
                    rows={data.attendance.atRisk.slice(0, 10)}
                    rowKey={(row) => row.studentId}
                    caption="Students with the lowest attendance"
                  />
                </PanelBody>
              </Panel>
            ) : null}

            <section aria-labelledby="an-academics">
              <h2 id="an-academics" className="section-rule">
                Academics
              </h2>
              <div className="mt-3 grid gap-5 xl:grid-cols-3">
                <Panel>
                  <PanelHeader
                    title="Class ranking"
                    subtitle="Average IA score per class."
                    icon={<BookOpen />}
                    actions={data.academics.averageCgpa ? <Badge tone="brand">Avg CGPA {data.academics.averageCgpa.toFixed(2)}</Badge> : null}
                  />
                  <PanelBody>
                    <CategoryBars
                      data={data.academics.classRanking
                        .slice()
                        .sort((a, b) => b.average - a.average)
                        .slice(0, 10)
                        .map((c) => ({ label: c.className.split('·').pop()?.trim() ?? c.className, average: c.average }))}
                      xKey="label"
                      yKey="average"
                      label="Average"
                      height={260}
                      suffix="%"
                    />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="IA trend by exam" subtitle="Average score per internal exam, oldest to newest." icon={<BookOpen />} />
                  <PanelBody>
                    <TrendChart
                      data={data.academics.examTrend.map((t) => ({ label: t.label, average: t.average }))}
                      xKey="label"
                      series={[{ key: 'average', label: 'Average' }]}
                      suffix="%"
                      height={260}
                    />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Subjects to watch" subtitle="Lowest subject averages first — IA-1 vs the latest exam." icon={<BookOpen />} />
                  <PanelBody>
                    <GroupedBars
                      data={data.academics.subjectPerformance.slice(0, 8).map((s) => ({ label: s.code, ia1: s.ia1Average, latest: s.latestAverage }))}
                      xKey="label"
                      series={[
                        { key: 'ia1', label: 'IA 1' },
                        { key: 'latest', label: 'Latest' },
                      ]}
                      height={260}
                      suffix="%"
                    />
                  </PanelBody>
                </Panel>
              </div>
            </section>

            <section aria-labelledby="an-results">
              <h2 id="an-results" className="section-rule">
                University results
              </h2>
              <div className="mt-3 grid gap-5 xl:grid-cols-2">
                <Panel>
                  <PanelHeader
                    title="Pass percentage by semester"
                    icon={<Trophy />}
                    actions={
                      data.results.resultSetCount ? (
                        <span className="flex items-center gap-2">
                          <Badge tone="ok">Overall {data.results.overallPassPercentage.toFixed(1)}%</Badge>
                          <Badge tone={data.results.openArrears ? 'danger' : 'neutral'}>{data.results.openArrears} open arrears</Badge>
                        </span>
                      ) : null
                    }
                  />
                  <PanelBody>
                    <TrendChart
                      data={data.results.semesterTrend.map((s) => ({ label: s.label, pass: s.passPercentage }))}
                      xKey="label"
                      series={[{ key: 'pass', label: 'Pass %' }]}
                      suffix="%"
                      height={240}
                    />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Subject pass rates" subtitle="University-level subject performance." icon={<Trophy />} />
                  <PanelBody>
                    <CategoryBars
                      data={data.results.subjectPassRates
                        .slice()
                        .sort((a, b) => a.passPercentage - b.passPercentage)
                        .slice(0, 12)
                        .map((s) => ({ label: s.code, pass: s.passPercentage }))}
                      xKey="label"
                      yKey="pass"
                      label="Pass %"
                      height={240}
                      suffix="%"
                    />
                  </PanelBody>
                </Panel>
              </div>
            </section>

            <section aria-labelledby="an-structure">
              <h2 id="an-structure" className="section-rule">
                Institution
              </h2>
              <div className="mt-3 grid gap-5 xl:grid-cols-3">
                <Panel>
                  <PanelHeader
                    title="Students by department"
                    icon={<Users />}
                    actions={
                      <span className="text-xs text-muted">
                        {data.demographics.students} total · {data.demographics.activeStudents} active
                      </span>
                    }
                  />
                  <PanelBody>
                    <CategoryBars
                      data={data.demographics.departmentBreakdown.map((d) => ({ label: d.code, students: d.students }))}
                      xKey="label"
                      yKey="students"
                      label="Students"
                      height={240}
                      suffix=""
                    />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Gender mix" icon={<Users />} />
                  <PanelBody className="flex items-center justify-center">
                    <DistributionDonut
                      data={data.demographics.genderBreakdown
                        .filter((g) => g.count > 0)
                        .map((g) => ({ label: g.label, value: g.count }))}
                      centerValue={data.demographics.students}
                      centerLabel="students"
                    />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Timetables & engagement" icon={<CalendarDays />} />
                  <PanelBody className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <MiniStat label="Timetables published" value={data.timetable.published} icon={<CalendarDays />} />
                      <MiniStat label="In draft" value={data.timetable.draft} icon={<CalendarDays />} />
                      <MiniStat label="Open conflicts" value={data.timetable.conflicts} tone={data.timetable.conflicts ? 'danger' : 'ok'} icon={<AlertTriangle />} />
                      <MiniStat label="Active users (30d)" value={data.engagement.activeLast30Days} hint={`${data.engagement.activityRate.toFixed(0)}% of all accounts`} icon={<Users />} />
                    </div>
                    <p className="text-xs text-muted">
                      Accounts: {data.engagement.students} students · {data.engagement.faculty} faculty · {data.engagement.admins} admins
                      {data.engagement.suspendedUsers ? ` · ${data.engagement.suspendedUsers} suspended` : ''}
                    </p>
                  </PanelBody>
                </Panel>
              </div>
            </section>
          </>
        ) : analytics.error ? (
          <Panel>
            <PanelBody>
              <p className="text-sm text-muted">Could not load analytics.</p>
            </PanelBody>
          </Panel>
        ) : (
          <Panel>
            <PanelBody>
              <p className="py-8 text-center text-sm text-muted">Crunching the numbers…</p>
            </PanelBody>
          </Panel>
        )}
      </div>
    </>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
  icon?: React.ReactNode;
}) {
  const toneClass = { neutral: 'text-ink', ok: 'text-ok-fg', warn: 'text-warn-fg', danger: 'text-danger-fg' }[tone];
  return (
    <div className="rounded-md border border-line bg-raised p-3">
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
        {icon ? <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>{icon}</span> : null}
        {label}
      </p>
      <p className={`tnum mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
