'use client';

import * as React from 'react';
import {
  BadgeCheck,
  Download,
  Eye,
  FileText,
  Plus,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn, formatBytes } from '@/lib/utils';
import { formatDate, formatPercent } from '@/lib/format';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, Sheet } from '@/components/ui/dialog';
import { Field, Input, Segmented, Textarea } from '@/components/ui/form';
import { FileDrop } from '@/components/ui/file-drop';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { ProgressBar, ScoreDial } from '@/components/ui/progress';
import { EmptyState, SkeletonRows } from '@/components/ui/states';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { resumeSchema } from '@/validations';
import type { ResumeSummary } from './types';
import { SKILL_CATEGORY_LABEL, scoreTone } from './types';

const ACCEPT = '.pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ACCEPT_LABEL = 'PDF, TXT, DOC or DOCX';
const MAX_MB = 5;

/**
 * Resume library: upload (file or pasted text), inspect the extracted
 * analysis, mark the active version and delete old copies.
 */
export function ResumeManager({ onMatchWith }: { onMatchWith?: (resumeId: string) => void }) {
  const resumes = useApi<ResumeSummary[]>('/api/resumes');
  const invalidate = useInvalidate();

  const rows = resumes.data?.data ?? [];

  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<ResumeSummary | null>(null);

  const detail = useApi<ResumeSummary & { content?: string; studentName?: string; evidence?: unknown }>(
    `/api/resumes/${viewing}`,
    undefined,
    { enabled: Boolean(viewing) },
  );

  const setPrimary = async (resume: ResumeSummary) => {
    try {
      await api.patch(`/api/resumes/${resume.id}`, { isPrimary: true });
      invalidate('/api/resumes');
      toastSuccess('Primary resume updated', `“${resume.title}” is now used by default for new analyses.`);
    } catch (error) {
      toastError(error, 'Could not update the primary resume.');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/api/resumes/${deleting.id}`);
      invalidate('/api/resumes', '/api/ai/matches');
      toastSuccess('Resume deleted', `“${deleting.title}” was removed from your library.`);
      setDeleting(null);
    } catch (error) {
      toastError(error, 'Could not delete that resume.');
    }
  };

  const active = detail.data?.data ?? null;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Your resumes"
          subtitle="CampusIQ reads the text of each resume, extracts skills, projects and experience, and keeps every version you upload."
          icon={<FileText />}
          actions={
            <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add resume
            </Button>
          }
        />
        <PanelBody>
          {resumes.isLoading ? <SkeletonRows rows={3} /> : null}
          {resumes.error ? (
            <p className="text-sm text-muted">
              Could not load your resumes.{' '}
              <Button variant="link" size="xs" onClick={() => resumes.refetch()}>
                Try again
              </Button>
            </p>
          ) : null}
          {!resumes.isLoading && !resumes.error && rows.length === 0 ? (
            <EmptyState
              icon={<UploadCloud />}
              title="No resume yet"
              description="Upload a PDF or paste your resume text. Nothing leaves this server unless you connect an AI provider in Settings."
              action={
                <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add your first resume
                </Button>
              }
            />
          ) : null}

          <ul className="space-y-2">
            {rows.map((resume) => (
              <li key={resume.id}>
                <div
                  className={cn(
                    'stack-item rounded-r-md border border-line bg-surface p-3.5 transition-colors hover:border-line-strong',
                    resume.isPrimary && 'border-brand/35 bg-brand-soft/25',
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{resume.title}</p>
                        {resume.isPrimary ? (
                          <Badge tone="brand" icon={<Star />}>
                            Primary
                          </Badge>
                        ) : null}
                        <Badge tone="neutral">v{resume.version}</Badge>
                        {resume.fileName ? (
                          <Badge tone="info" icon={<FileText />}>
                            {resume.fileName}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {resume.wordCount.toLocaleString()} words · added {formatDate(resume.createdAt)} ·{' '}
                        {resume.matchCount} analys{resume.matchCount === 1 ? 'is' : 'es'} run
                        {resume.fileSize ? ` · ${formatBytes(resume.fileSize)}` : ''}
                      </p>

                      {resume.analysis ? (
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="font-semibold text-ink">{resume.analysis.qualityScore}</span>
                            <span className="text-2xs uppercase tracking-wide text-subtle">document quality</span>
                            <ProgressBar value={resume.analysis.qualityScore} size="sm" tone={scoreTone(resume.analysis.qualityScore)} className="w-16" />
                          </span>
                          <span className="text-muted">
                            {resume.analysis.experience.length} experience entr{resume.analysis.experience.length === 1 ? 'y' : 'ies'} ·{' '}
                            {resume.analysis.projects.length} project{resume.analysis.projects.length === 1 ? '' : 's'} ·{' '}
                            {resume.analysis.certifications.length} certification{resume.analysis.certifications.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      ) : null}

                      {resume.skills.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {resume.skills.slice(0, 12).map((skill) => (
                            <span
                              key={skill.name}
                              className="inline-flex items-center gap-1 rounded border border-line-strong bg-raised px-1.5 py-0.5 text-2xs font-medium text-muted"
                              title={`${SKILL_CATEGORY_LABEL[skill.category] ?? skill.category} · mentioned ${skill.mentions}×`}
                            >
                              {skill.name}
                            </span>
                          ))}
                          {resume.skills.length > 12 ? (
                            <span className="px-1 py-0.5 text-2xs text-subtle">+{resume.skills.length - 12} more</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button size="xs" variant="ghost" onClick={() => setViewing(resume.id)}>
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        Analysis
                      </Button>
                      {onMatchWith ? (
                        <Button size="xs" variant="subtle" onClick={() => onMatchWith(resume.id)}>
                          <Sparkles className="h-3.5 w-3.5" aria-hidden />
                          Match
                        </Button>
                      ) : null}
                      {resume.fileAssetId ? (
                        <Button size="xs" variant="ghost" asChild>
                          <a href={`/api/files/${resume.fileAssetId}`} download>
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            File
                          </a>
                        </Button>
                      ) : null}
                      {!resume.isPrimary ? (
                        <Button size="xs" variant="ghost" onClick={() => void setPrimary(resume)}>
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                          Make primary
                        </Button>
                      ) : null}
                      <Button size="xs" variant="ghost" className="text-danger-fg hover:text-danger" onClick={() => setDeleting(resume)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">Delete {resume.title}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </PanelBody>
      </Panel>

      <UploadResumeDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onCreated={() => {
          invalidate('/api/resumes');
          setUploadOpen(false);
        }}
      />

      <Sheet open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)} title="Resume analysis">
        {detail.isLoading ? (
          <SkeletonRows rows={6} />
        ) : active ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <ScoreDial
                value={active.analysis?.qualityScore ?? 0}
                label="Quality"
                tone={scoreTone(active.analysis?.qualityScore ?? 0)}
                size={112}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{active.title}</p>
                <p className="text-xs text-muted">
                  v{active.version} · {active.wordCount.toLocaleString()} words · {formatDate(active.createdAt)}
                </p>
                {active.analysis?.headlineRole ? (
                  <Badge tone="brand" className="mt-1.5">
                    {active.analysis.headlineRole}
                  </Badge>
                ) : null}
              </div>
            </div>

            {active.analysis?.summary ? (
              <p className="rounded-md border border-line bg-raised p-3 text-[0.8125rem] leading-relaxed text-muted">
                {active.analysis.summary}
              </p>
            ) : null}

            <section>
              <h3 className="section-rule">Skills detected</h3>
              <div className="mt-2 space-y-1.5">
                {(active.skills ?? []).slice(0, 30).map((skill) => (
                  <div key={skill.name} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-ink">{skill.name}</span>
                      <span className="ml-2 text-xs text-subtle">{SKILL_CATEGORY_LABEL[skill.category] ?? skill.category}</span>
                    </span>
                    <span className="tnum shrink-0 text-xs text-muted">
                      {'mentions' in skill ? String(skill.mentions) : ''}
                      {'demand' in skill && typeof skill.demand === 'number' ? ` · demand ${skill.demand}/5` : ''}
                    </span>
                  </div>
                ))}
                {(active.skills ?? []).length === 0 ? <p className="text-sm text-muted">No recognisable skills found.</p> : null}
              </div>
            </section>

            {active.analysis?.strengths?.length ? (
              <section>
                <h3 className="section-rule">Strengths</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {active.analysis.strengths.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ok" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {active.analysis?.improvements?.length ? (
              <section>
                <h3 className="section-rule">What to improve</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {active.analysis.improvements.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warn" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {active.analysis?.projects?.length ? (
              <section>
                <h3 className="section-rule">Projects</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {active.analysis.projects.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="text-xs text-subtle">
              Document quality {formatPercent(active.analysis?.qualityScore ?? 0, 0)} measures structure, evidence and keyword
              coverage — it is not a prediction of interview success.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">That resume could not be loaded.</p>
        )}
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this resume?"
        description={
          deleting
            ? `“${deleting.title}” and its stored file will be removed. Past analyses stay in your history.`
            : undefined
        }
        confirmLabel="Delete resume"
        loading={false}
        onConfirm={remove}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────

function UploadResumeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (resumeId: string) => void;
}) {
  const [mode, setMode] = React.useState<'file' | 'text'>('file');
  const [title, setTitle] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [text, setText] = React.useState('');
  const [progress, setProgress] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const reset = () => {
    setMode('file');
    setTitle('');
    setFile(null);
    setText('');
    setProgress(0);
    setError(null);
    setFieldErrors({});
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = resumeSchema.safeParse({
      title: title.trim() || undefined,
      text: mode === 'text' ? text : undefined,
    });
    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) issues[issue.path.join('.') || 'text'] = issue.message;
      setFieldErrors(issues);
      return;
    }
    if (mode === 'file' && !file) {
      setError('Choose a resume file, or switch to “Paste text”.');
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      if (title.trim()) form.set('title', title.trim());
      if (mode === 'text') {
        form.set('text', text);
      } else if (file) {
        form.set('file', file);
      }
      const result = await api.upload<{ resumeId: string }>('/api/resumes', form, setProgress);
      toastSuccess('Resume analysed', 'Skills, projects and experience were extracted from your resume.');
      reset();
      onCreated(result.data.resumeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setError(message);
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
      <DialogContent title="Add a resume" size="lg" description="Upload a document or paste the text. CampusIQ extracts the structure server-side.">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Segmented
            value={mode}
            onChange={(value) => setMode(value)}
            ariaLabel="How do you want to add your resume?"
            options={[
              { value: 'file', label: 'Upload file', icon: <UploadCloud className="h-3.5 w-3.5" /> },
              { value: 'text', label: 'Paste text', icon: <FileText className="h-3.5 w-3.5" /> },
            ]}
          />

          {mode === 'file' ? (
            <FileDrop
              accept={ACCEPT}
              acceptLabel={ACCEPT_LABEL}
              maxSizeMb={MAX_MB}
              file={file}
              onFile={setFile}
              onClear={() => setFile(null)}
              uploading={busy}
              progress={busy ? progress : undefined}
              inputId="resume-file"
            />
          ) : (
            <Field
              label="Resume text"
              htmlFor="resume-text"
              hint="Paste the full resume — headings, projects and skills included. Minimum 40 characters."
              error={fieldErrors.text}
              required
            >
              <Textarea
                id="resume-text"
                rows={12}
                value={text}
                invalid={Boolean(fieldErrors.text)}
                onChange={(event) => setText(event.target.value)}
                placeholder={'ARJUN NAIR\nB.E. Computer Science · 2027\nSkills: Python, Django, PostgreSQL, React…'}
              />
            </Field>
          )}

          <Field label="Title" htmlFor="resume-title" hint="Optional — a name is generated from the document otherwise.">
            <Input
              id="resume-title"
              value={title}
              invalid={Boolean(fieldErrors.title)}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Placement resume 2026"
              maxLength={120}
            />
          </Field>

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
              {busy ? 'Analysing…' : 'Upload and analyse'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
