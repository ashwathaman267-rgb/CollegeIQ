'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';

import { cn, relativeTime, round } from '@/lib/utils';
import { formatDate, formatTime } from '@/lib/format';
import { useApi } from '@/hooks/use-api';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, BandBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader, StackItem, StatGrid, StatTile } from '@/components/ui/panel';
import { CategoryBars, DistributionDonut, TrendChart, chartColor } from '@/components/ui/charts';
import { DeltaTag, MetricRow, ProgressBar } from '@/components/ui/progress';
import { Avatar } from '@/components/ui/avatar';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, ErrorState, SkeletonTiles } from '@/components/ui/states';

// ─────────────────────────────────────────────────────────────────────────
// Types (mirror src/server/services/dashboard.service.ts)
// ─────────────────────────────────────────────────────────────────────────

interface AttentionItem {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  href: string;
  metric?: string;
}

interface DashboardAction {
  label: string;
  href: string;
  description: string;
  primary?: boolean;
}

interface ScheduleItem {
  slotId: string;
  startTime: string;
  endTime: string;
  subjectName?: string | null;
  subjectCode?: string | null;
  facultyName?: string | null;
  className?: string | null;
  roomCode?: string | null;
  laboratoryName?: string | null;
}

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Dashboard {
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
  greeting: string;
  firstName: string;
  subtitle: string;
  attention: AttentionItem[];
  actions: DashboardAction[];
  stats: Record<string, number | string | null | undefined>;
  today: { day: string; isWorkingDay: boolean; items: ScheduleItem[]; current: ScheduleItem | null };
  subjectAttendance?: { subjectId: string; subjectName: string; subjectCode?: string; percentage: number; present: number; total: number; band: { key: string; label: string } }[];
  monthlyAttendance?: { month: string; label?: string; percentage: number }[];
  subjectPerformance?: { subjectId: string; code: string; name: string; percentage: number }[];
  performanceTrend?: { name: string; percentage: number }[];
  upcomingExams?: { id: string; name: string; subjectName: string; examDate: string; maxMarks: number }[];
  pendingAssessments?: { id: string; name: string; subjectName: string; className: string; entered: number; expected: number; examDate: string }[];
  recentSessions?: { id: string; date: string; subjectName: string; className: string; presentCount: number; totalStudents: number; percentage: number }[];
  atRiskList?: { studentId: string; name: string; registerNumber: string; percentage: number }[];
  charts?: {
    attendanceDistribution: { label: string; count: number }[];
    semesterPassTrend: { label: string; passPercentage: number; arrears: number }[];
    subjectPassRates: { code: string; name: string; passPercentage: number }[];
    topArrearStudents: { studentId: string; name: string; registerNumber: string; openArrears: number }[];
  };
  recentAudit?: { id: string; description: string; action: string; createdAt: string; user: string }[];
  recentStudents?: { id: string; name: string; registerNumber: string; departmentCode: string; createdAt: string }[];
  notifications: NotificationRow[];
  thresholds: { safe: number; fine: number; debar: number };
}

const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

// ─────────────────────────────────────────────────────────────────────────
// Shared blocks
// ─────────────────────────────────────────────────────────────────────────

