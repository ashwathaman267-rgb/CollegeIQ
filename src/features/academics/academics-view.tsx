'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, ClipboardList, Users } from 'lucide-react';

import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Field, Select } from '@/components/ui/form';
import { Panel, PanelBody } from '@/components/ui/panel';
import { Tabs } from '@/components/ui/dropdown';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { StudentAcademics } from './student-academics';
import { ClassPerformance } from './class-performance';
import { MarksEntry } from './marks-entry';

interface ClassOption {
  id: string;
  name: string;
  departmentName: string;
  studentCount: number;
  semester: number;
  subjects: { id: string; code: string; name: string }[];
}

type Tab = 'performance' | 'marks';

/**
 * Academics: internal assessment entry and class performance analysis for
 * faculty and administrators, and a personal marks view for students.
 */
export function AcademicsView() {
  const { user, academic } = useSession();
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<Tab>(searchParams.get('exam') ? 'marks' : 'performance');
  const [classId, setClassId] = React.useState('');

  const classes = useApi<{ classes: ClassOption[] }>('/api/classes', undefined, { enabled: user?.role !== 'STUDENT' });
  const classOptions = classes.data?.data?.classes ?? [];

  React.useEffect(() => {
    if (!classId && classOptions.length) setClassId(classOptions[0].id);
  }, [classOptions, classId]);

  if (!user) return null;

  if (user.role === 'STUDENT') {
    return (
      <>
        <PageHeader
          title="My academics"
          description="Internal assessment marks by subject, your class rank and how you are trending between assessments."
          icon={<BookOpen />}
          meta={academic ? <span className="text-xs text-muted">Semester {academic.semester} · pass mark {academic.passMarkPercentage}%</span> : null}
        />
        <StudentAcademics studentId={user.studentId} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Academics"
        description={
          user.role === 'ADMIN'
            ? 'Internal assessment performance across classes: averages, trends, cohorts that need attention and full marks entry.'
            : 'Enter internal assessment marks for your classes and analyse how each cohort is performing.'
        }
        icon={<BookOpen />}
        meta={academic ? <span className="text-xs text-muted">Semester {academic.semester} · {academic.iaExamCount} internal assessments · pass mark {academic.passMarkPercentage}%</span> : null}
      />

      <Tabs
        ariaLabel="Academics sections"
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        items={[
          { value: 'performance', label: 'Class performance', icon: <Users className="h-3.5 w-3.5" /> },
          { value: 'marks', label: 'Marks entry', icon: <ClipboardList className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'marks' ? (
        <MarksEntry classId={classId} onClassChange={setClassId} classes={classOptions} />
      ) : classes.isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : classOptions.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No classes yet"
          description="Create a class and assign subjects before analysing internal assessment performance."
        />
      ) : (
        <>
          <Panel>
            <PanelBody className="flex flex-wrap items-end gap-3">
              <Field label="Class" className="min-w-[16rem] flex-1">
                <Select
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  placeholder="Select a class"
                  options={classOptions.map((c) => ({ value: c.id, label: `${c.departmentName} · ${c.name} (${c.studentCount} students)` }))}
                />
              </Field>
              <p className="pb-2 text-xs text-muted">
                {classOptions.find((c) => c.id === classId)?.subjects.length ?? 0} subject(s) assigned · semester{' '}
                {classOptions.find((c) => c.id === classId)?.semester ?? '—'}
              </p>
            </PanelBody>
          </Panel>
          <ClassPerformance classId={classId} />
        </>
      )}
    </>
  );
}
