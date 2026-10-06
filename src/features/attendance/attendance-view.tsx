'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, CalendarCheck, ClipboardCheck, History } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Tabs } from '@/components/ui/dropdown';
import { useSession } from '@/hooks/use-session';
import { StudentAttendance } from './student-attendance';
import { AttendanceMarking, SessionsBrowser } from './marking';
import { AttendanceAnalytics } from './analytics';

type Tab = 'mark' | 'sessions' | 'analytics';

/**
 * One attendance screen for three roles.
 * Students see their own record; faculty get marking, history and analytics;
 * administrators see the same tools institution-wide.
 */
export function AttendanceView() {
  const { user, thresholds } = useSession();
  const searchParams = useSearchParams();
  const initial = (searchParams.get('tab') as Tab) ?? (user?.role === 'STUDENT' ? 'analytics' : 'mark');
  const [tab, setTab] = React.useState<Tab>(initial === 'sessions' || initial === 'analytics' ? initial : 'mark');

  if (!user) return null;

  if (user.role === 'STUDENT') {
    return (
      <>
        <PageHeader
          title="My attendance"
          description="Overall, subject-wise and month-wise attendance with your current risk status, plus the classes you still need to reach the safe range."
          icon={<ClipboardCheck />}
          meta={
            thresholds ? (
              <span className="text-xs text-muted">
                Institutional limits: safe ≥ {thresholds.safe}% · fine &lt; {thresholds.fine}% · debar &lt; {thresholds.debar}%
              </span>
            ) : null
          }
        />
        <StudentAttendance studentId={user.studentId} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description={
          user.role === 'ADMIN'
            ? 'Institution-wide attendance: mark sessions for any class, review recorded history and analyse risk against the configured thresholds.'
            : 'Mark attendance for your classes in a few taps, review recorded sessions and analyse subject-wise and monthly trends.'
        }
        icon={<ClipboardCheck />}
        meta={
          thresholds ? (
            <span className="text-xs text-muted">
              Safe ≥ {thresholds.safe}% · at risk &lt; {thresholds.safe}% · fine &lt; {thresholds.fine}% · debar &lt; {thresholds.debar}%
            </span>
          ) : null
        }
      />

      <Tabs
        ariaLabel="Attendance sections"
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        items={[
          { value: 'mark', label: 'Mark attendance', icon: <CalendarCheck className="h-3.5 w-3.5" /> },
          { value: 'sessions', label: 'Recorded sessions', icon: <History className="h-3.5 w-3.5" /> },
          { value: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'mark' ? <AttendanceMarking /> : tab === 'sessions' ? <SessionsBrowser /> : <AttendanceAnalytics />}
    </>
  );
}
