import type { DayOfWeek } from '@prisma/client';

import { prisma } from '@/lib/db';
import { clamp } from '@/lib/utils';
import { audit } from './audit.service';
import type {
  AcademicConfig,
  AttendanceBand,
  AttendanceThresholds,
  InstitutionConfig,
  SettingsSnapshot,
  TimetableConfig,
} from '@/types/settings';

/**
 * Institutional configuration lives in the database, never in code.
 * These defaults mirror the specification used by the source problem statement
 * (50-minute periods, 8-hour day, three configured breaks) and are what a fresh
 * installation gets before an administrator changes anything.
 */
export const DEFAULT_ATTENDANCE: AttendanceThresholds = {
  safe: 80,
  fine: 75,
  debar: 70,
  countLateAsPresent: true,
};

export const DEFAULT_TIMETABLE: TimetableConfig = {
  periodMinutes: 50,
  minPeriodMinutes: 40,
  workStart: '09:00',
  workEnd: '17:00',
  breaks: [
    { label: 'Morning Break', start: '10:40', end: '10:55' },
    { label: 'Lunch', start: '12:35', end: '13:15' },
    { label: 'Evening Break', start: '14:50', end: '15:00' },
  ],
  workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as DayOfWeek[],
  maxSameSubjectPerDay: 2,
  labContiguous: true,
  autoAssignRooms: true,
  generationAttempts: 60,
};

export const DEFAULT_ACADEMIC: Omit<AcademicConfig, 'currentAcademicYearId' | 'currentAcademicYearName'> = {
  semester: 5,
  iaExamCount: 2,
  passMarkPercentage: 50,
};

export const DEFAULT_INSTITUTION: InstitutionConfig = {
  name: 'St. Xavier Institute of Technology',
  shortName: 'SXIT',
  tagline: 'Intelligent Solutions for a Smarter Campus',
  address: 'Campus Road, Coimbatore, Tamil Nadu 641021',
  email: 'office@campusiq.edu.in',
  phone: '+91 422 255 0100',
  website: 'https://campusiq.edu.in',
};

export const SETTINGS_KEYS = {
  attendance: 'attendance.thresholds',
  timetable: 'timetable.config',
  academic: 'academic.config',
  institution: 'institution.profile',
} as const;

const CATEGORY: Record<string, string> = {
  [SETTINGS_KEYS.attendance]: 'attendance',
  [SETTINGS_KEYS.timetable]: 'timetable',
  [SETTINGS_KEYS.academic]: 'academic',
  [SETTINGS_KEYS.institution]: 'institution',
};

const DESCRIPTIONS: Record<string, string> = {
  [SETTINGS_KEYS.attendance]: 'Safe / fine / debar attendance thresholds',
  [SETTINGS_KEYS.timetable]: 'Period length, working hours and break windows',
  [SETTINGS_KEYS.academic]: 'Active semester and assessment rules',
  [SETTINGS_KEYS.institution]: 'Institution name and contact details',
};

interface CacheEntry {
  value: SettingsSnapshot;
  expiresAt: number;
}
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30_000;

export function invalidateSettingsCache() {
  cache = null;
}

function merge<T extends object>(base: T, override: unknown): T {
  if (!override || typeof override !== 'object') return base;
  return { ...base, ...(override as Partial<T>) };
}

/** Read all settings, merging stored values over the documented defaults. */
export async function getSettings(): Promise<SettingsSnapshot> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(SETTINGS_KEYS) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const academicStored = (byKey.get(SETTINGS_KEYS.academic) ?? {}) as Partial<AcademicConfig>;

  const currentYear =
    (academicStored.currentAcademicYearId
      ? await prisma.academicYear.findUnique({
          where: { id: academicStored.currentAcademicYearId },
          select: { id: true, name: true },
        })
      : null) ??
    (await prisma.academicYear.findFirst({
      where: { isCurrent: true },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true },
    }));

  const value: SettingsSnapshot = {
    attendance: normaliseThresholds(merge(DEFAULT_ATTENDANCE, byKey.get(SETTINGS_KEYS.attendance))),
    timetable: normaliseTimetable(merge(DEFAULT_TIMETABLE, byKey.get(SETTINGS_KEYS.timetable))),
    academic: {
      ...merge(DEFAULT_ACADEMIC, academicStored),
      currentAcademicYearId: currentYear?.id ?? null,
      currentAcademicYearName: currentYear?.name ?? null,
    },
    institution: merge(DEFAULT_INSTITUTION, byKey.get(SETTINGS_KEYS.institution)),
  };

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export function normaliseThresholds(input: Partial<AttendanceThresholds>): AttendanceThresholds {
  const safe = clamp(Number(input.safe ?? DEFAULT_ATTENDANCE.safe), 50, 100);
  const fine = clamp(Number(input.fine ?? DEFAULT_ATTENDANCE.fine), 40, safe);
  const debar = clamp(Number(input.debar ?? DEFAULT_ATTENDANCE.debar), 30, fine);
  return {
    safe,
    fine,
    debar,
    countLateAsPresent: input.countLateAsPresent ?? DEFAULT_ATTENDANCE.countLateAsPresent,
  };
}

