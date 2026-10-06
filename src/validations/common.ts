import { z } from 'zod';

/** Shared building blocks used by every other schema. */

export const cuid = z.string().min(1, 'This field is required.');

export const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the 24-hour HH:MM format');

export const DAY_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export const dayOfWeek = z.enum(DAY_OF_WEEK);

export const ATTENDANCE_STATUS = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
export const attendanceStatus = z.enum(ATTENDANCE_STATUS);

export const ROLES = ['STUDENT', 'FACULTY', 'ADMIN'] as const;
export const role = z.enum(ROLES);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().max(120).optional(),
  sortBy: z.string().trim().max(60).optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** Strip undefined/empty strings so PATCH bodies behave predictably. */
export const trimmedString = (max: number, label = 'value') =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` }).trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const optionalNumber = (min: number, max: number) =>
  z.coerce.number({ invalid_type_error: 'Enter a number' }).min(min).max(max).nullish().transform((v) => (v ?? null));

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(160);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[0-9\s()-]{7,20}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal(''));

export const urlSchema = z.string().trim().url('Enter a valid URL').max(500).optional().or(z.literal(''));

export const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'on', 'off'])])
  .transform((v) => (typeof v === 'boolean' ? v : ['true', '1', 'on'].includes(v)));

export type Pagination = z.infer<typeof paginationSchema>;
