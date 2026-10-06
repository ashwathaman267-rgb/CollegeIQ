import type { DayOfWeek } from '@prisma/client';

export interface BreakWindow {
  label: string;
  start: string; // "10:40"
  end: string; // "10:55"
}

export interface AttendanceThresholds {
  /** At or above this percentage a student is considered safe. */
  safe: number;
  /** Below this percentage a fine is applicable. */
  fine: number;
  /** Below this percentage a student is debarred from exams. */
  debar: number;
  /** Treat LATE as present when computing percentages. */
  countLateAsPresent: boolean;
}

export interface TimetableConfig {
  periodMinutes: number;
  /** A period shorter than this is dropped instead of truncated. */
  minPeriodMinutes: number;
  workStart: string;
  workEnd: string;
  breaks: BreakWindow[];
  workingDays: DayOfWeek[];
  /** Soft constraint: avoid more than N periods of one subject on a day. */
  maxSameSubjectPerDay: number;
  /** Labs get contiguous double periods. */
  labContiguous: boolean;
  /** Automatically allocate rooms/labs while generating. */
  autoAssignRooms: boolean;
  /** Attempts the generator makes before giving up on a class. */
  generationAttempts: number;
}

export interface AcademicConfig {
  semester: number;
  currentAcademicYearId: string | null;
  currentAcademicYearName: string | null;
  iaExamCount: number;
  passMarkPercentage: number;
}

export interface InstitutionConfig {
  name: string;
  shortName: string;
  tagline: string;
  address: string;
  email: string;
  phone: string;
  website: string;
}

export type AttendanceBandKey = 'SAFE' | 'AT_RISK' | 'FINE' | 'DEBARRED' | 'NO_DATA';

export interface AttendanceBand {
  key: AttendanceBandKey;
  label: string;
  short: string;
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  description: string;
}

export interface SettingsSnapshot {
  attendance: AttendanceThresholds;
  timetable: TimetableConfig;
  academic: AcademicConfig;
  institution: InstitutionConfig;
}
