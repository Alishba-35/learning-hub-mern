import { z } from 'zod';

const answer = z.union([z.number().int().min(0).max(9), z.string().max(200)]);

export const submitSchema = z.object({
  day: z.string().optional(),
  answers: z
    .record(z.string().max(60), answer)
    .refine((a) => Object.keys(a).length <= 50, { message: 'Too many answers' }),
});
