import { z } from 'zod';

import { optionalText } from './common';
import { isoDate } from './people';

/** IA exams, marks entry, university result upload and career matching. */

export const iaExamSchema = z.object({
  subjectId: z.string().min(1, 'Select a subject'),
  classId: z.string().min(1, 'Select a class'),
  name: z.string().trim().min(2, 'Name the assessment (e.g. IA-1)').max(80),
  examNumber: z.coerce.number().int().min(1).max(10),
  examDate: isoDate,
  maxMarks: z.coerce.number().int().min(1).max(200),
  weightage: z.coerce.number().min(0).max(10).optional(),
  facultyId: z.string().nullish(),
});

export const iaExamUpdateSchema = iaExamSchema.partial();

export const markEntrySchema = z.object({
  studentId: z.string().min(1),
  marks: z.coerce.number().min(0).max(200).nullable().default(null),
  isAbsent: z.boolean().optional(),
  remarks: optionalText(200),
});

export const saveMarksSchema = z
  .object({ entries: z.array(markEntrySchema).min(1, 'There is nothing to save').max(400) })
  .superRefine((value, ctx) => {
    for (const entry of value.entries) {
      if (!entry.isAbsent && (entry.marks === null || entry.marks === undefined)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter marks or mark the student absent',
          path: ['entries'],
        });
        break;
      }
    }
  });

export const resultUploadSchema = z.object({
  name: z.string().trim().max(120).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  declaredOn: isoDate.optional(),
  departmentId: z.string().optional(),
  classId: z.string().optional(),
  academicYearId: z.string().optional(),
});

export const jobSchema = z.object({
  title: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  jobType: z.enum(['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT', 'REMOTE', 'ON_SITE', 'HYBRID']).optional(),
  sourceUrl: optionalText(400),
  description: z.string().trim().max(60000).optional(),
});

export const jobTextSchema = jobSchema.extend({
  description: z.string().trim().min(40, 'Paste at least a few lines of the job description').max(60000),
});

export const resumeSchema = z.object({
  title: z.string().trim().max(120).optional(),
  text: z.string().trim().min(40, 'Paste at least a paragraph of your resume').max(120000).optional(),
});

export const resumeUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  isPrimary: z.boolean().optional(),
  text: z.string().trim().max(120000).optional(),
});

export const matchSchema = z.object({
  resumeId: z.string().min(1, 'Choose a resume'),
  jobDescriptionId: z.string().min(1, 'Choose a job description'),
});

export const skillGapStatusSchema = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']) });

export const skillGapByNameSchema = z.object({
  skillName: z.string().trim().min(1, 'Choose a skill').max(120),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']),
});

export type IaExamInput = z.infer<typeof iaExamSchema>;
export type SaveMarksInput = z.infer<typeof saveMarksSchema>;
export type MatchInput = z.infer<typeof matchSchema>;
