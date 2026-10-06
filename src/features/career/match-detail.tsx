'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileText,
  Lightbulb,
  Loader2,
  MinusCircle,
  Quote,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { AlignmentNotice } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { MetricRow, ScoreDial } from '@/components/ui/progress';
import { ErrorState, SkeletonRows, SkeletonTiles } from '@/components/ui/states';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import type { MatchResult, Recommendation, ScoreBreakdown, SkillHit } from '@/lib/ai/types';
import { GAP_STATUS_LABEL, JOB_TYPE_LABEL, SKILL_CATEGORY_LABEL, VERDICT_LABEL, VERDICT_TONE, scoreTone, severityTone } from './types';

interface MatchDetailData {
  id: string;
  score: number;
  verdict: string;
  provider: string;
  model: string | null;
  createdAt: string;
  disclaimer: string;
  matchedSkills: SkillHit[];
  missingSkills: SkillHit[];
  partialSkills: SkillHit[];
  breakdown: ScoreBreakdown[];
  evidence: MatchResult['evidence'];
  recommendations: Recommendation[];
  summary: string;
  resume: { id: string; title: string; studentId: string };
  job: { id: string; title: string; company: string | null; location: string | null; jobType: string; description: string };
  skillGaps: { id: string; skillName: string; severity: string; category: string | null; recommendation: string | null; status: string }[];
}

const PRIORITY_TONE = { HIGH: 'danger', MEDIUM: 'warn', LOW: 'info' } as const;

