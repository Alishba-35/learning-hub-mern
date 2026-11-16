// Shorts ke chhote helpers (UI aur upload dono yahin se lete hain)

export const MAX_TITLE = 100;

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbed = (id) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

// Cloudinary video ke link ko .jpg kar do to pehla frame thumbnail ban jata hai
export const uploadThumb = (fileUrl) => fileUrl.replace(/\.(mp4|mov|webm)$/i, '.jpg');

export const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// File ko upload se pehle check karo (server aur Cloudinary phir bhi apni jaanch karte hain)
export function checkVideoFile(file, maxMb) {
  if (!file) return 'Choose a video file';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only MP4, MOV or WebM videos are allowed';
  if (file.size > maxMb * 1024 * 1024) return `Video must be ${maxMb} MB or smaller`;
  return '';
}

// File seedha Cloudinary par jati hai (hamare server se nahi). XMLHttpRequest isliye ke progress milti hai.
export function uploadToCloudinary(file, sig, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('signature', sig.signature);
    form.append('folder', sig.folder);
    form.append('allowed_formats', sig.allowedFormats);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new Error('Network error while uploading'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* neeche handle hota hai */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url && data?.public_id) {
        resolve({ fileUrl: data.secure_url, publicId: data.public_id });
      } else {
        reject(new Error(data?.error?.message || 'Upload failed'));
      }
    };
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
