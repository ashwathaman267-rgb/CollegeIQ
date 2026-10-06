'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Pencil,
  Trophy,
  UserRound,
} from 'lucide-react';

import { formatGpa } from '@/lib/format';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { BandBadge, Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/dropdown';
import { Field, Input, Select } from '@/components/ui/form';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { DeltaTag, MetricRow, toneFor } from '@/components/ui/progress';
import { TrendChart } from '@/components/ui/charts';
import { EmptyState, ErrorState, SkeletonRows, SkeletonTiles } from '@/components/ui/states';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { api } from '@/lib/api-client';

interface ProfileData {
  id: string;
  userId: string;
  registerNumber: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  gender: string;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  bloodGroup: string | null;
  batch: string | null;
  admissionYear: number | null;
  semester: number;
  cgpa: number | null;
  academicStatus: string;
  department: { id: string; name: string; code: string };
  class: { id: string; name: string; section: string; yearOfStudy: number; academicYear: string } | null;
  subjects: { id: string; code: string; name: string; subjectType: string; weeklyPeriods: number; credits: number }[];
  openArrears: { id: string; subjectCode: string; subjectName: string; semester: number; attempts: number }[];
  resumeCount: number;
  joinedOn: string;
  lastLoginAt: string | null;
}

interface AttendanceSummary {
  overall: { total: number; present: number; absent: number; late: number; excused: number; percentage: number; bandKey: string; band: { label: string } };
  subjects: {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    total: number;
    absent: number;
    percentage: number;
    bandKey: string;
    classesNeeded: number;
    lastClass?: string;
  }[];
  monthly: { key: string; label: string; total: number; present: number; percentage: number }[];
  delta: number | null;
  atRiskSubjects: { subjectName: string; percentage: number; classesNeeded: number }[];
  classesNeededForSafe: number;
  thresholds: { safe: number; fine: number; debar: number; countLateAsPresent: boolean };
  lastUpdated?: string;
}

interface AcademicsData {
  subjects: {
    subjectId: string;
    code: string;
    name: string;
    percentage: number;
    exams: { id: string; name: string; examNumber: number; marks: number | null; maxMarks: number; percentage: number | null; isAbsent: boolean; date: string }[];
  }[];
  overall: number;
  trend: { name: string; percentage: number }[];
  examCount: number;
  rank: number | null;
  classSize: number;
  classAverage: number;
}

interface ResultEntry {
  id: string;
  name: string;
  semester: number;
  declaredOn: string;
  gpa: number | null;
  aggregate: number | null;
  status: string;
  arrearsCount: number;
  subjects: { subjectId: string; code: string; name: string; marks: number | null; grade: string | null; status: string }[];
}

interface ResultsData {
  registerNumber: string;
  results: ResultEntry[];
  timeline: {
    semester: number;
    subjectCode: string;
    subjectName: string;
    status: 'OPEN' | 'CLEARED';
    firstAttempt: string;
    clearedAt: string | null;
    attempts: number;
  }[];
  openArrears: number;
  clearedArrears: number;
  cgpa: number | null;
  averageGpa: number | null;
}

interface Bundle {
  profile: ProfileData;
  attendance: AttendanceSummary;
  academics: AcademicsData;
  results: ResultsData;
}

type Tab = 'attendance' | 'academics' | 'results' | 'details';

/** Read-only 360° view of one student for faculty and administrators. */
export function StudentProfile({ studentId }: { studentId: string }) {
  const { user, can, thresholds } = useSession();
  const bundle = useApi<Bundle>(`/api/students/${studentId}`);
  const invalidate = useInvalidate();
  const [tab, setTab] = React.useState<Tab>('attendance');
  const [editOpen, setEditOpen] = React.useState(false);

  const data = bundle.data?.data;

  if (bundle.isLoading) {
    return (
      <div className="space-y-5">
        <SkeletonRows rows={2} />
        <SkeletonTiles count={4} />
        <SkeletonRows rows={8} />
      </div>
    );
  }

  if (bundle.error || !data) {
    return (
      <>
        <PageHeader title="Student" breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Students', href: '/students' }, { label: 'Profile' }]} />
        <ErrorState error={bundle.error ?? new Error('That student could not be loaded.')} onRetry={() => bundle.refetch()} />
      </>
    );
  }

  const { profile, attendance, academics, results } = data;
  const overall = attendance.overall;

  return (
    <>
      <PageHeader
        title={`${profile.firstName} ${profile.lastName}`}
        description={`${profile.registerNumber} · ${profile.department.name}${profile.class ? ` · ${profile.class.name}` : ''}`}
        icon={<UserRound />}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Students', href: '/students' },
          { label: profile.registerNumber },
        ]}
        meta={
          <>
            <StatusBadge status={profile.academicStatus} />
            <Badge tone="neutral">Semester {profile.semester}</Badge>
            {profile.class ? <Badge tone="neutral">Academic year {profile.class.academicYear}</Badge> : null}
            <span className="text-xs text-subtle">Last active {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleDateString() : 'never'}</span>
          </>
        }
        actions={
          <>
            {can('students.manage') ? (
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" aria-hidden />
                Edit
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" asChild>
              <Link href="/students">
                <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
                All students
              </Link>
            </Button>
          </>
        }
      />

      <div className="mt-5 space-y-5">
        <StatGrid columns={4}>
          <StatTile
            label="Overall attendance"
            value={overall.total ? `${overall.percentage.toFixed(1)}%` : 'No records'}
            hint={overall.total ? `${overall.present} present of ${overall.total} classes` : undefined}
            tone={overall.total ? toneFor(overall.percentage, thresholds ?? { safe: 80, fine: 75, debar: 70 }) : 'neutral'}
            icon={<ClipboardCheck />}
            delta={attendance.delta}
          />
          <StatTile
            label="CGPA"
            value={formatGpa(results.cgpa ?? profile.cgpa)}
            hint={`Average ${formatGpa(results.averageGpa)}`}
            tone="brand"
            icon={<GraduationCap />}
          />
          <StatTile
            label="IA performance"
            value={academics.examCount ? `${academics.overall.toFixed(1)}%` : 'No marks'}
            hint={
              academics.rank
                ? `${academics.rank} of ${academics.classSize} in class (avg ${academics.classAverage.toFixed(1)}%)`
                : 'Enter IA marks to see ranking'
            }
            tone={academics.examCount ? toneFor(academics.overall, { safe: 80, fine: 60, debar: 40 }) : 'neutral'}
            icon={<BookOpen />}
          />
          <StatTile
            label="Open arrears"
            value={results.openArrears}
            hint={results.clearedArrears ? `${results.clearedArrears} cleared earlier` : 'No cleared arrears'}
            tone={results.openArrears > 0 ? 'danger' : 'ok'}
            icon={<Trophy />}
          />
        </StatGrid>

        <Tabs
          ariaLabel="Student profile sections"
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          items={[
            { value: 'attendance', label: 'Attendance', icon: <ClipboardCheck />, count: overall.total || undefined },
            { value: 'academics', label: 'Academics', icon: <BookOpen /> },
            { value: 'results', label: 'Results', icon: <Trophy />, count: results.results.length || undefined },
            { value: 'details', label: 'Profile details', icon: <FileText /> },
          ]}
        />

        {tab === 'attendance' ? <AttendanceTab summary={attendance} thresholds={thresholds ?? { safe: 80, fine: 75, debar: 70 }} /> : null}
        {tab === 'academics' ? <AcademicsTab data={academics} /> : null}
        {tab === 'results' ? <ResultsTab data={results} /> : null}
        {tab === 'details' ? <DetailsTab profile={profile} /> : null}
      </div>

      <EditStudentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        studentId={profile.id}
        initial={{
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          registerNumber: profile.registerNumber,
          rollNumber: profile.rollNumber ?? undefined,
          departmentId: profile.department.id,
          classId: profile.class?.id ?? null,
          semester: profile.semester,
          phone: profile.phone ?? undefined,
          address: profile.address ?? undefined,
          city: profile.city ?? undefined,
          guardianName: profile.guardianName ?? undefined,
          guardianPhone: profile.guardianPhone ?? undefined,
          bloodGroup: profile.bloodGroup ?? undefined,
          batch: profile.batch ?? undefined,
          cgpa: profile.cgpa,
          academicStatus: profile.academicStatus,
        }}
        onSaved={() => {
          invalidate(`/api/students/${profile.id}`, '/api/students');
          setEditOpen(false);
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function AttendanceTab({ summary, thresholds }: { summary: AttendanceSummary; thresholds: { safe: number; fine: number; debar: number } }) {
  const { overall } = summary;

  if (!overall.total) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState icon={<ClipboardCheck />} title="No attendance recorded yet" description="When faculty mark this student's sessions, the subject-wise breakdown and monthly trend appear here." />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel>
        <PanelHeader
          title="Subject-wise attendance"
          subtitle={`Safe at or above ${thresholds.safe}%. A late is ${summary.thresholds.countLateAsPresent ? 'counted as present' : 'not counted as present'}.`}
          icon={<ClipboardCheck />}
          actions={
            <span className="flex items-center gap-2 text-xs text-muted">
              Overall <span className="tnum text-sm font-semibold text-ink">{overall.percentage.toFixed(1)}%</span> <BandBadge band={overall.bandKey} />
            </span>
          }
        />
        <PanelBody>
          {summary.subjects.map((subject) => (
            <MetricRow
              key={subject.subjectId}
              label={subject.subjectName}
              sublabel={`${subject.total} classes · ${subject.absent} absent${subject.lastClass ? ` · last ${subject.lastClass}` : ''}`}
              value={subject.percentage}
              tone={toneFor(subject.percentage, thresholds)}
              trailing={
                subject.percentage < thresholds.safe ? (
                  <Badge tone="warn" icon={<AlertTriangle />}>
                    {subject.classesNeeded} more to reach {thresholds.safe}%
                  </Badge>
                ) : null
              }
            />
          ))}
          <p className="mt-3 text-xs text-subtle">
            Present: {overall.present} · Absent: {overall.absent} · Late: {overall.late} · Excused: {overall.excused}
          </p>
        </PanelBody>
      </Panel>

      <div className="space-y-5">
        <Panel>
          <PanelHeader title="Monthly trend" subtitle="Percentage per month, oldest to newest." icon={<ClipboardCheck />} actions={<DeltaTag delta={summary.delta} />} />
          <PanelBody>
            <TrendChart
              data={summary.monthly.map((m) => ({ label: m.label, percentage: m.percentage }))}
              xKey="label"
              series={[{ key: 'percentage', label: 'Attendance' }]}
              suffix="%"
              height={220}
            />
          </PanelBody>
        </Panel>

        {summary.atRiskSubjects.length > 0 ? (
          <Panel>
            <PanelHeader title="Needs attention" subtitle="Subjects currently below the safety line, and how many perfect classes close the gap." icon={<AlertTriangle />} />
            <PanelBody>
              <ul className="space-y-1.5">
                {summary.atRiskSubjects.map((subject) => (
                  <li key={subject.subjectName} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink">{subject.subjectName}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-muted">{subject.percentage.toFixed(1)}%</span>
                      <Badge tone="warn">{subject.classesNeeded} more class{subject.classesNeeded === 1 ? '' : 'es'}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function AcademicsTab({ data }: { data: AcademicsData }) {
  if (!data.examCount) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState
            icon={<BookOpen />}
            title="No IA marks yet"
            description="Once faculty enter IA-1 / IA-2 marks for this student's class, the per-subject breakdown, exam trend and class rank appear here."
          />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel>
        <PanelHeader
          title="Internal assessment by subject"
          subtitle={`Average across ${data.examCount} exam(s) per subject.`}
          icon={<BookOpen />}
          actions={
            data.rank ? (
              <Badge tone="brand" icon={<GraduationCap />}>
                Rank {data.rank} of {data.classSize}
              </Badge>
            ) : null
          }
        />
        <PanelBody>
          {data.subjects.map((subject) => (
            <div key={subject.subjectId} className="py-2">
              <MetricRow
                label={
                  <span>
                    <span className="tnum text-xs text-subtle">{subject.code}</span> {subject.name}
                  </span>
                }
                sublabel={subject.exams
                  .map((exam) =>
                    exam.isAbsent || exam.marks === null
                      ? `${exam.name}: absent`
                      : `${exam.name}: ${exam.marks}/${exam.maxMarks}`,
                  )
                  .join(' · ')}
                value={subject.percentage}
                tone={toneFor(subject.percentage, { safe: 80, fine: 60, debar: 40 })}
              />
            </div>
          ))}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Trend across exams" subtitle="Class context: this student averages vs the class average." icon={<BookOpen />} />
        <PanelBody className="space-y-4">
          <TrendChart
            data={data.trend.map((t, index) => ({ label: `IA ${index + 1}`, percentage: t.percentage, className: data.classAverage }))}
            xKey="label"
            series={[
              { key: 'percentage', label: 'Student' },
              { key: 'className', label: 'Class average' },
            ]}
            suffix="%"
            height={220}
          />
          <div className="flex items-center justify-between rounded-md border border-line bg-raised px-3 py-2 text-sm">
            <span className="text-muted">Overall IA average</span>
            <span className="tnum font-semibold text-ink">{data.overall.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-line bg-raised px-3 py-2 text-sm">
            <span className="text-muted">Class average</span>
            <span className="tnum font-semibold text-ink">{data.classAverage.toFixed(1)}%</span>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

function ResultsTab({ data }: { data: ResultsData }) {
  if (data.results.length === 0 && data.timeline.length === 0) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState
            icon={<Trophy />}
            title="No university results published yet"
            description="When a university result sheet is processed, each semester's subjects, GPA and any arrears are listed here."
          />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      {data.timeline.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Arrear timeline"
            subtitle="Every subject once failed, and when it was cleared (if it was)."
            icon={<AlertTriangle />}
            actions={
              <span className="flex items-center gap-2">
                <Badge tone="danger">{data.openArrears} open</Badge>
                <Badge tone="ok">{data.clearedArrears} cleared</Badge>
              </span>
            }
          />
          <PanelBody>
            <ul className="space-y-2">
              {data.timeline.map((entry) => (
                <li
                  key={`${entry.subjectCode}-${entry.semester}`}
                  className={entry.status === 'OPEN' ? 'rounded-md border border-danger/25 bg-danger-soft/40 p-3' : 'rounded-md border border-line bg-surface p-3'}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{entry.subjectName}</span>
                    <span className="tnum text-xs text-subtle">{entry.subjectCode}</span>
                    <Badge tone="neutral">Semester {entry.semester}</Badge>
                    {entry.attempts > 1 ? <Badge tone="warn">{entry.attempts} attempts</Badge> : null}
                    <Badge tone={entry.status === 'OPEN' ? 'danger' : 'ok'}>{entry.status === 'OPEN' ? 'Open' : 'Cleared'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    First failed {new Date(entry.firstAttempt).toLocaleDateString()}
                    {entry.clearedAt ? ` · cleared ${new Date(entry.clearedAt).toLocaleDateString()}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {data.results.map((result) => (
          <Panel key={result.id}>
            <PanelHeader
              title={result.name}
              subtitle={`Declared ${new Date(result.declaredOn).toLocaleDateString()}`}
              icon={<Trophy />}
              actions={
                <span className="flex items-center gap-2">
                  {result.gpa != null ? <Badge tone="brand">GPA {result.gpa.toFixed(2)}</Badge> : null}
                  <Badge tone={result.status === 'PASS' ? 'ok' : result.status === 'PASS_WITH_ARREARS' ? 'warn' : result.status === 'FAIL' ? 'danger' : 'neutral'}>
                    {result.status.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </span>
              }
            />
            <PanelBody>
              <ul className="divide-y divide-line">
                {result.subjects.map((subject) => (
                  <li key={subject.subjectId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{subject.name}</span>
                      <span className="tnum text-xs text-subtle">{subject.code}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-muted">{subject.marks ?? '—'}</span>
                      <Badge tone={subject.status === 'PASS' ? 'ok' : subject.status === 'FAIL' ? 'danger' : 'neutral'}>{subject.grade ?? subject.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function DetailsTab({ profile }: { profile: ProfileData }) {
  const detail = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value ?? <span className="text-subtle">—</span>}</dd>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Personal details" icon={<UserRound />} />
        <PanelBody>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {detail('Email', profile.email)}
            {detail('Phone', profile.phone)}
            {detail('Register number', profile.registerNumber)}
            {detail('Roll number', profile.rollNumber)}
            {detail('Date of birth', profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : null)}
            {detail('Gender', profile.gender === 'UNSPECIFIED' ? null : profile.gender.charAt(0) + profile.gender.slice(1).toLowerCase())}
            {detail('Blood group', profile.bloodGroup)}
            {detail('City', profile.city)}
            <div className="col-span-2">{detail('Address', profile.address)}</div>
          </dl>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Guardian & admission" icon={<UserRound />} />
        <PanelBody>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {detail('Guardian name', profile.guardianName)}
            {detail('Guardian phone', profile.guardianPhone)}
            {detail('Batch', profile.batch)}
            {detail('Admission year', profile.admissionYear)}
            {detail('Department', profile.department.name)}
            {detail('Class', profile.class ? `${profile.class.name} (${profile.class.academicYear})` : null)}
            {detail('Semester', profile.semester)}
            {detail('Resumes in career module', profile.resumeCount)}
          </dl>
        </PanelBody>
      </Panel>

      <Panel className="lg:col-span-2">
        <PanelHeader
          title="Current curriculum"
          subtitle={`${profile.subjects.length} subject(s) for this semester, ${profile.subjects.reduce((a, s) => a + s.weeklyPeriods, 0)} periods a week.`}
          icon={<BookOpen />}
        />
        <PanelBody>
          <div className="flex flex-wrap gap-2">
            {profile.subjects.map((subject) => (
              <span key={subject.id} className="rounded-md border border-line bg-raised px-3 py-2 text-sm">
                <span className="font-medium text-ink">{subject.name}</span>
                <span className="tnum ml-2 text-xs text-subtle">
                  {subject.code} · {subject.weeklyPeriods} wk · {subject.credits} cr
                </span>
              </span>
            ))}
            {profile.subjects.length === 0 ? <p className="text-sm text-muted">No subjects linked to this student's class yet.</p> : null}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Inline edit (same fields as the directory dialog, pre-filled)
// ─────────────────────────────────────────────────────────────────────────

function EditStudentDialog({
  open,
  onOpenChange,
  studentId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  initial: Record<string, unknown>;
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState<Record<string, string | number | null>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const departments = useApi<{ id: string; name: string; code: string }[]>('/api/departments', undefined, { enabled: open });
  const classList = useApi<{ classes: { id: string; name: string; section: string; yearOfStudy: number; departmentId: string }[] }>(
    '/api/classes',
    { departmentId: (values.departmentId as string) || undefined },
    { enabled: open && Boolean(values.departmentId) },
  );

  React.useEffect(() => {
    if (!open) return;
    const base: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(initial)) {
      if (value === undefined) base[key] = '';
      else if (typeof value === 'string' || typeof value === 'number') base[key] = value;
      else if (value === null) base[key] = null;
      else base[key] = String(value);
    }
    setValues(base);
    setErrors({});
    setFormError(null);
  }, [open, initial]);

  const set = (key: string, value: string | number | null) => setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const payload = {
      firstName: String(values.firstName ?? ''),
      lastName: String(values.lastName ?? ''),
      email: String(values.email ?? ''),
      registerNumber: String(values.registerNumber ?? ''),
      departmentId: String(values.departmentId ?? ''),
      classId: (values.classId as string) || null,
      semester: values.semester ? Number(values.semester) : undefined,
      rollNumber: (values.rollNumber as string) || undefined,
      phone: (values.phone as string) || undefined,
      address: (values.address as string) || undefined,
      city: (values.city as string) || undefined,
      guardianName: (values.guardianName as string) || undefined,
      guardianPhone: (values.guardianPhone as string) || undefined,
      bloodGroup: (values.bloodGroup as string) || undefined,
      batch: (values.batch as string) || undefined,
      cgpa: values.cgpa === '' || values.cgpa === null ? null : Number(values.cgpa),
      academicStatus: (values.academicStatus as string) || undefined,
    };
    setErrors({});

    if (!payload.firstName || !payload.lastName || !payload.email || !payload.registerNumber || !payload.departmentId) {
      setFormError('First name, last name, email, register number and department are required.');
      return;
    }

    setBusy(true);
    try {
      await api.patch(`/api/students/${studentId}`, payload);
      toastSuccess('Student updated', 'Changes were saved and logged.');
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save changes.');
      toastError(error, 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit student details" size="lg" description="Changes are written immediately and recorded in the audit log.">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="e-first" required>
              <Input id="e-first" value={String(values.firstName ?? '')} invalid={Boolean(errors.firstName)} onChange={(e) => set('firstName', e.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="e-last" required>
              <Input id="e-last" value={String(values.lastName ?? '')} invalid={Boolean(errors.lastName)} onChange={(e) => set('lastName', e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="e-email" required>
              <Input id="e-email" type="email" value={String(values.email ?? '')} invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="e-phone">
              <Input id="e-phone" type="tel" value={String(values.phone ?? '')} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Register number" htmlFor="e-register" required>
              <Input id="e-register" value={String(values.registerNumber ?? '')} onChange={(e) => set('registerNumber', e.target.value.toUpperCase())} />
            </Field>
            <Field label="Roll number" htmlFor="e-roll">
              <Input id="e-roll" value={String(values.rollNumber ?? '')} onChange={(e) => set('rollNumber', e.target.value)} />
            </Field>
            <Field label="Department" htmlFor="e-dept" required>
              <Select
                id="e-dept"
                value={String(values.departmentId ?? '')}
                onChange={(e) => set('departmentId', e.target.value)}
                options={(departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>
            <Field label="Class" htmlFor="e-class">
              <Select
                id="e-class"
                value={(values.classId as string) ?? ''}
                onChange={(e) => set('classId', e.target.value || null)}
                placeholder="Not assigned"
                options={(classList.data?.data?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.section}` }))}
                disabled={classList.isLoading}
              />
            </Field>
            <Field label="Semester" htmlFor="e-semester">
              <Input id="e-semester" type="number" min={1} max={12} value={values.semester ?? ''} onChange={(e) => set('semester', e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="CGPA" htmlFor="e-cgpa">
              <Input id="e-cgpa" type="number" step="0.01" min={0} max={10} value={values.cgpa ?? ''} onChange={(e) => set('cgpa', e.target.value === '' ? null : Number(e.target.value))} />
            </Field>
            <Field label="City" htmlFor="e-city">
              <Input id="e-city" value={String(values.city ?? '')} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="Guardian name" htmlFor="e-guardian">
              <Input id="e-guardian" value={String(values.guardianName ?? '')} onChange={(e) => set('guardianName', e.target.value)} />
            </Field>
          </div>

          {formError ? (
            <p className="field-error" role="alert">
              {formError}
            </p>
          ) : null}

          <DialogFooter className="-mx-5 -mb-4 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