export function AttentionPanel({ items, className }: { items: AttentionItem[]; className?: string }) {
  return (
    <Panel className={className}>
      <PanelHeader
        title="Needs your attention"
        subtitle={items.length ? `${items.length} item${items.length === 1 ? '' : 's'} to act on` : 'Nothing urgent right now'}
        icon={<BellRing />}
        actions={items.length ? <Badge tone="danger">{items.length}</Badge> : <Badge tone="ok">All clear</Badge>}
      />
      <PanelBody className="py-2">
        {items.length === 0 ? (
          <EmptyState
            compact
            title="Nothing needs attention"
            description="Attendance, marks, results and timetables are all inside the configured limits."
            icon={<ClipboardCheck />}
          />
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((item) => (
              <li key={item.id}>
                <StackItem
                  href={item.href}
                  tone={item.severity === 'high' ? 'danger' : item.severity === 'medium' ? 'warn' : 'info'}
                  title={
                    <span className="flex items-center gap-2">
                      {item.severity === 'high' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden /> : null}
                      {item.title}
                    </span>
                  }
                  detail={item.detail}
                  metric={item.metric}
                />
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}

export function QuickActions({ actions }: { actions: DashboardAction[] }) {
  return (
    <Panel>
      <PanelHeader title="What you can do here" icon={<Target />} />
      <PanelBody className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.href + action.label}
            href={action.href}
            className={cn(
              'group flex items-start gap-3 rounded-md border px-3 py-2.5 transition-all duration-150',
              action.primary
                ? 'border-brand/30 bg-brand-soft hover:border-brand/60'
                : 'border-line bg-surface hover:border-line-strong hover:bg-raised',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink">
                {action.label}
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{action.description}</span>
            </span>
          </Link>
        ))}
      </PanelBody>
    </Panel>
  );
}

export function TodayPanel({ today, role }: { today: Dashboard['today']; role: Dashboard['role'] }) {
  return (
    <Panel>
      <PanelHeader
        title="Today’s schedule"
        subtitle={today.isWorkingDay ? `${formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })} · ${today.items.length} period${today.items.length === 1 ? '' : 's'}` : `${today.day.toLowerCase()} is not a working day`}
        icon={<CalendarClock />}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/timetable">
              Timetable
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />
      <PanelBody className="py-2">
        {!today.isWorkingDay ? (
          <EmptyState compact title="No classes scheduled" description="Enjoy the break — your next working day is shown in the timetable." icon={<CalendarDays />} />
        ) : today.items.length === 0 ? (
          <EmptyState compact title="Nothing scheduled today" description="No timetable has been published for today yet." icon={<CalendarDays />} />
        ) : (
          <ol className="space-y-1">
            {today.items.map((item) => {
              const live = today.current?.slotId === item.slotId;
              return (
                <li
                  key={item.slotId}
                  className={cn(
                    'flex items-center gap-3 rounded-md border px-3 py-2 transition-colors',
                    live ? 'border-brand/40 bg-brand-soft' : 'border-transparent hover:bg-raised',
                  )}
                >
                  <span className="tnum w-24 shrink-0 text-xs font-semibold text-muted">
                    {formatTime(item.startTime)}
                    <span className="mx-1 text-subtle">–</span>
                    {formatTime(item.endTime)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[0.8125rem] font-medium text-ink">{item.subjectName ?? 'Free period'}</span>
                      {live ? <Badge tone="brand">Now</Badge> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {[role === 'FACULTY' ? item.className : item.facultyName, item.laboratoryName ?? item.roomCode].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </PanelBody>
    </Panel>
  );
}

function NotificationsPanel({ notifications }: { notifications: NotificationRow[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Recent notifications"
        icon={<BellRing />}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/notifications">View all</Link>
          </Button>
        }
      />
      <PanelBody className="py-2">
        {notifications.length === 0 ? (
          <EmptyState compact title="No notifications yet" description="Alerts about attendance, results and timetables appear here." icon={<BellRing />} />
        ) : (
          <ul className="divide-y divide-line/70">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  href={notification.link ?? '/notifications'}
                  className="stack-item block rounded-r-md py-2.5 pr-2 transition-colors hover:bg-raised/60 before:bg-line-strong"
                >
                  <p className="truncate text-[0.8125rem] font-medium text-ink">{notification.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{notification.message}</p>
                  <p className="mt-1 text-2xs text-subtle">{relativeTime(notification.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Role views
// ─────────────────────────────────────────────────────────────────────────

function StudentView({ data }: { data: Dashboard }) {
  const stats = data.stats;
  const thresholds = data.thresholds;

  return (
    <>
      <StatGrid>
        <StatTile
          label="Overall attendance"
          value={`${num(stats.attendancePercentage).toFixed(1)}%`}
          tone={num(stats.attendancePercentage) >= thresholds.safe ? 'ok' : num(stats.attendancePercentage) >= thresholds.fine ? 'warn' : 'danger'}
          delta={typeof stats.attendanceDelta === 'number' ? stats.attendanceDelta : null}
          hint={
            <span className="flex items-center gap-1.5">
              <BandBadge band={String(stats.attendanceBand ?? 'NO_DATA')} />
              <span className="tnum">
                {num(stats.classesAttended)}/{num(stats.totalClasses)} classes
              </span>
            </span>
          }
          icon={<ClipboardCheck />}
          href="/attendance"
        />
        <StatTile
          label="Internal assessment"
          value={`${num(stats.iaAverage).toFixed(1)}%`}
          tone={num(stats.iaAverage) >= 60 ? 'ok' : num(stats.iaAverage) >= 40 ? 'warn' : 'danger'}
          hint={stats.classRank ? `Rank ${stats.classRank} of ${num(stats.classSize)}` : 'No marks published yet'}
          icon={<FileSpreadsheet />}
          href="/academics"
        />
        <StatTile
          label="Open arrears"
          value={num(stats.openArrears)}
          tone={num(stats.openArrears) === 0 ? 'ok' : 'danger'}
          hint={`CGPA ${stats.cgpa ? num(stats.cgpa).toFixed(2) : '—'} · ${num(stats.clearedArrears)} cleared`}
          icon={<Trophy />}
          href="/results"
        />
        <StatTile
          label="Best resume match"
          value={stats.bestMatchScore === null || stats.bestMatchScore === undefined ? '—' : `${num(stats.bestMatchScore).toFixed(0)}%`}
          tone="brand"
          hint={`${num(stats.skillGaps)} open skill gap${num(stats.skillGaps) === 1 ? '' : 's'}`}
          icon={<Sparkles />}
          href="/career"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Attendance by subject"
              subtitle={`Safe range starts at ${thresholds.safe}%; debar line is ${thresholds.debar}%`}
              icon={<ClipboardCheck />}
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/attendance">Details</Link>
                </Button>
              }
            />
            <PanelBody className="py-3">
              {!data.subjectAttendance?.length ? (
                <EmptyState compact title="No attendance recorded yet" description="Once your faculty marks a session, subject-wise percentages appear here." />
              ) : (
                <div className="space-y-0.5">
                  {data.subjectAttendance.map((subject) => (
                    <MetricRow
                      key={subject.subjectId}
                      label={`${subject.subjectCode ? `${subject.subjectCode} · ` : ''}${subject.subjectName}`}
                      value={subject.percentage}
                      tone={subject.percentage >= thresholds.safe ? 'ok' : subject.percentage >= thresholds.fine ? 'warn' : subject.percentage >= thresholds.debar ? 'info' : 'danger'}
                      threshold={thresholds.safe}
                      sublabel={`${subject.present} of ${subject.total} classes attended`}
                      trailing={<BandBadge band={subject.band.key} label={subject.band.label} />}
                    />
                  ))}
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Monthly attendance trend" subtitle="Percentage of classes attended per month" icon={<TrendingUp />} />
            <PanelBody>
              <TrendChart
                data={(data.monthlyAttendance ?? []).map((m) => ({ label: m.label ?? m.month, percentage: m.percentage }))}
                xKey="label"
                series={[{ key: 'percentage', label: 'Attendance' }]}
                suffix="%"
                area
                height={220}
                yDomain={[0, 100]}
                emptyMessage="Attendance months appear after your first recorded session."
              />
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-4">
          <TodayPanel today={data.today} role="STUDENT" />

          {data.upcomingExams && data.upcomingExams.length > 0 ? (
            <Panel>
              <PanelHeader title="Upcoming assessments" icon={<CalendarDays />} />
              <PanelBody className="py-2">
                <ul className="divide-y divide-line/70">
                  {data.upcomingExams.map((exam) => (
                    <li key={exam.id} className="stack-item flex items-center gap-3 py-2.5 pr-2 before:bg-info">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-medium text-ink">
                          {exam.name} · {exam.subjectName}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(exam.examDate, { weekday: 'short', day: 'numeric', month: 'short' })} · out of {exam.maxMarks}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </PanelBody>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader title="Academic performance" subtitle="Internal assessment average by subject" icon={<GraduationCap />} />
            <PanelBody className="py-3">
              {!data.subjectPerformance?.length ? (
                <EmptyState compact title="No internal marks yet" description="Your IA averages appear here once faculty publish marks." />
              ) : (
                <div className="space-y-0.5">
                  {data.subjectPerformance.map((subject) => (
                    <MetricRow
                      key={subject.subjectId}
                      label={`${subject.code} · ${subject.name}`}
                      value={subject.percentage}
                      tone={subject.percentage >= 60 ? 'ok' : subject.percentage >= 40 ? 'warn' : 'danger'}
                      sublabel="Average across internal assessments"
                    />
                  ))}
                </div>
              )}
            </PanelBody>
          </Panel>

          <NotificationsPanel notifications={data.notifications} />
        </div>
      </div>
    </>
  );
}

function FacultyView({ data }: { data: Dashboard }) {
  const stats = data.stats;
  const thresholds = data.thresholds;

  const sessionColumns: Column<NonNullable<Dashboard['recentSessions']>[number]>[] = [
    {
      key: 'date',
      header: 'Session',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.subjectName}</p>
          <p className="text-xs text-muted">
            {formatDate(row.date, { day: '2-digit', month: 'short' })} · {row.className}
          </p>
        </div>
      ),
    },
    {
      key: 'percentage',
      header: 'Attendance',
      align: 'right',
      label: 'Attendance',
      cell: (row) => (
        <span className="flex items-center justify-end gap-2">
          <ProgressBar value={row.percentage} tone={row.percentage >= thresholds.safe ? 'ok' : row.percentage >= thresholds.fine ? 'warn' : 'danger'} size="sm" className="w-16" />
          <span className="tnum w-11 text-right text-sm font-semibold text-ink">{row.percentage.toFixed(0)}%</span>
        </span>
      ),
    },
    {
      key: 'counts',
      header: 'Present',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <span className="tnum text-sm text-muted">
          {row.presentCount}/{row.totalStudents}
        </span>
      ),
    },
  ];

  return (
    <>
      <StatGrid columns={5}>
        <StatTile label="Today’s periods" value={num(stats.todayPeriods)} tone="brand" hint={data.today.isWorkingDay ? 'From your published timetable' : 'Not a working day'} icon={<CalendarDays />} href="/timetable" />
        <StatTile label="Classes taught" value={num(stats.classes)} hint={`${num(stats.subjects)} subject${num(stats.subjects) === 1 ? '' : 's'} · ${num(stats.students)} students`} icon={<Users />} href="/students" />
        <StatTile
          label="Class attendance"
          value={`${num(stats.classAttendance).toFixed(1)}%`}
          tone={num(stats.classAttendance) >= thresholds.safe ? 'ok' : 'warn'}
          hint={<BandBadge band={String(stats.attendanceBand ?? 'NO_DATA')} />}
          icon={<ClipboardCheck />}
          href="/attendance"
        />
        <StatTile label="Marks pending" value={num(stats.pendingAssessments)} tone={num(stats.pendingAssessments) > 0 ? 'warn' : 'ok'} hint="Assessments awaiting entry" icon={<FileSpreadsheet />} href="/academics" />
        <StatTile label="Students at risk" value={num(stats.atRiskStudents)} tone={num(stats.atRiskStudents) > 0 ? 'danger' : 'ok'} hint={`Below ${thresholds.safe}% attendance`} icon={<TrendingDown />} href="/students" />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <TodayPanel today={data.today} role="FACULTY" />

          <Panel>
            <PanelHeader title="Assessments awaiting marks" subtitle="Fastest path to a complete gradebook" icon={<FileSpreadsheet />} />
            <PanelBody className="py-2">
              {!data.pendingAssessments?.length ? (
                <EmptyState compact title="Every assessment is complete" description="No internal marks are outstanding for your subjects." icon={<ClipboardCheck />} />
              ) : (
                <ul className="divide-y divide-line/70">
                  {data.pendingAssessments.map((exam) => (
                    <li key={exam.id}>
                      <Link href={`/academics?exam=${exam.id}`} className="stack-item flex items-center gap-3 rounded-r-md py-2.5 pr-2 transition-colors hover:bg-raised/60 before:bg-warn">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.8125rem] font-medium text-ink">
                            {exam.name} · {exam.subjectName}
                          </p>
                          <p className="text-xs text-muted">
                            {exam.className} · {formatDate(exam.examDate, { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <span className="tnum shrink-0 text-xs font-semibold text-warn-fg">
                          {exam.entered}/{exam.expected}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Recently taken sessions" icon={<ClipboardCheck />} />
            <DataTable
              columns={sessionColumns}
              rows={data.recentSessions ?? []}
              rowKey={(row) => row.id}
              dense
              empty={{ title: 'No sessions recorded yet', description: 'Take attendance from the Attendance screen and your recent sessions will be listed here.' }}
            />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Students below the safe range" subtitle={`Under ${thresholds.safe}% attendance in your classes`} icon={<AlertTriangle />} />
            <PanelBody className="py-2">
              {!data.atRiskList?.length ? (
                <EmptyState compact title="No at-risk students" description="Everyone in your classes is above the safe attendance threshold." />
              ) : (
                <ul className="divide-y divide-line/70">
                  {data.atRiskList.map((student) => (
                    <li key={student.studentId}>
                      <Link href={`/students/${student.studentId}`} className="flex items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-raised/60">
                        <Avatar name={student.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] font-medium text-ink">{student.name}</span>
                          <span className="block truncate text-xs text-muted">{student.registerNumber}</span>
                        </span>
                        <span className="tnum shrink-0 text-sm font-semibold text-danger-fg">{student.percentage.toFixed(0)}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <NotificationsPanel notifications={data.notifications} />
        </div>
      </div>
    </>
  );
}

function AdminView({ data }: { data: Dashboard }) {
  const stats = data.stats;
  const charts = data.charts;

  return (
    <>
      <StatGrid columns={5}>
        <StatTile label="Students" value={num(stats.students)} hint={`${num(stats.departments)} departments · ${num(stats.classes)} classes`} icon={<Users />} href="/students" />
        <StatTile label="Faculty" value={num(stats.faculty)} hint={`${num(stats.subjects)} subjects in catalogue`} icon={<GraduationCap />} href="/faculty" />
        <StatTile
          label="Average attendance"
          value={`${num(stats.averageAttendance).toFixed(1)}%`}
          tone={num(stats.averageAttendance) >= data.thresholds.safe ? 'ok' : 'warn'}
          hint={<BandBadge band={String(stats.attendanceBand ?? 'NO_DATA')} />}
          icon={<ClipboardCheck />}
          href="/analytics"
        />
        <StatTile label="Pass percentage" value={`${num(stats.passPercentage).toFixed(1)}%`} tone={num(stats.passPercentage) >= 70 ? 'ok' : 'warn'} hint={`${num(stats.openArrears)} open arrears`} icon={<Trophy />} href="/results" />
        <StatTile
          label="Timetable conflicts"
          value={num(stats.timetableConflicts)}
          tone={num(stats.timetableErrors) > 0 ? 'danger' : num(stats.timetableConflicts) > 0 ? 'warn' : 'ok'}
          hint={`${num(stats.timetableErrors)} hard · ${num(stats.timetableConflicts) - num(stats.timetableErrors)} warnings`}
          icon={<CalendarDays />}
          href="/timetable"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Attendance distribution" subtitle={`Institution-wide, against the configured ${data.thresholds.safe}% safe line`} icon={<ClipboardCheck />} />
            <PanelBody>
              {charts?.attendanceDistribution?.length ? (
                <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                  <DistributionDonut
                    data={charts.attendanceDistribution.map((slice, index) => ({
                      label: slice.label,
                      value: slice.count,
                      color: [chartColor(2), chartColor(3), chartColor(1), chartColor(0)][index] ?? chartColor(index),
                    }))}
                    height={210}
                    centerValue={num(stats.trackedStudents)}
                    centerLabel="Students"
                  />
                  <div className="space-y-0.5">
                    {charts.attendanceDistribution.map((slice, index) => (
                      <MetricRow
                        key={slice.label}
                        label={slice.label}
                        value={slice.count}
                        max={Math.max(1, num(stats.trackedStudents))}
                        tone={(['ok', 'warn', 'info', 'danger'] as const)[index] ?? 'neutral'}
                        suffix=""
                        sublabel={`${round((slice.count / Math.max(1, num(stats.trackedStudents))) * 100, 1)}% of tracked students`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState compact title="No attendance data yet" description="Distribution appears once sessions are recorded." />
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Pass percentage by semester" subtitle="From processed university results" icon={<Trophy />} />
            <PanelBody>
              <TrendChart
                data={(charts?.semesterPassTrend ?? []).map((row) => ({ label: row.label, passPercentage: row.passPercentage, arrears: row.arrears }))}
                xKey="label"
                series={[
                  { key: 'passPercentage', label: 'Pass %' },
                  { key: 'arrears', label: 'Arrears' },
                ]}
                suffix=""
                height={230}
                emptyMessage="Process a university result sheet to see semester trends."
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Hardest subjects" subtitle="Lowest pass percentage across all result sets" icon={<AlertTriangle />} />
            <PanelBody>
              <CategoryBars
                data={(charts?.subjectPassRates ?? []).map((row) => ({ label: row.code || row.name, name: row.name, passPercentage: row.passPercentage }))}
                xKey="label"
                yKey="passPercentage"
                horizontal
                height={Math.max(180, (charts?.subjectPassRates.length ?? 0) * 34)}
                suffix="%"
                label="Pass %"
                color={(row) => (num(row.passPercentage) >= 75 ? 'rgb(var(--ok))' : num(row.passPercentage) >= 50 ? 'rgb(var(--warn))' : 'rgb(var(--danger))')}
                emptyMessage="No subject-level result data yet."
              />
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Students with open arrears" icon={<TrendingDown />} />
            <PanelBody className="py-2">
              {!charts?.topArrearStudents?.length ? (
                <EmptyState compact title="No open arrears" description="Every recorded arrear has been cleared." />
              ) : (
                <ul className="divide-y divide-line/70">
                  {charts.topArrearStudents.map((student) => (
                    <li key={student.registerNumber}>
                      <Link href={`/students/${student.studentId}`} className="flex items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-raised/60">
                        <Avatar name={student.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] font-medium text-ink">{student.name}</span>
                          <span className="block truncate text-xs text-muted">{student.registerNumber}</span>
                        </span>
                        <Badge tone="danger">{student.openArrears} open</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Recent activity" subtitle="From the audit log" icon={<ClipboardCheck />} />
            <PanelBody className="py-2">
              {!data.recentAudit?.length ? (
                <EmptyState compact title="No activity recorded yet" />
              ) : (
                <ul className="divide-y divide-line/70">
                  {data.recentAudit.map((entry) => (
                    <li key={entry.id} className="stack-item py-2.5 pr-2 before:bg-line-strong">
                      <p className="line-clamp-2 text-[0.8125rem] text-ink">{entry.description}</p>
                      <p className="mt-0.5 text-2xs text-subtle">
                        {entry.user} · {relativeTime(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <NotificationsPanel notifications={data.notifications} />
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────

export function DashboardView() {
  const query = useApi<Dashboard>('/api/dashboard', undefined, { staleTime: 15_000 });
  const data = query.data?.data;

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="skeleton h-6 w-56" />
          <div className="skeleton h-3 w-80" />
        </div>
        <SkeletonTiles count={4} />
        <div className="skeleton h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (query.isError || !data) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} title="Could not load your dashboard" />;
  }

  return (
    <>
      <PageHeader
        title={`${data.greeting}, ${data.firstName}`}
        description={data.subtitle}
        meta={
          <>
            <Badge tone="brand">{data.role === 'ADMIN' ? 'Administrator' : data.role === 'FACULTY' ? 'Faculty' : 'Student'}</Badge>
            <span className="text-xs text-muted">
              Safe attendance ≥ {data.thresholds.safe}% · debar &lt; {data.thresholds.debar}%
            </span>
          </>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {data.attention.length > 0 ? <AttentionPanel items={data.attention} /> : null}

      <QuickActions actions={data.actions} />

      {data.role === 'STUDENT' ? <StudentView data={data} /> : data.role === 'FACULTY' ? <FacultyView data={data} /> : <AdminView data={data} />}
    </>
  );
}
