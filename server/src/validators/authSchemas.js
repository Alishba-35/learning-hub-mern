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
