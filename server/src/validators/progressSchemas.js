import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9-]{1,50}$/);

export const lastSchema = z.object({ topic: slug });
export const completeSchema = z.object({ day: z.string().optional() });
// code khali ("") ho to draft delete ho jata hai
export const draftSchema = z.object({ code: z.string().max(20000) });
