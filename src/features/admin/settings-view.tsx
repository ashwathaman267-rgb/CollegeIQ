'use client';

import * as React from 'react';
import { CalendarClock, GraduationCap, Info, Save, ShieldAlert, SlidersHorizontal } from 'lucide-react';

import { api } from '@/lib/api-client';
import { DAY_ORDER, formatClock } from '@/lib/format';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import type { SettingsSnapshot } from '@/types/settings';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Switch } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import {
  academicConfigSchema,
  attendanceThresholdSchema,
  institutionSchema,
  timetableConfigSchema,
} from '@/validations';

/**
 * Centralized institution settings: attendance thresholds, timetable timing,
 * academic configuration and the institution profile. Only administrators
 * can write; everyone else sees a read-only view.
 */
export function SettingsView() {
  const { user } = useSession();
  const settings = useApi<SettingsSnapshot>('/api/settings');
  const isAdmin = user?.role === 'ADMIN';

  const data = settings.data?.data;

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          isAdmin
            ? 'Institution-wide configuration. Changes apply immediately and are recorded in the audit log.'
            : 'Institution-wide configuration. Ask an administrator to make changes.'
        }
        icon={<SlidersHorizontal />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Settings' }]}
      />

      {!isAdmin ? (
        <div className="mt-5">
          <Alert tone="warning" title="Read-only" icon={<ShieldAlert />}>
            You can review the institution's configuration here, but only administrators can change it. Your own preferences (theme,
            password, sessions) live under <span className="font-medium text-ink">Profile</span>.
          </Alert>
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        {settings.isLoading ? (
          <p className="py-10 text-center text-sm text-muted">Loading settings…</p>
        ) : settings.error || !data ? (
          <p className="py-10 text-center text-sm text-muted">Could not load settings.</p>
        ) : (
          <>
            <AttendanceSettings values={data.attendance} readOnly={!isAdmin} />
            <TimetableSettings values={data.timetable} readOnly={!isAdmin} />
            <AcademicSettings values={data.academic} readOnly={!isAdmin} />
            <InstitutionSettings values={data.institution} readOnly={!isAdmin} />
          </>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function AttendanceSettings({
  values,
  readOnly,
}: {
  values: SettingsSnapshot['attendance'];
  readOnly: boolean;
}) {
  const [safe, setSafe] = React.useState(String(values.safe));
  const [fine, setFine] = React.useState(String(values.fine));
  const [debar, setDebar] = React.useState(String(values.debar));
  const [countLateAsPresent, setCountLateAsPresent] = React.useState(values.countLateAsPresent);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const invalidate = useInvalidate();

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = attendanceThresholdSchema.safeParse({
      safe: Number(safe),
      fine: Number(fine),
      debar: Number(debar),
      countLateAsPresent,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'The thresholds are invalid.');
      return;
    }

    setBusy(true);
    try {
      await api.patch('/api/settings', { attendance: parsed.data });
      invalidate('/api/settings', '/api/dashboard', '/api/attendance', '/api/analytics');
      toastSuccess('Attendance thresholds saved', `Safe ≥ ${parsed.data.safe}% · fine < ${parsed.data.fine}% · debarred < ${parsed.data.debar}%.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the attendance settings.');
      toastError(err, 'Could not save the attendance settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Attendance thresholds"
        subtitle="The bands every student is judged against — dashboards, at-risk lists and warnings all use these numbers."
        icon={<SlidersHorizontal />}
        actions={readOnly ? <Badge tone="neutral">Read only</Badge> : null}
      />
      <PanelBody>
        {readOnly ? (
          <BandsView values={values} />
        ) : (
          <form onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Safe from (≥)" htmlFor="att-safe" hint="At or above this percentage a student is safe.">
                <Input id="att-safe" type="number" min={1} max={100} value={safe} onChange={(e) => setSafe(e.target.value)} />
              </Field>
              <Field label="Fine below (<)" htmlFor="att-fine" hint="Below this a fine is applicable.">
                <Input id="att-fine" type="number" min={1} max={100} value={fine} onChange={(e) => setFine(e.target.value)} />
              </Field>
              <Field label="Debarred below (<)" htmlFor="att-debar" hint="Below this, exam debarment applies.">
                <Input id="att-debar" type="number" min={1} max={100} value={debar} onChange={(e) => setDebar(e.target.value)} />
              </Field>
            </div>
            <Checkbox
              id="att-late"
              label="Count LATE as present when computing percentages"
              checked={countLateAsPresent}
              onCheckedChange={(checked) => setCountLateAsPresent(Boolean(checked))}
            />
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" loading={busy}>
                <Save className="h-4 w-4" aria-hidden />
                Save thresholds
              </Button>
            </div>
          </form>
        )}
      </PanelBody>
    </Panel>
  );
}

function BandsView({ values }: { values: SettingsSnapshot['attendance'] }) {
  const bands = [
    { label: `≥ ${values.safe}% — Safe`, tone: 'ok' as const },
    { label: `${values.fine}–${values.safe - 1}% — At risk`, tone: 'warn' as const },
    { label: `${values.debar}–${values.fine - 1}% — Fine applicable`, tone: 'info' as const },
    { label: `< ${values.debar}% — Debarred`, tone: 'danger' as const },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {bands.map((band) => (
          <Badge key={band.label} tone={band.tone}>
            {band.label}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted">
        Late is {values.countLateAsPresent ? 'counted as present' : 'not counted as present'} when computing percentages.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

interface BreakDraft {
  label: string;
  start: string;
  end: string;
}

function TimetableSettings({ values, readOnly }: { values: SettingsSnapshot['timetable']; readOnly: boolean }) {
  const [periodMinutes, setPeriodMinutes] = React.useState(String(values.periodMinutes));
  const [minPeriodMinutes, setMinPeriodMinutes] = React.useState(String(values.minPeriodMinutes));
  const [workStart, setWorkStart] = React.useState(values.workStart);
  const [workEnd, setWorkEnd] = React.useState(values.workEnd);
  const [breaks, setBreaks] = React.useState<BreakDraft[]>(values.breaks.map((b) => ({ ...b })));
  const [workingDays, setWorkingDays] = React.useState<string[]>(values.workingDays);
  const [maxSameSubjectPerDay, setMaxSameSubjectPerDay] = React.useState(String(values.maxSameSubjectPerDay));
  const [labContiguous, setLabContiguous] = React.useState(values.labContiguous);
  const [autoAssignRooms, setAutoAssignRooms] = React.useState(values.autoAssignRooms);
  const [generationAttempts, setGenerationAttempts] = React.useState(String(values.generationAttempts));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const invalidate = useInvalidate();

  const toggleDay = (day: string) =>
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const setBreak = (index: number, patch: Partial<BreakDraft>) =>
    setBreaks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = timetableConfigSchema.safeParse({
      periodMinutes: Number(periodMinutes),
      minPeriodMinutes: Number(minPeriodMinutes),
      workStart,
      workEnd,
      breaks,
      workingDays,
      maxSameSubjectPerDay: Number(maxSameSubjectPerDay),
      labContiguous,
      autoAssignRooms,
      generationAttempts: Number(generationAttempts),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'The timetable configuration is invalid.');
      return;
    }

    setBusy(true);
    try {
      await api.patch('/api/settings', { timetable: parsed.data });
      invalidate('/api/settings', '/api/timetable');
      toastSuccess('Timetable settings saved', 'New generations will follow this schedule immediately.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the timetable settings.');
      toastError(err, 'Could not save the timetable settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Timetable timing"
        subtitle="The working day, breaks and generator behaviour. The weekly grid is rebuilt from these values."
        icon={<CalendarClock />}
        actions={readOnly ? <Badge tone="neutral">Read only</Badge> : null}
      />
      <PanelBody>
        {readOnly ? (
          <div className="space-y-3 text-sm">
            <p className="text-ink">
              Day runs <span className="tnum">{formatClock(values.workStart)}–{formatClock(values.workEnd)}</span> with{' '}
              <span className="tnum">{values.periodMinutes}-minute</span> periods (minimum {values.minPeriodMinutes}).
            </p>
            <p className="text-muted">
              Breaks: {values.breaks.map((b) => `${b.label} ${formatClock(b.start)}–${formatClock(b.end)}`).join(' · ') || 'none'}
            </p>
            <p className="text-muted">Working days: {values.workingDays.map((d) => DAY_ORDER[Number(d) - 1]).join(', ')}</p>
            <p className="text-muted">
              Soft constraints: max {values.maxSameSubjectPerDay} of the same subject per day · labs{' '}
              {values.labContiguous ? 'placed as contiguous doubles' : 'may split'} · rooms {values.autoAssignRooms ? 'auto-assigned' : 'manually assigned'} ·{' '}
              up to {values.generationAttempts} attempts per class.
            </p>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Period length (minutes)" htmlFor="tt-period">
                <Input id="tt-period" type="number" min={20} max={120} value={periodMinutes} onChange={(e) => setPeriodMinutes(e.target.value)} />
              </Field>
              <Field label="Minimum period (minutes)" htmlFor="tt-min" hint="Shorter leftover periods are dropped.">
                <Input id="tt-min" type="number" min={10} max={120} value={minPeriodMinutes} onChange={(e) => setMinPeriodMinutes(e.target.value)} />
              </Field>
              <Field label="Day starts" htmlFor="tt-start">
                <Input id="tt-start" type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
              </Field>
              <Field label="Day ends" htmlFor="tt-end">
                <Input id="tt-end" type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
              </Field>
            </div>

            <div>
              <p className="field-label mb-2">Breaks</p>
              <div className="space-y-2">
                {breaks.map((break_, index) => (
                  <div key={index} className="grid grid-cols-[1fr_90px_90px_36px] items-end gap-2 rounded-md border border-line bg-raised p-2.5">
                    <Field label="Label" htmlFor={`tt-break-label-${index}`}>
                      <Input id={`tt-break-label-${index}`} value={break_.label} onChange={(e) => setBreak(index, { label: e.target.value })} maxLength={40} />
                    </Field>
                    <Field label="Starts" htmlFor={`tt-break-start-${index}`}>
                      <Input id={`tt-break-start-${index}`} type="time" value={break_.start} onChange={(e) => setBreak(index, { start: e.target.value })} />
                    </Field>
                    <Field label="Ends" htmlFor={`tt-break-end-${index}`}>
                      <Input id={`tt-break-end-${index}`} type="time" value={break_.end} onChange={(e) => setBreak(index, { end: e.target.value })} />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconSm"
                      aria-label={`Remove ${break_.label}`}
                      onClick={() => setBreaks((prev) => prev.filter((_, i) => i !== index))}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                className="mt-2"
                onClick={() => setBreaks((prev) => [...prev, { label: 'Break', start: workEnd, end: workEnd }])}
              >
                Add break
              </Button>
            </div>

            <div>
              <p className="field-label mb-2">Working days</p>
              <div className="flex flex-wrap gap-2">
                {DAY_ORDER.map((day) => (
                  <label
                    key={day}
                    className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      workingDays.includes(day) ? 'border-brand/40 bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-ink'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={workingDays.includes(day)}
                      onChange={() => toggleDay(day)}
                    />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Max same subject per day" htmlFor="tt-maxday">
                <Input id="tt-maxday" type="number" min={1} max={8} value={maxSameSubjectPerDay} onChange={(e) => setMaxSameSubjectPerDay(e.target.value)} />
              </Field>
              <Field label="Generation attempts per class" htmlFor="tt-attempts">
                <Input id="tt-attempts" type="number" min={1} max={500} value={generationAttempts} onChange={(e) => setGenerationAttempts(e.target.value)} />
              </Field>
            </div>

            <div className="space-y-2">
              <Switch id="tt-lab" label="Place laboratory periods as contiguous doubles" checked={labContiguous} onCheckedChange={(checked) => setLabContiguous(Boolean(checked))} />
              <Switch id="tt-rooms" label="Auto-assign rooms and laboratories while generating" checked={autoAssignRooms} onCheckedChange={(checked) => setAutoAssignRooms(Boolean(checked))} />
            </div>

            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" loading={busy}>
                <Save className="h-4 w-4" aria-hidden />
                Save timetable settings
              </Button>
            </div>
          </form>
        )}
      </PanelBody>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function AcademicSettings({ values, readOnly }: { values: SettingsSnapshot['academic']; readOnly: boolean }) {
  const [semester, setSemester] = React.useState(String(values.semester));
  const [currentYearId, setCurrentYearId] = React.useState(values.currentAcademicYearId ?? '');
  const [iaExamCount, setIaExamCount] = React.useState(String(values.iaExamCount));
  const [passMarkPercentage, setPassMarkPercentage] = React.useState(String(values.passMarkPercentage));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const invalidate = useInvalidate();

  const years = useApi<{ id: string; name: string; isCurrent: boolean }[]>('/api/academic-years', undefined, { enabled: !readOnly });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = academicConfigSchema.safeParse({
      semester: Number(semester),
      currentAcademicYearId: currentYearId || null,
      iaExamCount: Number(iaExamCount),
      passMarkPercentage: Number(passMarkPercentage),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'The academic configuration is invalid.');
      return;
    }

    setBusy(true);
    try {
      await api.patch('/api/settings', { academic: parsed.data });
      invalidate('/api/settings', '/api/dashboard', '/api/academics');
      toastSuccess('Academic settings saved', 'Semester and exam structure updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the academic settings.');
      toastError(err, 'Could not save the academic settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Academic configuration"
        subtitle="Which semester is running, which year is current, how many IAs exist and what counts as a pass."
        icon={<GraduationCap />}
        actions={readOnly ? <Badge tone="neutral">Read only</Badge> : null}
      />
      <PanelBody>
        {readOnly ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p className="text-ink">
              Running semester: <span className="font-semibold">Semester {values.semester}</span>
            </p>
            <p className="text-ink">
              Current academic year: <span className="font-semibold">{values.currentAcademicYearName ?? 'Not set'}</span>
            </p>
            <p className="text-ink">
              Internal assessments: <span className="font-semibold">IA {Array.from({ length: values.iaExamCount }, (_, i) => i + 1).join(', ')}</span>
            </p>
            <p className="text-ink">
              Pass mark: <span className="font-semibold">{values.passMarkPercentage}%</span>
            </p>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Running semester" htmlFor="ac-sem">
                <Input id="ac-sem" type="number" min={1} max={12} value={semester} onChange={(e) => setSemester(e.target.value)} />
              </Field>
              <Field label="Current academic year" htmlFor="ac-year">
                <select
                  id="ac-year"
                  className="select"
                  value={currentYearId}
                  onChange={(e) => setCurrentYearId(e.target.value)}
                  disabled={years.isLoading}
                >
                  <option value="">{values.currentAcademicYearName ? `Keep ${values.currentAcademicYearName}` : 'Not set'}</option>
                  {(years.data?.data ?? []).map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.isCurrent ? ' · current' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Number of IA exams" htmlFor="ac-ia" hint="IA-1, IA-2, …">
                <Input id="ac-ia" type="number" min={1} max={6} value={iaExamCount} onChange={(e) => setIaExamCount(e.target.value)} />
              </Field>
              <Field label="Pass mark (%)" htmlFor="ac-pass">
                <Input id="ac-pass" type="number" min={10} max={95} value={passMarkPercentage} onChange={(e) => setPassMarkPercentage(e.target.value)} />
              </Field>
            </div>
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" loading={busy}>
                <Save className="h-4 w-4" aria-hidden />
                Save academic settings
              </Button>
            </div>
          </form>
        )}
      </PanelBody>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function InstitutionSettings({ values, readOnly }: { values: SettingsSnapshot['institution']; readOnly: boolean }) {
  const [name, setName] = React.useState(values.name);
  const [shortName, setShortName] = React.useState(values.shortName);
  const [tagline, setTagline] = React.useState(values.tagline);
  const [address, setAddress] = React.useState(values.address);
  const [email, setEmail] = React.useState(values.email);
  const [phone, setPhone] = React.useState(values.phone);
  const [website, setWebsite] = React.useState(values.website);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const invalidate = useInvalidate();

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = institutionSchema.safeParse({
      name,
      shortName,
      tagline: tagline || undefined,
      address: address || undefined,
      email: email || undefined,
      phone: phone || undefined,
      website: website || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'The institution profile is invalid.');
      return;
    }

    setBusy(true);
    try {
      await api.patch('/api/settings', { institution: parsed.data });
      invalidate('/api/settings', '/api/auth/session');
      toastSuccess('Institution profile saved', 'The new name appears across the app.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the institution profile.');
      toastError(err, 'Could not save the institution profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Institution profile"
        subtitle="The identity shown in the sidebar, header and every exported timetable."
        icon={<Info />}
        actions={readOnly ? <Badge tone="neutral">Read only</Badge> : null}
      />
      <PanelBody>
        {readOnly ? (
          <div className="space-y-1 text-sm">
            <p className="text-base font-semibold text-ink">{values.name}</p>
            {values.tagline ? <p className="text-muted">{values.tagline}</p> : null}
            <p className="text-muted">{[values.address, values.phone, values.email].filter(Boolean).join(' · ') || 'No contact details set'}</p>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Institution name" htmlFor="inst-name" required>
                <Input id="inst-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Short name" htmlFor="inst-short" hint="Used in the sidebar.">
                <Input id="inst-short" value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={20} />
              </Field>
              <Field label="Tagline" htmlFor="inst-tagline">
                <Input id="inst-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} />
              </Field>
              <Field label="Website" htmlFor="inst-website">
                <Input id="inst-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="inst-email">
                <Input id="inst-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Phone" htmlFor="inst-phone">
                <Input id="inst-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
            <Field label="Address" htmlFor="inst-address">
              <Input id="inst-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" loading={busy}>
                <Save className="h-4 w-4" aria-hidden />
                Save profile
              </Button>
            </div>
          </form>
        )}
      </PanelBody>
    </Panel>
  );
}
