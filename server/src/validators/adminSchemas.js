import { z } from 'zod';

// Reject karte waqt wajah zaroori hai, taake student ko pata chale video kyun hata
export const videoStatusSchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'pending']),
    reason: z.string().trim().max(200).optional().default(''),
  })
  .refine((v) => v.status !== 'rejected' || v.reason.length >= 3, { message: 'Please write a short reason (at least 3 characters)', path: ['reason'] });

// Suspend karte waqt wajah likhna zaroori hai
export const suspensionSchema = z
  .object({ disabled: z.boolean(), reason: z.string().trim().max(200).optional().default('') })
  .refine((v) => !v.disabled || v.reason.length >= 3, { message: 'Please write a short reason (at least 3 characters)', path: ['reason'] });

// Admin banana sirf command line se (npm run role), taake koi admin galti se na ban jaye
export const roleSchema = z.object({ role: z.enum(['student', 'teacher']) });

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid student id');

// Naya announcement: sab ko, ya sirf chune hue students ko (reminder). Muddat din mein, null = hamesha.
export const announcementSchema = z
  .object({
    title: z.string().trim().min(3, 'Title is too short').max(80),
    body: z.string().trim().min(3, 'Message is too short').max(500),
    level: z.enum(['info', 'important']).optional().default('info'),
    audience: z.enum(['everyone', 'selected']).optional().default('everyone'),
    userIds: z.array(objectId).max(200).optional().default([]),
    expiresInDays: z.number().int().min(1).max(90).nullable().optional().default(null),
  })
  .refine((v) => v.audience !== 'selected' || v.userIds.length > 0, { message: 'Pick at least one student', path: ['userIds'] });