/** Full alignment report for one resume × job description pair. */
export function MatchDetail({ matchId }: { matchId: string }) {
  const router = useRouter();
  const invalidate = useInvalidate();
  const { ai } = useSession();
  const match = useApi<MatchDetailData>(`/api/ai/matches/${matchId}`);
  const [deleting, setDeleting] = React.useState(false);
  const [gapPending, setGapPending] = React.useState<string | null>(null);
  const [jobOpen, setJobOpen] = React.useState(false);

  const data = match.data?.data;

  const setGapStatus = async (gapId: string, status: string) => {
    setGapPending(gapId);
    try {
      await api.patch(`/api/ai/gaps/${gapId}`, { status });
      invalidate(`/api/ai/matches/${matchId}`, '/api/ai/matches');
      toastSuccess('Skill gap updated', GAP_STATUS_LABEL[status] ?? status);
    } catch (error) {
      toastError(error, 'Could not update that skill gap.');
    } finally {
      setGapPending(null);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/api/ai/matches/${matchId}`);
      invalidate('/api/ai/matches', '/api/resumes', '/api/jobs');
      toastSuccess('Analysis deleted', 'It no longer appears in your history.');
      router.push('/career');
    } catch (error) {
      toastError(error, 'Could not delete that analysis.');
      setDeleting(false);
    }
  };

  if (match.isLoading) {
    return (
      <div className="space-y-5">
        <SkeletonRows rows={2} />
        <SkeletonTiles count={4} />
        <SkeletonRows rows={8} />
      </div>
    );
  }

  if (match.error || !data) {
    return (
      <>
        <PageHeader title="Analysis" breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Career', href: '/career' }, { label: 'Analysis' }]} />
        <ErrorState error={match.error ?? new Error('That analysis is no longer available.')} onRetry={() => match.refetch()} />
      </>
    );
  }

  const coverage =
    data.matchedSkills.length + data.missingSkills.length + data.partialSkills.length > 0
      ? Math.round((data.matchedSkills.length / (data.matchedSkills.length + data.missingSkills.length + data.partialSkills.length)) * 100)
      : 0;

  return (
    <>
      <PageHeader
        title={data.job.title}
        description={
          <>
            Alignment of <span className="font-medium text-ink">{data.resume.title}</span>
            {data.job.company ? <> against the posting at {data.job.company}</> : null}.
          </>
        }
        icon={<Sparkles />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Career', href: '/career' }, { label: data.job.title }]}
        meta={
          <>
            <Badge tone={VERDICT_TONE[data.verdict] ?? 'neutral'}>{VERDICT_LABEL[data.verdict] ?? data.verdict}</Badge>
            <Badge tone="neutral">
              {data.job.location ? `${JOB_TYPE_LABEL[data.job.jobType] ?? data.job.jobType} · ${data.job.location}` : JOB_TYPE_LABEL[data.job.jobType] ?? data.job.jobType}
            </Badge>
            <span className="text-xs text-subtle">Analysed {formatDateTime(data.createdAt)}</span>
          </>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/career">
                <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
                All analyses
              </Link>
            </Button>
            <Button size="sm" variant="ghost" className="text-danger-fg hover:text-danger" onClick={() => setDeleting(true)}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          </>
        }
      />

      <div className="mt-5 space-y-5">
        <AlignmentNotice />

        <Panel>
          <PanelBody className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <ScoreDial value={data.score} label="Alignment" tone={scoreTone(data.score)} size={148} />
              <Badge tone={VERDICT_TONE[data.verdict] ?? 'neutral'}>{VERDICT_LABEL[data.verdict] ?? data.verdict}</Badge>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              {data.summary ? <p className="text-sm leading-relaxed text-ink/90">{data.summary}</p> : null}

              <div>
                <h2 className="section-rule">How the score was built</h2>
                <div className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2">
                  {data.breakdown.map((item) => (
                    <MetricRow
                      key={item.label}
                      label={item.label}
                      sublabel={item.detail}
                      value={item.score}
                      tone={scoreTone(item.score)}
                      trailing={<span className="tnum text-2xs text-subtle">weight {Math.round(item.weight * 100)}%</span>}
                    />
                  ))}
                </div>
              </div>

              <p className="text-xs text-subtle">
                Engine: {data.provider.toLowerCase()}
                {data.model ? ` · ${data.model}` : ''} ·{' '}
                {ai?.live ? 'a live provider configured by your institution' : 'the built-in deterministic engine'}. Re-running with a
                different provider does not change this screen.
              </p>
            </div>
          </PanelBody>
        </Panel>

        <StatGrid columns={4}>
          <StatTile label="Skills matched" value={data.matchedSkills.length} tone="ok" icon={<CheckCircle2 />} hint="Present in both documents" />
          <StatTile label="Partially matched" value={data.partialSkills.length} tone="warn" icon={<MinusCircle />} hint="Related wording found" />
          <StatTile label="Missing skills" value={data.missingSkills.length} tone="danger" icon={<CircleDashed />} hint="Asked for, not evidenced" />
          <StatTile label="Skill coverage" value={`${coverage}%`} tone="brand" icon={<Target />} hint="Share of required skills evidenced" />
        </StatGrid>

        <div className="grid gap-5 lg:grid-cols-2">
          <SkillColumn
            title="Skills this resume already evidences"
            hint="Keep these visible near the top of your resume."
            tone="ok"
            icon={<CheckCircle2 />}
            skills={data.matchedSkills}
          />
          <SkillColumn
            title="Skills the job asks for that are missing"
            hint="Each of these becomes a tracked item in your skill plan."
            tone="danger"
            icon={<CircleDashed />}
            skills={data.missingSkills}
          />
        </div>

        {data.partialSkills.length > 0 ? (
          <SkillColumn
            title="Partially matched"
            hint="Related experience was found, but the exact requirement is not clearly evidenced."
            tone="warn"
            icon={<MinusCircle />}
            skills={data.partialSkills}
          />
        ) : null}

        {data.evidence.length > 0 ? (
          <Panel>
            <PanelHeader title="Where the match comes from" subtitle="Quoted from your resume, so you can see exactly which wording carried the score." icon={<Quote />} />
            <PanelBody>
              <ul className="space-y-2.5">
                {data.evidence.map((item) => (
                  <li key={`${item.skill}-${item.snippet}`} className="rounded-md border border-line bg-raised p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand">{item.skill}</p>
                    <p className="mt-1 border-l-2 border-line-strong pl-3 text-[0.8125rem] italic leading-relaxed text-muted">
                      “{item.snippet}”
                    </p>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <PanelHeader
              title="Recommended next steps"
              subtitle="Ordered by how much each one would move this specific alignment score."
              icon={<Lightbulb />}
            />
            <PanelBody>
              {data.recommendations.length === 0 ? (
                <p className="text-sm text-muted">No changes suggested — this resume already covers the posting well.</p>
              ) : (
                <ol className="space-y-2.5">
                  {data.recommendations.map((rec, index) => (
                    <li key={rec.title} className="stack-item rounded-r-md pr-2">
                      <div className="flex items-start gap-2.5">
                        <span className="tnum mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-brand-soft text-2xs font-semibold text-brand">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{rec.title}</p>
                          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{rec.detail}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <Badge tone={PRIORITY_TONE[rec.priority] ?? 'neutral'}>{rec.priority.toLowerCase()} priority</Badge>
                            <Badge tone="neutral">effort: {rec.effort}</Badge>
                            {rec.skill ? <Badge tone="brand">{rec.skill}</Badge> : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Your skill plan"
              subtitle="Tracked across every analysis — update the status as you learn."
              icon={<Target />}
            />
            <PanelBody>
              {data.skillGaps.length === 0 ? (
                <p className="text-sm text-muted">No open gaps from this analysis.</p>
              ) : (
                <ul className="space-y-2">
                  {data.skillGaps.map((gap) => {
                    const busy = gapPending === gap.id;
                    return (
                      <li
                        key={gap.id}
                        className={cn(
                          'rounded-md border p-3',
                          gap.status === 'CLOSED' ? 'border-line bg-raised/50' : 'border-line bg-surface',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn('text-sm font-semibold', gap.status === 'CLOSED' ? 'text-muted line-through' : 'text-ink')}>
                            {gap.skillName}
                          </p>
                          <Badge tone={severityTone(gap.severity)}>{gap.severity.toLowerCase()}</Badge>
                          {gap.category ? <Badge tone="neutral">{SKILL_CATEGORY_LABEL[gap.category] ?? gap.category}</Badge> : null}
                          <Badge
                            tone={gap.status === 'CLOSED' ? 'ok' : gap.status === 'IN_PROGRESS' ? 'info' : 'neutral'}
                            icon={gap.status === 'CLOSED' ? <CheckCircle2 /> : gap.status === 'IN_PROGRESS' ? <Loader2 /> : <CircleDashed />}
                          >
                            {GAP_STATUS_LABEL[gap.status] ?? gap.status}
                          </Badge>
                        </div>
                        {gap.recommendation ? <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{gap.recommendation}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {gap.status !== 'IN_PROGRESS' && gap.status !== 'CLOSED' ? (
                            <Button size="xs" variant="subtle" disabled={busy} onClick={() => void setGapStatus(gap.id, 'IN_PROGRESS')}>
                              Start learning
                            </Button>
                          ) : null}
                          {gap.status !== 'CLOSED' ? (
                            <Button size="xs" variant="secondary" disabled={busy} onClick={() => void setGapStatus(gap.id, 'CLOSED')}>
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                              Mark covered
                            </Button>
                          ) : (
                            <Button size="xs" variant="ghost" disabled={busy} onClick={() => void setGapStatus(gap.id, 'OPEN')}>
                              Reopen
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title="Job description used"
            subtitle={`${data.job.description.split(/\s+/).length.toLocaleString()} words analysed${data.job.company ? ` · ${data.job.company}` : ''}`}
            icon={<FileText />}
            actions={
              <Button size="xs" variant="ghost" onClick={() => setJobOpen((open) => !open)} aria-expanded={jobOpen}>
                {jobOpen ? 'Hide text' : 'Show full text'}
              </Button>
            }
          />
          <PanelBody>
            <p className={cn('text-[0.8125rem] leading-relaxed whitespace-pre-line text-muted', !jobOpen && 'line-clamp-4')}>
              {data.job.description}
            </p>
            <p className="mt-3 text-xs text-subtle">Saved {formatDate(data.createdAt)} · analysis id {data.id.slice(0, 8)}</p>
          </PanelBody>
        </Panel>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this analysis?"
        description="The report and its tracked skill gaps for this run are removed. Your resume and the saved job description stay."
        confirmLabel="Delete analysis"
        onConfirm={remove}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function SkillColumn({
  title,
  hint,
  tone,
  icon,
  skills,
}: {
  title: string;
  hint: string;
  tone: 'ok' | 'warn' | 'danger';
  icon: React.ReactNode;
  skills: SkillHit[];
}) {
  const chip = {
    ok: 'border-ok/25 bg-ok-soft text-ok-fg',
    warn: 'border-warn/25 bg-warn-soft text-warn-fg',
    danger: 'border-danger/25 bg-danger-soft text-danger-fg',
  }[tone];

  return (
    <Panel>
      <PanelHeader title={title} subtitle={hint} icon={icon} actions={<Badge tone={tone}>{skills.length}</Badge>} />
      <PanelBody>
        {skills.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <li key={skill.name}>
                <span
                  className={cn('inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium', chip)}
                  title={`${SKILL_CATEGORY_LABEL[skill.category] ?? skill.category} · demand ${skill.demand}/5${skill.evidence ? ` · “${skill.evidence}”` : ''}`}
                >
                  {skill.name}
                  <span className="text-2xs opacity-70">{SKILL_CATEGORY_LABEL[skill.category] ?? skill.category}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
