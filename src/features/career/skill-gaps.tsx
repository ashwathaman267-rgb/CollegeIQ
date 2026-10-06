'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleDashed, Loader2, Sparkles, Target } from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { useInvalidate } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { ProgressBar } from '@/components/ui/progress';
import { EmptyState, SkeletonRows } from '@/components/ui/states';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import type { GapBoard, GapItem } from './types';
import { GAP_STATUS_LABEL, SKILL_CATEGORY_LABEL, severityTone } from './types';

type Filter = 'all' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

/**
 * Skill gap tracker.
 *
 * Gaps are collected from every analysis a student has run, merged per skill
 * and given a status the student controls, so the list is a study plan rather
 * than a verdict.
 */
export function SkillGapBoard({ board, loading }: { board?: GapBoard; loading?: boolean }) {
  const [filter, setFilter] = React.useState<Filter>('all');
  const [pending, setPending] = React.useState<string | null>(null);
  const invalidate = useInvalidate();

  const items = board?.items ?? [];
  const visible = filter === 'all' ? items : items.filter((item) => item.status === filter);
  const closedRatio = items.length ? Math.round((board?.closed ?? 0) / items.length * 100) : 0;

  const setStatus = async (item: GapItem, status: string) => {
    setPending(item.skillName);
    try {
      await api.patch('/api/ai/gaps', { skillName: item.skillName, status });
      invalidate('/api/ai/matches');
      toastSuccess(
        status === 'CLOSED' ? 'Skill marked as covered' : status === 'IN_PROGRESS' ? 'Skill marked in progress' : 'Skill reopened',
        `${item.skillName} — updated across all your analyses.`,
      );
    } catch (error) {
      toastError(error, 'Could not update that skill gap.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <StatGrid columns={4}>
        <StatTile label="Open gaps" value={board?.open ?? 0} tone={(board?.open ?? 0) > 4 ? 'danger' : 'warn'} icon={<CircleDashed />} loading={loading} />
        <StatTile label="In progress" value={board?.inProgress ?? 0} tone="info" icon={<Loader2 />} loading={loading} />
        <StatTile label="Covered" value={board?.closed ?? 0} tone="ok" icon={<CheckCircle2 />} loading={loading} />
        <StatTile
          label="Best alignment"
          value={board?.bestScore != null ? `${board.bestScore}%` : '—'}
          hint="Highest resume-to-JD score so far"
          tone="brand"
          icon={<Target />}
          loading={loading}
        />
      </StatGrid>

      <Panel>
        <PanelHeader
          title="Skills to work on"
          subtitle="Merged from every analysis you have run. Closing a gap updates it everywhere it appeared."
          icon={<Sparkles />}
          actions={
            <Segmented<Filter>
              size="sm"
              value={filter}
              onChange={setFilter}
              ariaLabel="Filter skill gaps"
              options={[
                { value: 'all', label: 'All' },
                { value: 'OPEN', label: 'Open' },
                { value: 'IN_PROGRESS', label: 'In progress' },
                { value: 'CLOSED', label: 'Covered' },
              ]}
            />
          }
        />
        <PanelBody className="space-y-3">
          {items.length > 0 ? (
            <div className="rounded-md border border-line bg-raised p-3">
              <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
                <span>Plan progress</span>
                <span className="tnum font-semibold text-ink">
                  {board?.closed ?? 0} of {items.length} covered
                </span>
              </div>
              <ProgressBar value={closedRatio} tone="ok" size="sm" className="mt-2" label="Skill gaps covered" />
            </div>
          ) : null}

          {loading ? <SkeletonRows rows={5} /> : null}

          {!loading && items.length === 0 ? (
            <EmptyState
              icon={<Target />}
              title="No skill gaps tracked yet"
              description="Run your first resume-to-job analysis and every missing skill lands here as an actionable study item."
              action={
                <Button variant="primary" size="sm" asChild>
                  <Link href="/career">Go to analyses</Link>
                </Button>
              }
            />
          ) : null}

          {!loading && items.length > 0 && visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No gaps with that status.</p>
          ) : null}

          <ul className="space-y-2">
            {visible.map((item) => {
              const busy = pending === item.skillName;
              return (
                <li
                  key={item.skillName}
                  className={cn(
                    'rounded-md border p-3.5 transition-colors',
                    item.status === 'CLOSED' ? 'border-line bg-raised/50' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn('text-sm font-semibold', item.status === 'CLOSED' ? 'text-muted line-through' : 'text-ink')}>
                          {item.skillName}
                        </p>
                        <Badge tone={severityTone(item.severity)}>{item.severity.toLowerCase()} priority</Badge>
                        {item.category ? <Badge tone="neutral">{SKILL_CATEGORY_LABEL[item.category] ?? item.category}</Badge> : null}
                        {item.count > 1 ? <Badge tone="warn">missing in {item.count} roles</Badge> : null}
                        <Badge
                          tone={item.status === 'CLOSED' ? 'ok' : item.status === 'IN_PROGRESS' ? 'info' : 'neutral'}
                          icon={item.status === 'CLOSED' ? <CheckCircle2 /> : item.status === 'IN_PROGRESS' ? <Loader2 /> : <CircleDashed />}
                        >
                          {GAP_STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                      </div>
                      {item.recommendation ? (
                        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{item.recommendation}</p>
                      ) : null}
                      <p className="mt-1.5 text-xs text-subtle">
                        Last seen {formatDate(item.lastSeen)} ·{' '}
                        <Link href={`/career/matches/${item.matchId}`} className="text-brand underline-offset-2 hover:underline">
                          {item.jobTitle}
                          {item.company ? ` at ${item.company}` : ''}
                        </Link>
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.status !== 'IN_PROGRESS' && item.status !== 'CLOSED' ? (
                        <Button size="xs" variant="subtle" disabled={busy} onClick={() => void setStatus(item, 'IN_PROGRESS')}>
                          Start learning
                        </Button>
                      ) : null}
                      {item.status !== 'CLOSED' ? (
                        <Button size="xs" variant="secondary" disabled={busy} onClick={() => void setStatus(item, 'CLOSED')}>
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          Mark covered
                        </Button>
                      ) : (
                        <Button size="xs" variant="ghost" disabled={busy} onClick={() => void setStatus(item, 'OPEN')}>
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </PanelBody>
      </Panel>
    </div>
  );
}
