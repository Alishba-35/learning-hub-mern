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
