import { z } from 'zod';

import { emailSchema, optionalText } from './common';
import { passwordSchema } from './auth';

/** People & academic-structure CRUD schemas (students, faculty, departments, subjects, classes, rooms, labs). */

export const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']);
export const accountStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED']);
export const subjectTypeEnum = z.enum(['THEORY', 'LABORATORY', 'ELECTIVE', 'PROJECT', 'SEMINAR']);
export const roomTypeEnum = z.enum(['CLASSROOM', 'LABORATORY', 'AUDITORIUM', 'SEMINAR_HALL']);

export const isoDate = z.coerce.date({ invalid_type_error: 'Enter a valid date' });

export const studentSchema = z.object({
  firstName: z.string().trim().min(2, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email: emailSchema,
  password: passwordSchema.optional(),
  registerNumber: z
    .string()
    .trim()
    .min(3, 'Register number is required')
    .max(20)
    .regex(/^[A-Za-z0-9/-]+$/, 'Letters, numbers, hyphens and slashes only')
    .transform((v) => v.toUpperCase()),
  rollNumber: z.string().trim().max(20).optional(),
  departmentId: z.string().min(1, 'Select a department'),
  classId: z.string().nullish(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  admissionYear: z.coerce.number().int().min(1980).max(2100).optional(),
  gender: genderEnum.optional(),
  dateOfBirth: isoDate.nullish(),
  phone: z.string().trim().max(20).optional(),
  address: optionalText(200),
  city: optionalText(60),
  guardianName: optionalText(80),
  guardianPhone: optionalText(20),
  bloodGroup: optionalText(8),
  batch: optionalText(20),
  cgpa: z.coerce.number().min(0).max(10).nullish(),
  academicStatus: accountStatusEnum.optional(),
});

export const studentUpdateSchema = studentSchema.partial().extend({
  registerNumber: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9/-]+$/)
    .transform((v) => v.toUpperCase())
    .optional(),
});

export const facultySchema = z.object({
  firstName: z.string().trim().min(2, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email: emailSchema,
  password: passwordSchema.optional(),
  employeeId: z
    .string()
    .trim()
    .min(2, 'Employee ID is required')
    .max(20)
    .regex(/^[A-Za-z0-9/-]+$/)
    .transform((v) => v.toUpperCase()),
  departmentId: z.string().min(1, 'Select a department'),
  designation: z.string().trim().max(80).optional(),
  specialization: z.string().trim().max(120).optional(),
  qualification: z.string().trim().max(120).optional(),
  experienceYears: z.coerce.number().int().min(0).max(60).optional(),
  gender: genderEnum.optional(),
  joinedOn: isoDate.nullish(),
  phone: z.string().trim().max(20).optional(),
  subjectIds: z.array(z.string()).max(30).optional(),
  academicStatus: accountStatusEnum.optional(),
});

export const facultyUpdateSchema = facultySchema.partial().extend({
  employeeId: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9/-]+$/).transform((v) => v.toUpperCase()).optional(),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name is required').max(80),
  code: z
    .string()
    .trim()
    .min(2, 'Department code is required')
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, 'Letters and numbers only')
    .transform((v) => v.toUpperCase()),
  description: optionalText(400),
  building: optionalText(80),
  headOfDepartmentId: z.string().nullish(),
});

export const subjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Subject code is required')
    .max(16)
    .regex(/^[A-Za-z0-9/-]+$/)
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, 'Subject name is required').max(120),
  shortName: z.string().trim().max(20).optional(),
  description: optionalText(400),
  departmentId: z.string().min(1, 'Select a department'),
  subjectType: subjectTypeEnum.default('THEORY'),
  semester: z.coerce.number().int().min(1).max(12).default(1),
  credits: z.coerce.number().min(0).max(12).default(3),
  weeklyPeriods: z.coerce.number().int().min(0).max(20).default(4),
  periodsPerSession: z.coerce.number().int().min(1).max(4).default(1),
  maxIaMarks: z.coerce.number().int().min(1).max(200).default(50),
  maxTheoryMarks: z.coerce.number().int().min(1).max(300).default(100),
  passMarks: z.coerce.number().int().min(0).max(300).default(50),
});

export const classSchema = z.object({
  departmentId: z.string().min(1, 'Select a department'),
  academicYearId: z.string().min(1, 'Select an academic year'),
  yearOfStudy: z.coerce.number().int().min(1).max(8, 'Year of study must be between 1 and 8'),
  section: z.string().trim().min(1, 'Section is required').max(6).transform((v) => v.toUpperCase()),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  subjectIds: z.array(z.string()).max(40).optional(),
});

export const classUpdateSchema = z.object({
  semester: z.coerce.number().int().min(1).max(12).optional(),
  section: z.string().trim().min(1).max(6).transform((v) => v.toUpperCase()).optional(),
  yearOfStudy: z.coerce.number().int().min(1).max(8).optional(),
  subjectIds: z.array(z.string()).max(40).optional(),
});

export const academicYearSchema = z.object({
  name: z.string().trim().min(3, 'Name the academic year (e.g. 2025-26)').max(40),
  startDate: isoDate,
  endDate: isoDate,
  isCurrent: z.boolean().optional(),
  departmentId: z.string().nullish(),
}).refine((v) => v.endDate > v.startDate, { message: 'The end date must be after the start date', path: ['endDate'] });

export const roomSchema = z.object({
  code: z.string().trim().min(1, 'Room code is required').max(16).transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, 'Room name is required').max(80),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').max(500),
  roomType: roomTypeEnum.default('CLASSROOM'),
  building: z.string().trim().max(60).optional(),
  floor: z.coerce.number().int().min(-5).max(50).optional(),
  hasProjector: z.boolean().default(false),
  departmentId: z.string().nullish(),
  laboratoryId: z.string().nullish(),
});

export const laboratorySchema = z.object({
  name: z.string().trim().min(2, 'Laboratory name is required').max(80),
  code: z.string().trim().min(2, 'Laboratory code is required').max(16).transform((v) => v.toUpperCase()),
  capacity: z.coerce.number().int().min(1).max(300),
  equipment: optionalText(300),
  departmentId: z.string().min(1, 'Select a department'),
});

export type StudentInput = z.infer<typeof studentSchema>;
export type FacultyInput = z.infer<typeof facultySchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type ClassInput = z.infer<typeof classSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
