import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(120);
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email,
  password,
  purpose: z.string().trim().max(200).optional().default(''),
  remember: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
  remember: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  email,
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password,
});

// Profile: naam aur/ya photo. avatar = chhoti tasveer ka data URL, ya null (photo hatana)
const AVATAR_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60).optional(),
    avatar: z.union([z.string().max(130000).regex(AVATAR_URL, 'Photo must be a JPEG, PNG or WebP image'), z.null()]).optional(),
  })
  .refine((v) => v.name !== undefined || v.avatar !== undefined, { message: 'Nothing to update' });
