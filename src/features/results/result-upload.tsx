'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, FileSpreadsheet, Info, Loader2, Sparkles, UploadCloud } from 'lucide-react';

import { api } from '@/lib/api-client';
import { formatDate, toDateInputValue } from '@/lib/format';
import { useApi } from '@/hooks/use-api';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileDrop } from '@/components/ui/file-drop';
import { Field, Input, Select } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader, StackItem } from '@/components/ui/panel';
import { resultUploadSchema } from '@/validations';

interface ClassOption {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  semester: number;
  studentCount: number;
  subjects: { id: string; code: string; name: string }[];
}

interface ProcessedResult {
  universityResultId: string;
  name: string;
  extractionMode: 'PARSED' | 'SIMULATED';
  strategy: string;
  rowsRead: number;
  matched: number;
  unmatched: string[];
  passPercentage: number;
  passedStudents: number;
  failedStudents: number;
  arrearCount: number;
  subjectStats: { subjectId: string; code: string; name: string; appeared: number; passed: number; failed: number; passPercentage: number; averageMarks: number }[];
  warnings: string[];
}

type Stage = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

/**
 * University result upload.
 *
 * The document is extracted and parsed server-side; if nothing readable is
 * found CampusIQ falls back to a clearly-labelled simulated extraction so the
 * analytics screens stay usable, and says so on screen.
 */
