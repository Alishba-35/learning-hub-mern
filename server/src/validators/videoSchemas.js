import { z } from 'zod';
import { parseYouTubeId } from '../utils/video.js';

const base = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().trim().max(300).optional().default(''),
  languageSlug: z.union([z.literal(''), z.string().regex(/^[a-z0-9-]{1,50}$/)]).optional().default(''),
};

export const createVideoSchema = z.discriminatedUnion('source', [
  z.object({
    ...base,
    source: z.literal('youtube'),
    youtubeUrl: z
      .string()
      .trim()
      .max(300)
      .refine((v) => parseYouTubeId(v) !== null, { message: 'Enter a valid YouTube link' }),
  }),
  z.object({
    ...base,
    source: z.literal('upload'),
    fileUrl: z.string().trim().max(500),
    publicId: z.string().trim().max(200),
  }),
]);
