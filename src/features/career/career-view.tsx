'use client';

import * as React from 'react';
import Link from 'next/link';
import { Briefcase, FileText, ShieldAlert, Sparkles, Target } from 'lucide-react';

import { formatDate } from '@/lib/format';
import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { ProgressBar, ScoreDial } from '@/components/ui/progress';
import { Tabs } from '@/components/ui/dropdown';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/states';
import { ResumeManager } from './resume-manager';
import { JobManager } from './job-manager';
import { SkillGapBoard } from './skill-gaps';
import { MatchDialog } from './match-dialog';
import type { GapBoard, JobSummary, MatchSummary, ResumeSummary } from './types';
import { VERDICT_LABEL, VERDICT_TONE, scoreTone } from './types';

type Tab = 'resumes' | 'jobs' | 'analyses' | 'gaps';

/**
 * Career module home: resume library, job descriptions, past analyses and the
 * merged skill-gap plan.
 */
export function CareerView() {
  const { user, ai } = useSession();
  const [tab, setTab] = React.useState<Tab>('resumes');
  const [matchOpen, setMatchOpen] = React.useState(false);
  const [presetResume, setPresetResume] = React.useState<string | null>(null);
  const [presetJob, setPresetJob] = React.useState<string | null>(null);

  const isStudent = user?.role === 'STUDENT';

  const resumes = useApi<ResumeSummary[]>('/api/resumes', undefined, { enabled: isStudent });
  const jobs = useApi<JobSummary[]>('/api/jobs', { pageSize: 50 }, { enabled: isStudent });
  const analyses = useApi<{ matches: MatchSummary[]; gaps: GapBoard }>('/api/ai/matches', undefined, { enabled: isStudent });

  if (!user) return null;

  if (!isStudent) {
    return (
      <>
        <PageHeader
          title="Career"
          description="Resume-to-job alignment and skill gap planning for students."
          icon={<Sparkles />}
        />
        <Alert tone="warning" title="Student workspace" icon={<ShieldAlert />}>
          Resume uploads, job descriptions and match analyses belong to a student account. Placement officers can review a
          student&apos;s analysis from their profile, and administrators can change the AI provider under Settings.
        </Alert>
      </>
    );
  }

  const resumeRows = resumes.data?.data ?? [];
  const jobRows = jobs.data?.data ?? [];
  const matches = analyses.data?.data?.matches ?? [];
  const gaps = analyses.data?.data?.gaps;

  const latest = matches[0];
  const best = matches.length ? matches.reduce((a, b) => (b.score > a.score ? b : a)) : null;

  const openMatch = (resumeId?: string | null, jobId?: string | null) => {
    setPresetResume(resumeId ?? null);
    setPresetJob(jobId ?? null);
    setMatchOpen(true);
  };

  const columns: Column<MatchSummary>[] = [
    {
      key: 'job',
      header: 'Role',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.jobTitle}</p>
          <p className="truncate text-xs text-muted">
            {row.company ? `${row.company} · ` : ''}
            {row.resumeTitle}
          </p>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Alignment',
      label: 'Alignment',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <ProgressBar value={row.score} size="sm" tone={scoreTone(row.score)} className="w-16" />
          <span className="tnum w-10 text-right text-sm font-semibold text-ink">{row.score}%</span>
        </span>
      ),
    },
    {
      key: 'verdict',
      header: 'Verdict',
      label: 'Verdict',
      hideOnMobile: true,
      cell: (row) => <Badge tone={VERDICT_TONE[row.verdict] ?? 'neutral'}>{VERDICT_LABEL[row.verdict] ?? row.verdict}</Badge>,
    },
    {
      key: 'provider',
      header: 'Engine',
      label: 'Engine',
      hideOnMobile: true,
      cell: (row) => <span className="text-xs text-muted">{row.provider.toLowerCase()}</span>,
    },
    {
      key: 'date',
      header: 'Analysed',
      label: 'Analysed',
      hideOnMobile: true,
      cell: (row) => <span className="text-xs text-muted">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'open',
      header: <span className="sr-only">Open</span>,
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <Button size="xs" variant="ghost" asChild>
          <Link href={`/career/matches/${row.id}`}>Open report</Link>
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Career readiness"
        description="Upload your resume, save the roles you are targeting, and see exactly which requirements you already meet and which ones to work on next."
        icon={<Sparkles />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Career' }]}
        meta={
          <>
            <Badge tone={ai?.live ? 'brand' : 'neutral'} icon={<Sparkles />}>
              {ai?.label ?? 'AI engine'}
            </Badge>
            {!ai?.live ? <span className="text-xs text-subtle">Running on the built-in engine — no API key needed</span> : null}
          </>
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => openMatch()} disabled={resumeRows.length === 0 || jobRows.length === 0}>
            <Sparkles className="h-4 w-4" aria-hidden />
            New analysis
          </Button>
        }
      >
        {resumeRows.length === 0 || jobRows.length === 0 ? (
          <Alert tone="info" title="Two inputs, one report">
            An analysis needs a resume and a job description.{' '}
            {resumeRows.length === 0 ? 'Add a resume first. ' : ''}
            {jobRows.length === 0 ? 'Then save at least one job description.' : ''}
          </Alert>
        ) : null}
      </PageHeader>

      <div className="mt-5 space-y-5">
        <StatGrid columns={4}>
          <StatTile label="Resumes" value={resumeRows.length} hint={resumeRows.find((r) => r.isPrimary)?.title ?? 'No primary set'} icon={<FileText />} loading={resumes.isLoading} />
          <StatTile label="Saved roles" value={jobRows.length} hint="Job descriptions you can re-analyse" icon={<Briefcase />} loading={jobs.isLoading} />
          <StatTile
            label="Latest alignment"
            value={latest ? `${latest.score}%` : '—'}
            hint={latest ? `${latest.jobTitle} · ${formatDate(latest.createdAt)}` : 'Run your first analysis'}
            tone={latest ? scoreTone(latest.score) : 'neutral'}
            icon={<Sparkles />}
            loading={analyses.isLoading}
          />
          <StatTile
            label="Open skill gaps"
            value={gaps?.open ?? 0}
            hint={gaps?.closed ? `${gaps.closed} covered so far` : 'Nothing closed yet'}
            tone={(gaps?.open ?? 0) > 4 ? 'danger' : 'warn'}
            icon={<Target />}
            loading={analyses.isLoading}
          />
        </StatGrid>

        {best ? (
          <Panel>
            <PanelBody className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <ScoreDial value={best.score} label="Best match" tone={scoreTone(best.score)} size={124} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  Your strongest alignment so far: {best.jobTitle}
                  {best.company ? ` at ${best.company}` : ''} — {best.score}%
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
                  {VERDICT_LABEL[best.verdict] ?? best.verdict}. Alignment is measured against the wording of that one job
                  description; it says nothing about how many other people applied or how an interview will go.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/career/matches/${best.id}`}>Open report</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openMatch(best.resumeId, null)}>
                    Re-run against another role
                  </Button>
                </div>
              </div>
            </PanelBody>
          </Panel>
        ) : null}

        <Tabs
          ariaLabel="Career sections"
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          items={[
            { value: 'resumes', label: 'Resumes', count: resumeRows.length, icon: <FileText /> },
            { value: 'jobs', label: 'Job descriptions', icon: <Briefcase /> },
            { value: 'analyses', label: 'Analyses', count: matches.length, icon: <Sparkles /> },
            { value: 'gaps', label: 'Skill gaps', count: gaps?.open ?? 0, icon: <Target /> },
          ]}
        />

        {tab === 'resumes' ? <ResumeManager onMatchWith={(resumeId) => openMatch(resumeId, null)} /> : null}
        {tab === 'jobs' ? <JobManager onMatch={(jobId) => openMatch(null, jobId)} /> : null}

        {tab === 'analyses' ? (
          <Panel>
            <PanelHeader
              title="Analysis history"
              subtitle="Every run is kept so you can compare yourself against several roles and watch the gaps shrink."
              icon={<Sparkles />}
              actions={
                <Button size="sm" variant="primary" onClick={() => openMatch()} disabled={resumeRows.length === 0 || jobRows.length === 0}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  New analysis
                </Button>
              }
            />
            <PanelBody>
              <DataTable
                columns={columns}
                rows={matches}
                rowKey={(row) => row.id}
                loading={analyses.isLoading}
                error={analyses.error}
                onRetry={() => analyses.refetch()}
                rowHref={(row) => `/career/matches/${row.id}`}
                caption="Resume to job description alignment analyses"
                empty={{
                  title: 'No analyses yet',
                  description: 'Pick one of your resumes and one saved job description to get a scored alignment report with matched skills, missing skills and evidence.',
                  icon: <Sparkles />,
                }}
              />
            </PanelBody>
          </Panel>
        ) : null}

        {tab === 'gaps' ? (
          <>
            {matches.length === 0 ? (
              <Panel>
                <PanelBody>
                  <EmptyState
                    icon={<Target />}
                    title="Your skill plan appears after the first analysis"
                    description="Each missing skill from an analysis becomes a tracked item here, with a recommended next step and a status you control."
                    action={
                      <Button variant="primary" size="sm" onClick={() => openMatch()} disabled={resumeRows.length === 0 || jobRows.length === 0}>
                        Run an analysis
                      </Button>
                    }
                  />
                </PanelBody>
              </Panel>
            ) : (
              <SkillGapBoard board={gaps} loading={analyses.isLoading} />
            )}
          </>
        ) : null}
      </div>

      <MatchDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        resumes={resumeRows}
        jobs={jobRows}
        defaultResumeId={presetResume}
        defaultJobId={presetJob}
      />
    </>
  );
}