export function ResultUpload({ onProcessed }: { onProcessed?: (result: ProcessedResult) => void }) {
  const classes = useApi<{ classes: ClassOption[] }>('/api/classes');
  const classOptions = classes.data?.data?.classes ?? [];

  const [file, setFile] = React.useState<File | null>(null);
  const [classId, setClassId] = React.useState('');
  const [name, setName] = React.useState('');
  const [semester, setSemester] = React.useState('');
  const [declaredOn, setDeclaredOn] = React.useState(toDateInputValue(new Date()));
  const [progress, setProgress] = React.useState(0);
  const [stage, setStage] = React.useState<Stage>('idle');
  const [result, setResult] = React.useState<ProcessedResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const selectedClass = classOptions.find((c) => c.id === classId);

  React.useEffect(() => {
    if (selectedClass && !semester) setSemester(String(selectedClass.semester));
  }, [selectedClass, semester]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError('Choose the result sheet file to upload.');
      return;
    }
    if (!classId) {
      setError('Select the class these results belong to.');
      return;
    }

    const parsed = resultUploadSchema.safeParse({
      name: name.trim() || undefined,
      semester: semester ? Number(semester) : undefined,
      declaredOn: declaredOn ? new Date(`${declaredOn}T00:00:00.000Z`) : undefined,
      classId,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the result details.');
      return;
    }

    const form = new FormData();
    form.append('file', file);
    if (parsed.data.name) form.append('name', parsed.data.name);
    form.append('classId', classId);
    if (parsed.data.semester) form.append('semester', String(parsed.data.semester));
    if (parsed.data.declaredOn) form.append('declaredOn', parsed.data.declaredOn.toISOString());

    setStage('uploading');
    setProgress(0);
    try {
      const response = await api.upload<ProcessedResult>('/api/results/upload', form, (percent) => {
        setProgress(percent);
        if (percent >= 100) setStage('processing');
      });
      setResult(response.data);
      setStage('done');
      onProcessed?.(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The result sheet could not be processed.');
      setStage('error');
    }
  };

  const reset = () => {
    setFile(null);
    setName('');
    setProgress(0);
    setStage('idle');
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Upload a university result sheet"
          subtitle="PDF, CSV, JSON or plain text. Rows are matched to students by register number."
          icon={<UploadCloud />}
          actions={stage === 'done' ? <Button size="sm" variant="ghost" onClick={reset}>Upload another</Button> : null}
        />
        <PanelBody>
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error ? (
              <Alert tone="danger" title="Upload failed" onDismiss={() => setError(null)}>
                {error}
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Class" htmlFor="result-class" required hint={selectedClass ? `${selectedClass.studentCount} students · ${selectedClass.subjects.length} subjects` : undefined}>
                <Select
                  id="result-class"
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  placeholder={classes.isLoading ? 'Loading classes…' : 'Select a class'}
                  options={classOptions.map((c) => ({ value: c.id, label: `${c.departmentName} · ${c.name}` }))}
                />
              </Field>
              <Field label="Result name" htmlFor="result-name" hint="Defaults to the semester and month">
                <Input id="result-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Semester 5 · November 2025" maxLength={120} />
              </Field>
              <Field label="Semester" htmlFor="result-semester">
                <Select
                  id="result-semester"
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                  options={Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }))}
                />
              </Field>
              <Field label="Declared on" htmlFor="result-date">
                <Input id="result-date" type="date" value={declaredOn} max={toDateInputValue(new Date())} onChange={(event) => setDeclaredOn(event.target.value)} />
              </Field>
            </div>

            <FileDrop
              accept=".pdf,.csv,.tsv,.txt,.json,application/pdf,text/csv,text/plain,application/json"
              acceptLabel="PDF, CSV, TSV, JSON or TXT"
              maxSizeMb={10}
              file={file}
              onFile={setFile}
              onClear={() => setFile(null)}
              uploading={stage === 'uploading' || stage === 'processing'}
              progress={stage === 'uploading' ? progress : undefined}
              disabled={stage === 'uploading' || stage === 'processing'}
            />

            {stage === 'processing' ? (
              <Alert tone="info" title="Processing the document" icon={<Loader2 className="h-4 w-4 animate-spin" />}>
                Extracting text, detecting the layout, matching register numbers and writing results, arrears and notifications.
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" loading={stage === 'uploading' || stage === 'processing'} disabled={stage === 'uploading' || stage === 'processing' || !file || !classId}>
                <UploadCloud className="h-4 w-4" aria-hidden />
                {stage === 'processing' ? 'Processing…' : 'Upload and process'}
              </Button>
              <Button type="button" variant="ghost" onClick={reset} disabled={stage === 'uploading' || stage === 'processing'}>
                Clear
              </Button>
            </div>

            <Alert tone="neutral" icon={<Info className="h-4 w-4" />}>
              Result parsing is pluggable: the server tries JSON, CSV/TSV, a wide marks table and record blocks in turn. When a scanned or
              encrypted PDF yields no rows, CampusIQ generates a clearly labelled demo result set for the selected class instead of failing
              silently.
            </Alert>
          </form>
        </PanelBody>
      </Panel>

      {result ? (
        <Panel>
          <PanelHeader
            title={result.name}
            subtitle={`${result.matched} student${result.matched === 1 ? '' : 's'} matched · ${result.rowsRead} rows read · strategy “${result.strategy}”`}
            icon={result.extractionMode === 'PARSED' ? <CheckCircle2 /> : <Sparkles />}
            actions={
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={result.extractionMode === 'PARSED' ? 'ok' : 'warn'}>
                  {result.extractionMode === 'PARSED' ? 'Extracted from document' : 'Simulated fallback'}
                </Badge>
                <Badge tone={result.passPercentage >= 70 ? 'ok' : result.passPercentage >= 50 ? 'warn' : 'danger'}>
                  {result.passPercentage.toFixed(1)}% pass
                </Badge>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/results/${result.universityResultId}`}>Open full report</Link>
                </Button>
              </div>
            }
          />
          <PanelBody className="space-y-4">
            {result.extractionMode === 'SIMULATED' ? (
              <Alert tone="warning" title="These figures were simulated, not read from your file">
                No student rows could be parsed from the document (scanned PDFs and encrypted files cannot be read). CampusIQ generated a
                demo result set for the selected class so the analytics remain usable. Upload a text-based sheet or CSV for live extraction.
              </Alert>
            ) : null}

            {result.warnings.length ? (
              <ul className="space-y-1 rounded-md border border-line bg-raised p-3">
                {result.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs text-muted">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Passed', value: result.passedStudents, tone: 'ok' as const },
                { label: 'With arrears', value: result.failedStudents, tone: 'warn' as const },
                { label: 'Arrear records', value: result.arrearCount, tone: 'danger' as const },
                { label: 'Unmatched rows', value: result.unmatched.length, tone: 'neutral' as const },
              ].map((tile) => (
                <div key={tile.label} className="rounded-md border border-line bg-surface px-3 py-2">
                  <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">{tile.label}</p>
                  <p className="tnum mt-0.5 text-xl font-semibold text-ink">{tile.value}</p>
                </div>
              ))}
            </div>

            {result.unmatched.length ? (
              <div>
                <p className="section-rule mb-2">Register numbers not found in this class</p>
                <p className="text-xs text-muted">{result.unmatched.slice(0, 20).join(', ')}{result.unmatched.length > 20 ? ` … and ${result.unmatched.length - 20} more` : ''}</p>
              </div>
            ) : null}

            <div>
              <p className="section-rule mb-2">Subject-wise pass percentage</p>
              <ul className="divide-y divide-line/70">
                {result.subjectStats.map((subject) => (
                  <li key={subject.subjectId}>
                    <StackItem
                      tone={subject.passPercentage >= 80 ? 'ok' : subject.passPercentage >= 50 ? 'warn' : 'danger'}
                      title={`${subject.code} · ${subject.name}`}
                      detail={`${subject.passed} passed · ${subject.failed} failed · average ${subject.averageMarks.toFixed(1)} marks`}
                      metric={`${subject.passPercentage.toFixed(0)}%`}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-subtle">
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
              Processed {formatDate(new Date(), { day: '2-digit', month: 'short', year: 'numeric' })} · students were notified automatically.
            </p>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
