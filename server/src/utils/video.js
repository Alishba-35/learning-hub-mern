import crypto from 'node:crypto';

export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const CHUNK_SIZE = 2 * 1024 * 1024; // browser file ko itne bare tukdon mein bhejta hai
export const ALLOWED_MIME = ['video/mp4', 'video/quicktime', 'video/webm'];
export const MB = 1024 * 1024;
export const STREAM_LINK_SECONDS = 6 * 60 * 60;

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

// Har tarah ke YouTube link se 11-character ID nikalta hai (watch, youtu.be, shorts, embed). Galat ho to null.
export function parseYouTubeId(input) {
  const text = String(input ?? '').trim();
  if (VIDEO_ID.test(text)) return text;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id = null;
  if (host === 'youtu.be') id = parts[0];
  else if (YOUTUBE_HOSTS.has(host)) {
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1];
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

// ---- Chunked upload ----
export const chunkCountFor = (size) => Math.ceil(size / CHUNK_SIZE);
// Har tukda exact CHUNK_SIZE ka hota hai, sirf aakhri baqi bacha hua
export const expectedChunkLength = (size, index) => Math.min(CHUNK_SIZE, size - index * CHUNK_SIZE);

// File ke pehle bytes dekh kar pehchanta hai ke wakai MP4/MOV ya WebM hai (naam ya type par bharosa nahi)
export function looksLikeVideo(buf) {
  if (!buf || buf.length < 12) return false;
  const mp4 = buf.subarray(4, 8).toString('latin1') === 'ftyp';
  const webm = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  return mp4 || webm;
}

// ---- Signed stream link: <video> tag Authorization header nahi bhej sakta, is liye link khud sign hota hai ----
const sign = (id, exp, secret) => crypto.createHmac('sha256', secret).update(`stream:${id}:${exp}`).digest('hex');

export function streamPath(id, secret, now = Date.now()) {
  const exp = Math.floor(now / 1000) + STREAM_LINK_SECONDS;
  return `/api/videos/${id}/stream?exp=${exp}&sig=${sign(id, exp, secret)}`;
}

export function verifyStreamLink(id, exp, sig, secret, now = Date.now()) {
  const e = Number(exp);
  if (!Number.isInteger(e) || e * 1000 < now || typeof sig !== 'string' || !/^[a-f0-9]{64}$/.test(sig)) return false;
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(sign(id, e, secret), 'hex'));
}

// "Range: bytes=a-b" ko {start, end} mein badalta hai. Header na ho to null, ghalat/hadd se bahar ho to 'invalid'.
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start;
  let end;
  if (m[1] === '') {
    const suffix = Number(m[2]); // "-500" = aakhri 500 bytes
    if (suffix === 0) return 'invalid';
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start > end || start >= size ? 'invalid' : { start, end };
}
