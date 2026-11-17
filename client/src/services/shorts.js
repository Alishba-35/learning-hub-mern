// Shorts ke chhote helpers (UI aur upload dono yahin se lete hain)
import { request } from './api.js';

export const MAX_TITLE = 100;

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbed = (id) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

export const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// File ko upload se pehle check karo (server phir bhi apni jaanch karta hai)
export function checkVideoFile(file, maxMb) {
  if (!file) return 'Choose a video file';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only MP4, MOV or WebM videos are allowed';
  if (file.size > maxMb * 1024 * 1024) return `Video must be ${maxMb} MB or smaller`;
  return '';
}

const PART_TRIES = 3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// File ko tukdon mein hamare server par bhejta hai: shuru -> har tukda (3 koshish tak) -> mukammal.
// Chhoti requests isliye ke host (Vercel/Render) badi body par rok sakte hain. onProgress(0..100), signal se cancel.
export async function uploadVideoFile(file, meta, { onProgress, signal } = {}) {
  const { id, chunkSize, chunkCount } = await request('/videos/uploads', {
    method: 'POST',
    body: { ...meta, size: file.size, mimeType: file.type },
    signal,
  });

  try {
    for (let i = 0; i < chunkCount; i++) {
      const part = file.slice(i * chunkSize, Math.min((i + 1) * chunkSize, file.size));
      for (let attempt = 1; ; attempt++) {
        try {
          await request(`/videos/uploads/${id}/${i}`, { method: 'PUT', raw: part, signal });
          break;
        } catch (err) {
          // 4xx (login ke ilawa) dobara bhejne se theek nahi hota; sirf network/server ghalti par dobara koshish
          const retryable = !err.status || err.status >= 500;
          if (signal?.aborted || !retryable || attempt === PART_TRIES) throw err;
          await wait(400 * attempt);
        }
      }
      onProgress?.(Math.round(((i + 1) / chunkCount) * 100));
    }
    const { video } = await request(`/videos/uploads/${id}/complete`, { method: 'POST', signal });
    return video;
  } catch (err) {
    // Adhoori upload server par na pari rahe (server 1 ghante baad bhi khud saaf karta hai)
    request(`/videos/${id}`, { method: 'DELETE' }).catch(() => {});
    throw err;
  }
}
