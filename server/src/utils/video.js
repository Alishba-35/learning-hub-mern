import crypto from 'node:crypto';

export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const UPLOAD_FOLDER = 'learning-hub/shorts';
export const ALLOWED_FORMATS = ['mp4', 'mov', 'webm'];
export const MAX_UPLOAD_MB = 50;

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

// Cloudinary ka signature: params ko alphabet order mein "k=v&k=v" bana kar secret jor ke sha1
export function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

// Browser ko seedha Cloudinary par upload karne ke liye signed parameters (file server se nahi guzarti)
export function buildUploadSignature({ cloudName, apiKey, apiSecret }, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  const allowedFormats = ALLOWED_FORMATS.join(',');
  const signature = signParams({ allowed_formats: allowedFormats, folder: UPLOAD_FOLDER, timestamp }, apiSecret);
  return { cloudName, apiKey, timestamp, signature, folder: UPLOAD_FOLDER, allowedFormats, maxMb: MAX_UPLOAD_MB };
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Sirf hamare apne Cloudinary account ke, hamare folder ke video ka link qabool hota hai
export function isOwnUpload({ fileUrl, publicId }, cloudName) {
  if (!/^[a-z0-9_-]{2,60}$/i.test(cloudName ?? '')) return false;
  if (!new RegExp(`^${escapeRegExp(UPLOAD_FOLDER)}/[A-Za-z0-9_-]{1,100}$`).test(publicId ?? '')) return false;
  const exts = ALLOWED_FORMATS.join('|');
  const re = new RegExp(`^https://res\\.cloudinary\\.com/${escapeRegExp(cloudName)}/video/upload/(v\\d+/)?${escapeRegExp(publicId)}\\.(${exts})$`);
  return re.test(fileUrl ?? '');
}

// Video delete hone par Cloudinary se bhi hata do (nakam ho jaye to DB ka delete phir bhi chalta hai)
export async function destroyUpload(publicId, { cloudName, apiKey, apiSecret }, fetchImpl = fetch) {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature: signParams({ public_id: publicId, timestamp }, apiSecret),
  });
  const res = await fetchImpl(`https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`, { method: 'POST', body });
  return res.ok;
}