export function normaliseTimetable(input: Partial<TimetableConfig>): TimetableConfig {
  const periodMinutes = clamp(Number(input.periodMinutes ?? 50), 20, 120);
  return {
    periodMinutes,
    minPeriodMinutes: clamp(Number(input.minPeriodMinutes ?? 40), 15, periodMinutes),
    workStart: input.workStart ?? DEFAULT_TIMETABLE.workStart,
    workEnd: input.workEnd ?? DEFAULT_TIMETABLE.workEnd,
    breaks: Array.isArray(input.breaks) ? input.breaks : DEFAULT_TIMETABLE.breaks,
    workingDays: Array.isArray(input.workingDays) && input.workingDays.length > 0
      ? input.workingDays
      : DEFAULT_TIMETABLE.workingDays,
    maxSameSubjectPerDay: clamp(Number(input.maxSameSubjectPerDay ?? 2), 1, 6),
    labContiguous: input.labContiguous ?? true,
    autoAssignRooms: input.autoAssignRooms ?? true,
    generationAttempts: clamp(Number(input.generationAttempts ?? 60), 5, 400),
  };
}

/** Classify a percentage against the configured institutional rules. */
export function attendanceBand(percentage: number | null | undefined, t: AttendanceThresholds): AttendanceBand {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) {
    return {
      key: 'NO_DATA',
      label: 'No data yet',
      short: 'No data',
      tone: 'neutral',
      description: 'Attendance has not been recorded for this subject yet.',
    };
  }
  if (percentage >= t.safe) {
    return {
      key: 'SAFE',
      label: 'Healthy',
      short: 'Safe',
      tone: 'ok',
      description: `At or above the ${t.safe}% safe threshold.`,
    };
  }
  if (percentage >= t.fine) {
    return {
      key: 'AT_RISK',
      label: 'At risk',
      short: 'Risk',
      tone: 'warn',
      description: `Below ${t.safe}% — attendance needs attention.`,
    };
  }
  if (percentage >= t.debar) {
    return {
      key: 'FINE',
      label: 'Fine applicable',
      short: 'Fine',
      tone: 'warn',
      description: `Below ${t.fine}% — attendance fine applies.`,
    };
  }
  return {
    key: 'DEBARRED',
    label: 'Debarred',
    short: 'Debar',
    tone: 'danger',
    description: `Below ${t.debar}% — not eligible to sit the examination.`,
  };
}

/**
 * How many more classes a student must attend (consecutively) to climb out of a
 * band — the number shown on the student dashboard.
 */
export function classesNeededToReach(current: number, target: number, present: number, total: number) {
  if (total === 0) return 0;
  if (current >= target) return 0;
  let p = present;
  let t = total;
  for (let n = 1; n <= 200; n += 1) {
    p += 1;
    t += 1;
    if ((p / t) * 100 >= target) return n;
  }
  return 200;
}

export interface SettingUpdate {
  key: keyof typeof SETTINGS_KEYS;
  value: unknown;
}

/** Persist a settings change, audit it and bust the cache. */
export async function updateSettings(
  updates: SettingUpdate[],
  actor: { id: string; ipAddress?: string | null; userAgent?: string | null },
) {
  const changes: { key: string; before: unknown; after: unknown }[] = [];

  for (const update of updates) {
    const key = SETTINGS_KEYS[update.key];
    if (!key) continue;
    const existing = await prisma.systemSetting.findUnique({ where: { key } });
    const before = existing?.value ?? null;

    const normalised =
      key === SETTINGS_KEYS.attendance
        ? normaliseThresholds(update.value as Partial<AttendanceThresholds>)
        : key === SETTINGS_KEYS.timetable
          ? normaliseTimetable(update.value as Partial<TimetableConfig>)
          : update.value;

    await prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: normalised as object,
        category: CATEGORY[key] ?? 'general',
        description: DESCRIPTIONS[key],
        updatedById: actor.id,
        isPublic: key === SETTINGS_KEYS.institution,
      },
      update: { value: normalised as object, updatedById: actor.id },
    });

    changes.push({ key, before, after: normalised });
  }

  for (const change of changes) {
    audit({
      action: 'settings.update',
      resourceType: 'SystemSetting',
      resourceId: change.key,
      description: `Updated ${change.key}`,
      previousValue: change.before,
      newValue: change.after,
      userId: actor.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }

  invalidateSettingsCache();
  return getSettings();
}

/** Settings safe to expose to the browser (thresholds drive client-side UI). */
export async function getPublicSettings(): Promise<SettingsSnapshot> {
  return getSettings();
}
