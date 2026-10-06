import { z } from 'zod';

import { attendanceStatus, dayOfWeek, hhmm, optionalText } from './common';
import { isoDate } from './people';

/** Attendance marking, timetable generation/editing and institutional settings. */

export const attendanceRecordSchema = z.object({
  studentId: z.string().min(1),
  status: attendanceStatus,
  remarks: z.string().trim().max(160).optional(),
});

export const markAttendanceSchema = z.object({
  subjectId: z.string().min(1, 'Select a subject'),
  classId: z.string().min(1, 'Select a class'),
  date: isoDate,
  periodIndex: z.coerce.number().int().min(0).max(24),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
  topic: optionalText(160),
  notes: optionalText(400),
  status: z.enum(['COMPLETED', 'CANCELLED', 'SCHEDULED']).default('COMPLETED'),
  records: z.array(attendanceRecordSchema).min(1, 'Select at least one student').max(500),
});

export const rosterQuerySchema = z.object({
  classId: z.string().min(1, 'Select a class'),
  subjectId: z.string().min(1, 'Select a subject'),
  date: isoDate.optional(),
  periodIndex: z.coerce.number().int().min(0).max(24).optional(),
  sessionId: z.string().optional(),
});

export const attendanceFilterSchema = z.object({
  studentId: z.string().optional(),
  classId: z.string().optional(),
  subjectId: z.string().optional(),
  departmentId: z.string().optional(),
  facultyId: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: attendanceStatus.optional(),
});

export const generateTimetableSchema = z.object({
  classId: z.string().min(1, 'Select a class'),
  academicYearId: z.string().min(1, 'Select an academic year'),
  publish: z.boolean().optional(),
  seed: z.coerce.number().int().min(0).max(999999).optional(),
});

export const slotSchema = z.object({
  dayOfWeek: dayOfWeek,
  periodIndex: z.coerce.number().int().min(0).max(24),
  subjectId: z.string().nullish(),
  facultyId: z.string().nullish(),
  roomId: z.string().nullish(),
  laboratoryId: z.string().nullish(),
});

export const availabilityEntrySchema = z.object({
  dayOfWeek: dayOfWeek,
  periodIndex: z.coerce.number().int().min(0).max(24),
  isAvailable: z.boolean(),
  reason: optionalText(160),
});

export const availabilitySchema = z.object({ entries: z.array(availabilityEntrySchema).max(200) });

export const constraintSchema = z.object({
  constraintType: z.enum([
    'FACULTY_CONFLICT',
    'ROOM_CONFLICT',
    'LABORATORY_CONFLICT',
    'WEEKLY_REQUIREMENT',
    'BREAK_PROTECTION',
    'DISTRIBUTION',
    'MAX_CONSECUTIVE',
    'LAB_CONTIGUOUS',
    'AVAILABILITY',
    'CUSTOM',
  ]),
  severity: z.enum(['ERROR', 'WARNING', 'INFO']).default('ERROR'),
  description: optionalText(300),
  isActive: z.boolean().default(true),
});

export const breakWindowSchema = z.object({
  label: z.string().trim().min(1, 'Label the break').max(40),
  start: hhmm,
  end: hhmm,
}).refine((b) => b.end > b.start, { message: 'The break must end after it starts', path: ['end'] });

export const timetableConfigSchema = z.object({
  periodMinutes: z.coerce.number().int().min(20).max(120),
  minPeriodMinutes: z.coerce.number().int().min(10).max(120),
  workStart: hhmm,
  workEnd: hhmm,
  breaks: z.array(breakWindowSchema).max(8),
  workingDays: z.array(dayOfWeek).min(1, 'Select at least one working day').max(7),
  maxSameSubjectPerDay: z.coerce.number().int().min(1).max(8),
  labContiguous: z.boolean(),
  autoAssignRooms: z.boolean(),
  generationAttempts: z.coerce.number().int().min(1).max(500),
}).superRefine((config, ctx) => {
  if (config.workEnd <= config.workStart) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The working day must end after it starts', path: ['workEnd'] });
  }
  if (config.minPeriodMinutes > config.periodMinutes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum period cannot exceed the period length', path: ['minPeriodMinutes'] });
  }
  const sorted = [...config.breaks].sort((a, b) => a.start.localeCompare(b.start));
  sorted.forEach((b, i) => {
    if (b.start < config.workStart || b.end > config.workEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${b.label} falls outside the working day`, path: ['breaks', i] });
    }
    const next = sorted[i + 1];
    if (next && next.start < b.end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${b.label} overlaps ${next.label}`, path: ['breaks', i + 1] });
    }
  });
});

export const attendanceThresholdSchema = z.object({
  safe: z.coerce.number().int().min(1).max(100),
  fine: z.coerce.number().int().min(1).max(100),
  debar: z.coerce.number().int().min(1).max(100),
  countLateAsPresent: z.boolean().default(true),
}).superRefine((t, ctx) => {
  if (!(t.debar <= t.fine && t.fine <= t.safe)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Thresholds must follow debar ≤ fine ≤ safe', path: ['safe'] });
  }
});

export const academicConfigSchema = z.object({
  semester: z.coerce.number().int().min(1).max(12),
  currentAcademicYearId: z.string().nullish(),
  iaExamCount: z.coerce.number().int().min(1).max(6),
  passMarkPercentage: z.coerce.number().int().min(10).max(95),
});

export const institutionSchema = z.object({
  name: z.string().trim().min(2, 'Institution name is required').max(120),
  shortName: z.string().trim().min(1).max(20),
  tagline: z.string().trim().max(120).optional(),
  address: z.string().trim().max(240).optional(),
  email: z.string().trim().email('Enter a valid email').max(160).optional(),
  phone: z.string().trim().max(30).optional(),
  website: z.string().trim().max(200).optional(),
});

export const settingsUpdateSchema = z.object({
  attendance: attendanceThresholdSchema.optional(),
  timetable: timetableConfigSchema.optional(),
  academic: academicConfigSchema.optional(),
  institution: institutionSchema.optional(),
}).refine((v) => Object.values(v).some(Boolean), { message: 'Nothing to save yet' });

export const notificationPreferenceSchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  type: z.enum(['ATTENDANCE_ALERT', 'RESULT_PUBLISHED', 'TIMETABLE_UPDATED', 'CAREER_INSIGHT', 'ACADEMIC', 'SYSTEM']).optional(),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type TimetableConfigInput = z.infer<typeof timetableConfigSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
