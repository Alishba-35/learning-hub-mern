// Profile photo: kisi bhi tasveer ko beech se chorus (square) kaat kar 256x256 JPEG bana deta hai (~20-40 KB),
// taake database aur network par bojh na pare. Server sirf yahi chhoti tasveer maanta hai.
export const AVATAR_SIZE = 256;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_CHARS = 90000;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Try a JPEG or PNG.'));
    };
    img.src = url;
  });
}

export async function fileToAvatar(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose an image file');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is too big. Please choose one under 10 MB.');
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error('Could not read that image. Try a JPEG or PNG.');

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNG JPEG mein kala na ho jaye
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error('Could not make that image small enough. Please try another one.');
}
