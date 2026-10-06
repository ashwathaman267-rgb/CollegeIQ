'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCheck, Pencil, Plus, Save, Trash2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { clamp } from '@/lib/utils';
import { formatDate, toDateInputValue } from '@/lib/format';
import { useApi } from '@/hooks/use-api';
import { useConfirm } from '@/hooks/use-confirm';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, ConfirmDialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/states';
import { ProgressBar } from '@/components/ui/progress';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { iaExamSchema } from '@/validations';

interface ExamRow {
  id: string;
  name: string;
  examNumber: number;
  examDate: string;
  maxMarks: number;
  weightage: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  classId: string;
  className: string;
  marksEntered: number;
}

interface MarksheetRow {
  studentId: string;
  registerNumber: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  marks: number | null;
  isAbsent: boolean;
  remarks: string | null;
  markId: string | null;
  percentage: number | null;
}

interface Sheet {
  exam: ExamRow;
  rows: MarksheetRow[];
  stats: { entered: number; average: number; highest: number; lowest: number; absent: number };
}

interface ClassOption {
  id: string;
  name: string;
  departmentName: string;
  studentCount: number;
  subjects: { id: string; code: string; name: string; maxIaMarks?: number }[];
}

export function MarksEntry({ classId, onClassChange, classes }: { classId: string; onClassChange: (id: string) => void; classes: ClassOption[] }) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [selectedExam, setSelectedExam] = React.useState('');
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingExam, setEditingExam] = React.useState<ExamRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ExamRow | null>(null);

  const exams = useApi<{ exams: ExamRow[]; pending: unknown[] }>('/api/marks', { classId }, { enabled: Boolean(classId) });
  const examRows = exams.data?.data?.exams ?? [];
  const sheet = useApi<Sheet>(`/api/marks/${selectedExam}/sheet`, undefined, { enabled: Boolean(selectedExam) });

  const selectedClass = classes.find((c) => c.id === classId);

  React.useEffect(() => {
    if (examRows.length && !examRows.some((exam) => exam.id === selectedExam)) setSelectedExam(examRows[0].id);
    if (!examRows.length) setSelectedExam('');
  }, [examRows, selectedExam]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['api', '/api/marks'] });
    void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[1] ?? '').startsWith('/api/marks/') });
    void queryClient.invalidateQueries({ queryKey: ['api', '/api/classes'] });
    void queryClient.invalidateQueries({ queryKey: ['api', '/api/dashboard'] });
  };

  const removeExam = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/marks/${deleteTarget.id}`);
      toastSuccess('Assessment deleted', `${deleteTarget.name} and its marks were removed.`);
      invalidate();
    } catch (error) {
      toastError(error, 'That assessment could not be deleted.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Internal assessments"
          subtitle="Create an assessment, then enter marks for the whole class in one pass"
          icon={<BookOpen />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Field label="" className="min-w-[13rem]">
                <Select
                  value={classId}
                  onChange={(event) => onClassChange(event.target.value)}
                  placeholder="Select a class"
                  options={classes.map((c) => ({ value: c.id, label: `${c.departmentName} · ${c.name}` }))}
                />
              </Field>
              <Button
                variant="primary"
                size="sm"
                disabled={!classId}
                onClick={() => {
                  setEditingExam(null);
                  setEditorOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New assessment
              </Button>
            </div>
          }
        />
        <PanelBody className="py-2">
          {exams.isLoading ? (
            <SkeletonRows rows={4} />
          ) : exams.isError ? (
            <ErrorState error={exams.error} onRetry={() => exams.refetch()} title="Could not load assessments" />
          ) : examRows.length === 0 ? (
            <EmptyState
              icon={<BookOpen />}
              title={classId ? 'No assessments for this class yet' : 'Select a class'}
              description={classId ? `Create IA-1, IA-2 or a model exam for ${selectedClass?.name ?? 'this class'} to start entering marks.` : 'Assessments belong to a class and a subject.'}
              action={classId ? <Button size="sm" variant="primary" onClick={() => setEditorOpen(true)}><Plus className="h-3.5 w-3.5" aria-hidden />New assessment</Button> : undefined}
            />
          ) : (
            <ul className="divide-y divide-line/70">
              {examRows.map((exam) => (
                <li key={exam.id}>
                  <div className="flex flex-wrap items-center gap-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedExam(exam.id)}
                      className={cnRow(selectedExam === exam.id)}
                      aria-pressed={selectedExam === exam.id}
                    >
                      <span className="min-w-0 flex-1 text-left">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[0.8125rem] font-semibold text-ink">{exam.name}</span>
                          <Badge tone="neutral">IA {exam.examNumber}</Badge>
                          {selectedExam === exam.id ? <Badge tone="brand">Open</Badge> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {exam.subjectCode} · {exam.subjectName} · {exam.className} · {formatDate(exam.examDate, { day: '2-digit', month: 'short', year: 'numeric' })} · out of {exam.maxMarks}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tnum block text-sm font-semibold text-ink">
                          {exam.marksEntered}
                          <span className="text-xs font-normal text-muted">/{selectedClass?.studentCount ?? '?'}</span>
                        </span>
                        <span className="block text-2xs text-subtle">marks entered</span>
                      </span>
                    </button>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={`Edit ${exam.name}`}
                        onClick={() => {
                          setEditingExam(exam);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button size="xs" variant="ghost" className="text-danger-fg" aria-label={`Delete ${exam.name}`} onClick={() => setDeleteTarget(exam)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      {selectedExam ? (
        <Marksheet key={selectedExam} examId={selectedExam} sheet={sheet} onSaved={invalidate} />
      ) : null}

      <ExamEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        exam={editingExam}
        classId={classId}
        subjects={selectedClass?.subjects ?? []}
        onSaved={invalidate}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? 'this assessment'}?`}
        description={
          deleteTarget ? (
            <>
              This removes the assessment and <strong className="font-semibold text-ink">{deleteTarget.marksEntered}</strong> entered
              mark{deleteTarget.marksEntered === 1 ? '' : 's'} for {deleteTarget.className}. Class averages recalculate immediately.
            </>
          ) : null
        }
        confirmLabel="Delete assessment"
        onConfirm={removeExam}
      />
    </div>
  );
}

