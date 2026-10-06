'use client';

import * as React from 'react';
import { Briefcase, MapPin, Plus, Sparkles, Trash2, UploadCloud } from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { useApi, useDebouncedValue, useInvalidate } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, SearchInput, Select, Textarea } from '@/components/ui/form';
import { FileDrop } from '@/components/ui/file-drop';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, NoSearchResults, SkeletonRows } from '@/components/ui/states';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { jobTextSchema } from '@/validations';
import type { JobSummary } from './types';
import { JOB_TYPE_LABEL, SKILL_CATEGORY_LABEL } from './types';

const ACCEPT = '.pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ACCEPT_LABEL = 'PDF, TXT, DOC or DOCX';
const MAX_MB = 5;

const JOB_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ON_SITE', label: 'On site' },
];

/**
 * Job description library — paste or upload a JD, then run it against a resume.
 */
export function JobManager({ onMatch }: { onMatch: (jobId: string) => void }) {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebouncedValue(search, 300);
  const invalidate = useInvalidate();

  const jobs = useApi<JobSummary[]>(
    '/api/jobs',
    { search: debounced || undefined, page, pageSize: 8 },
    { keepPreviousData: true },
  );

  const [addOpen, setAddOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<JobSummary | null>(null);

  React.useEffect(() => setPage(1), [debounced]);

  const rows = jobs.data?.data ?? [];
  const meta = jobs.data?.meta;

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/api/jobs/${deleting.id}`);
      invalidate('/api/jobs', '/api/ai/matches');
      toastSuccess('Job removed', `“${deleting.title}” is no longer in your list.`);
      setDeleting(null);
    } catch (error) {
      toastError(error, 'Could not remove that job description.');
    }
  };

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Job descriptions"
          subtitle="Every role you save stays available for re-analysis, so you can compare your resume against several postings."
          icon={<Briefcase />}
          actions={
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add job
            </Button>
          }
        />
        <PanelBody className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search role, company or requirement…"
              className="sm:max-w-xs"
              aria-label="Search job descriptions"
            />
            <p className="text-xs text-muted" aria-live="polite">
              {meta ? `${meta.total ?? 0} job description${meta.total === 1 ? '' : 's'} saved` : 'Loading…'}
            </p>
          </div>

          {jobs.isLoading ? <SkeletonRows rows={4} /> : null}
          {jobs.error ? (
            <p className="text-sm text-muted">
              Could not load job descriptions.{' '}
              <Button variant="link" size="xs" onClick={() => jobs.refetch()}>
                Try again
              </Button>
            </p>
          ) : null}

          {!jobs.isLoading && !jobs.error && rows.length === 0 ? (
            debounced ? (
              <NoSearchResults query={debounced} onReset={() => setSearch('')} />
            ) : (
              <EmptyState
                icon={<Briefcase />}
                title="No job descriptions yet"
                description="Paste a posting from a careers page, or upload the JD as a file. CampusIQ extracts the required skills, seniority and responsibilities."
                action={
                  <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Add a job description
                  </Button>
                }
              />
            )
          ) : null}

          <ul className="space-y-2">
            {rows.map((job) => {
              const required = job.analysis?.technicalSkills ?? [];
              return (
                <li key={job.id}>
                  <div className="rounded-md border border-line bg-surface p-3.5 transition-colors hover:border-line-strong">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                          <Badge tone="neutral">{JOB_TYPE_LABEL[job.jobType] ?? job.jobType}</Badge>
                          {job.ownedByMe ? <Badge tone="brand">Yours</Badge> : <Badge tone="info">Shared</Badge>}
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          {job.company ? <span className="font-medium text-ink/80">{job.company}</span> : null}
                          {job.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden />
                              {job.location}
                            </span>
                          ) : null}
                          <span>Added {formatDate(job.createdAt)}</span>
                          <span>{job.wordCount.toLocaleString()} words</span>
                          {job.minExperience > 0 ? <span>{job.minExperience}+ yrs experience</span> : null}
                          <span>
                            {job.matchCount} analys{job.matchCount === 1 ? 'is' : 'es'}
                          </span>
                        </p>

                        {required.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {required.slice(0, 14).map((skill) => (
                              <span
                                key={skill.name}
                                className={cn(
                                  'inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-medium',
                                  skill.demand >= 4
                                    ? 'border-danger/25 bg-danger-soft text-danger-fg'
                                    : 'border-line-strong bg-raised text-muted',
                                )}
                                title={`${SKILL_CATEGORY_LABEL[skill.category] ?? skill.category} · demand ${skill.demand}/5`}
                              >
                                {skill.name}
                              </span>
                            ))}
                            {required.length > 14 ? (
                              <span className="px-1 py-0.5 text-2xs text-subtle">+{required.length - 14} more</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button size="xs" variant="primary" onClick={() => onMatch(job.id)}>
                          <Sparkles className="h-3.5 w-3.5" aria-hidden />
                          Match
                        </Button>
                        {job.ownedByMe ? (
                          <Button size="xs" variant="ghost" className="text-danger-fg hover:text-danger" onClick={() => setDeleting(job)}>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            <span className="sr-only">Remove {job.title}</span>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {meta && (meta.totalPages ?? 1) > 1 ? (
            <Pagination
              page={meta.page ?? 1}
              pageSize={meta.pageSize ?? 8}
              total={meta.total ?? rows.length}
              totalPages={meta.totalPages ?? 1}
              onChange={setPage}
              label="job descriptions"
            />
          ) : null}
        </PanelBody>
      </Panel>

      <AddJobDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(jobId) => {
          invalidate('/api/jobs');
          setAddOpen(false);
          onMatch(jobId);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove this job description?"
        description={deleting ? `“${deleting.title}” will disappear from your list. Existing analyses stay in history.` : undefined}
        confirmLabel="Remove job"
        onConfirm={remove}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function AddJobDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (jobId: string) => void;
}) {
  const [title, setTitle] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [jobType, setJobType] = React.useState('FULL_TIME');
  const [sourceUrl, setSourceUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const reset = () => {
    setTitle('');
    setCompany('');
    setLocation('');
    setJobType('FULL_TIME');
    setSourceUrl('');
    setDescription('');
    setFile(null);
    setProgress(0);
    setError(null);
    setFieldErrors({});
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = jobTextSchema.safeParse({
      title: title.trim() || undefined,
      company: company.trim() || undefined,
      location: location.trim() || undefined,
      jobType,
      sourceUrl: sourceUrl.trim() || undefined,
      description: file ? description.trim() || undefined : description,
    });

    if (!parsed.success && !file) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) issues[issue.path.join('.') || 'description'] = issue.message;
      setFieldErrors(issues);
      return;
    }
    if (!file && description.trim().length < 40) {
      setFieldErrors({ description: 'Paste at least a few lines of the job description, or attach a file.' });
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      if (title.trim()) form.set('title', title.trim());
      if (company.trim()) form.set('company', company.trim());
      if (location.trim()) form.set('location', location.trim());
      form.set('jobType', jobType);
      if (sourceUrl.trim()) form.set('sourceUrl', sourceUrl.trim());
      if (description.trim()) form.set('description', description.trim());
      if (file) form.set('file', file);

      const result = await api.upload<{ jobDescriptionId: string }>('/api/jobs', form, setProgress);
      toastSuccess('Job description saved', 'The required skills were extracted and the role is ready to match.');
      reset();
      onCreated(result.data.jobDescriptionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that job description.');
      setProgress(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Add a job description"
        size="lg"
        description="Paste the posting or upload the file. Only the role text is stored — never any API keys."
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Role title" htmlFor="job-title">
              <Input id="job-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Backend Engineer" maxLength={120} />
            </Field>
            <Field label="Company" htmlFor="job-company">
              <Input id="job-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Zoho Corporation" maxLength={120} />
            </Field>
            <Field label="Location" htmlFor="job-location">
              <Input id="job-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chennai / Hybrid" maxLength={120} />
            </Field>
            <Field label="Employment type" htmlFor="job-type">
              <Select id="job-type" value={jobType} onChange={(e) => setJobType(e.target.value)} options={JOB_TYPE_OPTIONS} />
            </Field>
          </div>

          <Field label="Posting URL" htmlFor="job-url" hint="Optional — kept for your own reference." error={fieldErrors.sourceUrl}>
            <Input
              id="job-url"
              type="url"
              value={sourceUrl}
              invalid={Boolean(fieldErrors.sourceUrl)}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://careers.example.com/jobs/1234"
            />
          </Field>

          <Field
            label="Job description text"
            htmlFor="job-description"
            hint="Include the responsibilities and requirements — those drive the skill extraction."
            error={fieldErrors.description}
            required={!file}
          >
            <Textarea
              id="job-description"
              rows={10}
              value={description}
              invalid={Boolean(fieldErrors.description)}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={'We are looking for a backend engineer with strong Python and SQL…'}
            />
          </Field>

          <div className="rounded-md border border-line bg-raised p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
              <UploadCloud className="h-3.5 w-3.5" aria-hidden />
              Or attach the posting as a file (its text is appended to whatever you pasted)
            </p>
            <FileDrop
              accept={ACCEPT}
              acceptLabel={ACCEPT_LABEL}
              maxSizeMb={MAX_MB}
              file={file}
              onFile={setFile}
              onClear={() => setFile(null)}
              uploading={busy}
              progress={busy ? progress : undefined}
              inputId="job-file"
            />
          </div>

          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="-mx-5 -mb-4 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              {busy ? 'Extracting skills…' : 'Save job description'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
