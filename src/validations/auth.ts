import { z } from 'zod';

import { emailSchema } from './common';

/**
 * Client and server share these schemas: the browser validates before submit
 * (fast feedback) and the API re-validates the same rules (the real gate).
 */

export const PASSWORD_MIN = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(128, 'Use at most 128 characters')
  .regex(/[a-zA-Z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number')
  .refine((v) => !/^\d+$/.test(v), 'Avoid a password made only of numbers')
  .refine((v) => !/password|12345678|qwerty|campusiq|admin123|letmein/i.test(v), 'Avoid common words like "password" or "campusiq"');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(200),
  remember: z.boolean().optional(),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, 'Enter your first name').max(60),
  lastName: z.string().trim().min(1, 'Enter your last name').max(60),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  registerNumber: z
    .string()
    .trim()
    .min(4, 'Enter your register number')
    .max(20)
    .regex(/^[A-Za-z0-9/-]+$/, 'Register numbers use letters, numbers, hyphens and slashes only')
    .transform((v) => v.toUpperCase()),
  departmentId: z.string().min(1, 'Select your department'),
  phone: z.string().trim().max(20).optional(),
}).refine((v) => v.password === v.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'That reset link looks incomplete'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60).optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(60).optional(),
  phone: z.string().trim().max(20).nullish(),
  themePreference: z.enum(['light', 'dark', 'system']).optional(),
});

export const themeSchema = z.object({ theme: z.enum(['light', 'dark', 'system']) });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
