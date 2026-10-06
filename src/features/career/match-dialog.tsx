'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useInvalidate } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/form';
import { Spinner } from '@/components/ui/states';
import { toastError } from '@/components/ui/toaster';
import type { JobSummary, ResumeSummary } from './types';
import { JOB_TYPE_LABEL } from './types';

interface MatchResponse {
  matchId: string;
  result: { score: number; verdict: string; summary: string; missingSkills: { name: string }[] };
  provider: { label: string; live: boolean };
}

/**
 * Choose a resume + job and run the alignment analysis.
 *
 * The overlap preview below is computed from the two documents the user
 * already uploaded; the authoritative score always comes from the server
 * (`AIService.matchResumeToJob`) and is shown on the report page.
 */
export function MatchDialog({
  open,
  onOpenChange,
  resumes,
  jobs,
  defaultResumeId,
  defaultJobId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumes: ResumeSummary[];
  jobs: JobSummary[];
  defaultResumeId?: string | null;
  defaultJobId?: string | null;
}) {
  const router = useRouter();
  const invalidate = useInvalidate();
  const { ai } = useSession();

  const [resumeId, setResumeId] = React.useState('');
  const [jobId, setJobId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setResumeId(defaultResumeId ?? resumes.find((r) => r.isPrimary)?.id ?? resumes[0]?.id ?? '');
    setJobId(defaultJobId ?? jobs[0]?.id ?? '');
    setError(null);
  }, [open, defaultResumeId, defaultJobId, resumes, jobs]);

  const resume = resumes.find((r) => r.id === resumeId);
  const job = jobs.find((j) => j.id === jobId);

  const resumeSkills = React.useMemo(
    () => new Set((resume?.analysis?.skills ?? []).map((s) => s.name.toLowerCase())),
    [resume],
  );
  const required = job?.analysis?.technicalSkills ?? [];
  const covered = required.filter((s) => resumeSkills.has(s.name.toLowerCase()));
  const missing = required.filter((s) => !resumeSkills.has(s.name.toLowerCase()));

  const run = async () => {
    if (!resumeId || !jobId) {
      setError('Choose both a resume and a job description.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<MatchResponse>('/api/ai/matches', {
        resumeId,
        jobDescriptionId: jobId,
      });
      invalidate('/api/ai/matches', '/api/resumes', '/api/jobs');
      onOpenChange(false);
      router.push(`/career/matches/${result.data.matchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The analysis could not be completed.');
      toastError(err, 'Could not run that analysis.');
    } finally {
      setBusy(false);
    }
  };

  const resumeOptions = resumes.map((r) => ({
    value: r.id,
    label: `${r.title}${r.isPrimary ? ' · primary' : ''} · v${r.version}`,
  }));
  const jobOptions = jobs.map((j) => ({
    value: j.id,
    label: `${j.title}${j.company ? ` · ${j.company}` : ''} · ${JOB_TYPE_LABEL[j.jobType] ?? j.jobType}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Run a resume–job analysis"
        size="lg"
        description={
          ai?.live
            ? `Analysed by ${ai.label}${ai.model ? ` (${ai.model})` : ''}.`
            : `Analysed by the built-in engine${ai?.label ? ` — ${ai.label}` : ''}. No external API key is required.`
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Resume" htmlFor="match-resume" required>
              <Select
                id="match-resume"
                value={resumeId}
                onChange={(e) => setResumeId(e.target.value)}
                options={resumeOptions.length ? resumeOptions : [{ value: '', label: 'No resumes yet' }]}
                disabled={busy || resumeOptions.length === 0}
              />
            </Field>
            <Field label="Job description" htmlFor="match-job" required>
              <Select
                id="match-job"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                options={jobOptions.length ? jobOptions : [{ value: '', label: 'No job descriptions yet' }]}
                disabled={busy || jobOptions.length === 0}
              />
            </Field>
          </div>

          {resume && job && required.length > 0 ? (
            <div className="rounded-md border border-line bg-raised p-3">
              <p className="text-xs font-medium text-muted">
                Skill overlap preview · {covered.length} of {required.length} required skills already appear in this resume
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {covered.slice(0, 18).map((skill) => (
                  <span
                    key={skill.name}
                    className="inline-flex items-center gap-1 rounded border border-ok/25 bg-ok-soft px-1.5 py-0.5 text-2xs font-medium text-ok-fg"
                  >
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    {skill.name}
                  </span>
                ))}
                {missing.slice(0, 18).map((skill) => (
                  <span
                    key={skill.name}
                    className="inline-flex items-center gap-1 rounded border border-danger/25 bg-danger-soft px-1.5 py-0.5 text-2xs font-medium text-danger-fg"
                  >
                    <XCircle className="h-3 w-3" aria-hidden />
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <Alert tone="info" title="What the score means">
            The result measures how closely your resume matches the wording and requirements of this specific job
            description. It is never a prediction of whether you will be hired.
          </Alert>

          {busy ? (
            <p className="flex items-center gap-2 text-sm text-muted" role="status">
              <Spinner className="h-4 w-4" />
              Reading both documents and scoring the alignment…
            </p>
          ) : null}

          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="-mx-5 -mb-4 mt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={busy}
            disabled={!resumeId || !jobId}
            className={cn(busy && 'pointer-events-none')}
            onClick={() => void run()}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Analyse alignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