function cnRow(active: boolean) {
  return `stack-item flex min-w-0 flex-1 items-center gap-3 rounded-r-md pr-2 transition-colors hover:bg-raised/60 ${active ? 'before:bg-brand bg-brand-soft/40' : 'before:bg-line-strong'}`;
}

interface MarksheetProps {
  examId: string;
  sheet: ReturnType<typeof useApi<Sheet>>;
  onSaved: () => void;
}

function Marksheet({ examId, sheet, onSaved }: MarksheetProps) {
  const data = sheet.data?.data;
  const [values, setValues] = React.useState<Record<string, { marks: string; isAbsent: boolean; remarks: string }>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!data) return;
    setValues(
      Object.fromEntries(
        data.rows.map((row) => [
          row.studentId,
          { marks: row.marks === null ? '' : String(row.marks), isAbsent: row.isAbsent, remarks: row.remarks ?? '' },
        ]),
      ),
    );
    setError(null);
  }, [data]);

  const maxMarks = data?.exam.maxMarks ?? 50;

  const setAll = (marks: number) => {
    if (!data) return;
    setValues(Object.fromEntries(data.rows.map((row) => [row.studentId, { marks: String(marks), isAbsent: false, remarks: values[row.studentId]?.remarks ?? '' }])));
  };

  const dirty = React.useMemo(() => {
    if (!data) return false;
    return data.rows.some((row) => {
      const current = values[row.studentId];
      if (!current) return false;
      const stored = row.marks === null ? '' : String(row.marks);
      return current.marks !== stored || current.isAbsent !== row.isAbsent || (current.remarks ?? '') !== (row.remarks ?? '');
    });
  }, [data, values]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const entries = data.rows
        .map((row) => {
          const current = values[row.studentId];
          if (!current) return null;
          const marks = current.isAbsent ? null : current.marks.trim() === '' ? null : Number(current.marks);
          if (!current.isAbsent && (marks === null || Number.isNaN(marks))) {
            throw new Error(`Enter marks for ${row.firstName} ${row.lastName}, or mark them absent.`);
          }
          if (marks !== null && (marks < 0 || marks > maxMarks)) {
            throw new Error(`Marks for ${row.firstName} ${row.lastName} must be between 0 and ${maxMarks}.`);
          }
          return { studentId: row.studentId, marks, isAbsent: current.isAbsent, remarks: current.remarks?.trim() || null };
        })
        .filter(Boolean);

      await api.post(`/api/marks/${examId}/entries`, { entries });
      toastSuccess('Marks saved', `${entries.length} student records updated for ${data.exam.name}.`);
      onSaved();
      void sheet.refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Marks could not be saved.';
      setError(message);
      toastError(err, 'Marks were not saved.');
    } finally {
      setSaving(false);
    }
  };

  if (sheet.isLoading) {
    return (
      <Panel>
        <PanelBody>
          <SkeletonRows rows={8} />
        </PanelBody>
      </Panel>
    );
  }

  if (sheet.isError || !data) {
    return (
      <Panel>
        <ErrorState error={sheet.error} onRetry={() => sheet.refetch()} title="Could not load the marksheet" />
      </Panel>
    );
  }

  const columns: Column<MarksheetRow>[] = [
    {
      key: 'student',
      header: 'Student',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {row.firstName} {row.lastName}
          </p>
          <p className="truncate text-xs text-muted">
            {row.registerNumber}
            {row.rollNumber ? ` · Roll ${row.rollNumber}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'marks',
      header: `Marks (out of ${maxMarks})`,
      label: 'Marks',
      cell: (row) => {
        const current = values[row.studentId];
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={maxMarks}
              value={current?.marks ?? ''}
              disabled={current?.isAbsent}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  [row.studentId]: { ...(prev[row.studentId] ?? { isAbsent: false, remarks: '' }), marks: event.target.value },
                }))
              }
              onBlur={(event) => {
                const next = event.target.value === '' ? '' : String(clamp(Number(event.target.value), 0, maxMarks));
                setValues((prev) => ({ ...prev, [row.studentId]: { ...(prev[row.studentId] ?? { isAbsent: false, remarks: '' }), marks: next } }));
              }}
              className="input tnum h-9 w-20 px-2 text-center disabled:bg-line/40 disabled:text-subtle"
              aria-label={`Marks for ${row.firstName} ${row.lastName}`}
            />
            <Checkbox
              id={`absent-${row.studentId}`}
              label="Absent"
              checked={current?.isAbsent ?? false}
              onCheckedChange={(checked) =>
                setValues((prev) => ({
                  ...prev,
                  [row.studentId]: { ...(prev[row.studentId] ?? { marks: '', remarks: '' }), isAbsent: checked === true },
                }))
              }
            />
          </div>
        );
      },
    },
    {
      key: 'percentage',
      header: '%',
      align: 'right',
      label: 'Percentage',
      hideOnMobile: true,
      cell: (row) => {
        const current = values[row.studentId];
        if (current?.isAbsent) return <Badge tone="danger">Absent</Badge>;
        const marks = Number(current?.marks ?? '');
        if (!Number.isFinite(marks) || current?.marks === '') return <span className="text-xs text-subtle">—</span>;
        const pct = (clamp(marks, 0, maxMarks) / maxMarks) * 100;
        return (
          <span className="flex items-center justify-end gap-2">
            <ProgressBar value={pct} size="sm" className="w-14" tone={pct >= 70 ? 'ok' : pct >= 50 ? 'warn' : 'danger'} />
            <span className="tnum w-11 text-right text-sm font-semibold text-ink">{pct.toFixed(0)}%</span>
          </span>
        );
      },
    },
    {
      key: 'remarks',
      header: 'Remarks',
      label: 'Remarks',
      hideOnMobile: true,
      cell: (row) => (
        <input
          value={values[row.studentId]?.remarks ?? ''}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, [row.studentId]: { ...(prev[row.studentId] ?? { marks: '', isAbsent: false }), remarks: event.target.value } }))
          }
          maxLength={200}
          className="input h-9 w-full min-w-[9rem] text-xs"
          placeholder="Optional note"
          aria-label={`Remarks for ${row.firstName} ${row.lastName}`}
        />
      ),
    },
  ];

  return (
    <Panel>
      <PanelHeader
        title={`${data.exam.name} marksheet`}
        subtitle={`${data.exam.subjectCode} · ${data.exam.subjectName} · ${data.exam.className} · ${formatDate(data.exam.examDate, { day: '2-digit', month: 'short', year: 'numeric' })}`}
        icon={<BookOpen />}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setAll(maxMarks)}>
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              Full marks for all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAll(0)}>
              Zero for all
            </Button>
            <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={!dirty || saving}>
              <Save className="h-3.5 w-3.5" aria-hidden />
              {dirty ? 'Save marks' : 'Saved'}
            </Button>
          </div>
        }
      />

      <PanelBody className="border-b border-line bg-raised/60">
        <StatGrid columns={4}>
          <StatTile label="Entered" value={`${data.stats.entered}/${data.rows.length}`} tone={data.stats.entered === data.rows.length ? 'ok' : 'warn'} hint="Students with a mark" />
          <StatTile label="Class average" value={`${data.stats.average.toFixed(1)}`} tone="brand" hint={`Out of ${maxMarks}`} />
          <StatTile label="Highest" value={data.stats.highest} tone="ok" hint={`${((data.stats.highest / maxMarks) * 100).toFixed(0)}%`} />
          <StatTile label="Lowest" value={data.stats.lowest} tone={data.stats.lowest < maxMarks * 0.4 ? 'danger' : 'neutral'} hint={`${data.stats.absent} absent`} />
        </StatGrid>
      </PanelBody>

      {error ? (
        <PanelBody className="border-b border-line py-3">
          <Alert tone="danger" title="Marks were not saved" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </PanelBody>
      ) : null}

      {dirty ? (
        <PanelBody className="border-b border-line py-3">
          <Alert tone="warning" title="Unsaved changes">
            Marks are only written to the database when you press <strong className="font-semibold">Save marks</strong>. Navigating away
            discards them.
          </Alert>
        </PanelBody>
      ) : null}

      {data.rows.length === 0 ? (
        <EmptyState title="No students in this class" description="Add students to the class before entering marks." />
      ) : (
        <DataTable columns={columns} rows={data.rows} rowKey={(row) => row.studentId} dense />
      )}
    </Panel>
  );
}

function ExamEditor({
  open,
  onOpenChange,
  exam,
  classId,
  subjects,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamRow | null;
  classId: string;
  subjects: { id: string; code: string; name: string }[];
  onSaved: () => void;
}) {
  const [name, setName] = React.useState('');
  const [examNumber, setExamNumber] = React.useState('1');
  const [examDate, setExamDate] = React.useState(toDateInputValue(new Date()));
  const [maxMarks, setMaxMarks] = React.useState('50');
  const [subjectId, setSubjectId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (exam) {
      setName(exam.name);
      setExamNumber(String(exam.examNumber));
      setExamDate(toDateInputValue(exam.examDate));
      setMaxMarks(String(exam.maxMarks));
      setSubjectId(exam.subjectId);
    } else {
      setName('');
      setExamNumber('1');
      setExamDate(toDateInputValue(new Date()));
      setMaxMarks('50');
      setSubjectId(subjects[0]?.id ?? '');
    }
  }, [open, exam, subjects]);

  // Sensible defaults: the name follows the assessment number.
  React.useEffect(() => {
    if (exam || name) return;
    const number = Number(examNumber);
    if (Number.isFinite(number) && number > 0) setName(`IA-${number}`);
  }, [examNumber, exam, name]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      subjectId,
      classId,
      name,
      examNumber: Number(examNumber),
      examDate: new Date(`${examDate}T00:00:00.000Z`),
      maxMarks: Number(maxMarks),
    };
    const parsed = iaExamSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the assessment details.');
      setSaving(false);
      return;
    }
    try {
      if (exam) {
        await api.patch(`/api/marks/${exam.id}`, { name: parsed.data.name, examDate: parsed.data.examDate, maxMarks: parsed.data.maxMarks });
        toastSuccess('Assessment updated');
      } else {
        await api.post('/api/marks', parsed.data);
        toastSuccess('Assessment created', 'Open it to enter marks.');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That assessment could not be saved.';
      setError(message);
      toastError(err, 'The assessment was not saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title={exam ? `Edit ${exam.name}` : 'New internal assessment'} description={exam ? 'Changing the maximum rescales existing percentages.' : 'Assessments are unique per subject, class and number.'}>
        <div className="space-y-3">
          {error ? <Alert tone="danger" title="Could not save">{error}</Alert> : null}
          <Field label="Subject" htmlFor="exam-subject" required>
            <Select
              id="exam-subject"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              placeholder="Select a subject"
              disabled={Boolean(exam)}
              options={subjects.map((subject) => ({ value: subject.id, label: `${subject.code} — ${subject.name}` }))}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Name" htmlFor="exam-name" required>
              <Input id="exam-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="IA-1" maxLength={80} />
            </Field>
            <Field label="Assessment number" htmlFor="exam-number" required>
              <Input id="exam-number" type="number" min={1} max={10} value={examNumber} onChange={(event) => setExamNumber(event.target.value)} />
            </Field>
            <Field label="Maximum marks" htmlFor="exam-max" required>
              <Input id="exam-max" type="number" min={1} max={200} value={maxMarks} onChange={(event) => setMaxMarks(event.target.value)} />
            </Field>
          </div>
          <Field label="Exam date" htmlFor="exam-date" required>
            <Input id="exam-date" type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} loading={saving} disabled={saving || !subjectId || !name.trim()}>
            <Save className="h-3.5 w-3.5" aria-hidden />
            {exam ? 'Save changes' : 'Create assessment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
