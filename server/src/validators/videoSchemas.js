import { z } from 'zod';
import { ALLOWED_MIME, parseYouTubeId } from '../utils/video.js';

const base = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().trim().max(300).optional().default(''),
  languageSlug: z.union([z.literal(''), z.string().regex(/^[a-z0-9-]{1,50}$/)]).optional().default(''),
};

export const createVideoSchema = z.object({
  ...base,
  source: z.literal('youtube'),
  youtubeUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => parseYouTubeId(v) !== null, { message: 'Enter a valid YouTube link' }),
});

// Upload shuru karne se pehle file ki maloomat (asli file tukdon mein baad mein aati hai)
export const startUploadSchema = z.object({
  ...base,
  size: z.number().int().min(1024, 'This file is too small to be a video'),
  mimeType: z.enum(ALLOWED_MIME, { message: 'Only MP4, MOV or WebM videos are allowed' }),
});
