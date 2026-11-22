import { inflateSync } from 'node:zlib';

// Chhota PNG decoder: 8-bit, interlace ke bagair; gray, gray+alpha, palette, RGB aur RGBA sab chalte hain.
// Bahar se koi library nahi, is liye Vercel/Render par bhi bina masle ke chalta hai.
// Wapas: { width, height, rgb: Buffer (w*h*3), alpha: Buffer|null (w*h) }
export function decodePng(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(sig)) throw new Error('Not a PNG file');

  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  const idat = [];
  let palette = null;
  let trns = null;
  for (let pos = 8; pos + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (name === 'PLTE') palette = data;
    else if (name === 'tRNS') trns = data;
    else if (name === 'IDAT') idat.push(data);
    else if (name === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || ![0, 2, 3, 4, 6].includes(type) || (type === 3 && !palette)) {
    throw new Error('PNG must be 8-bit (gray, palette, RGB or RGBA) without interlacing. Re-save it as a normal PNG.');
  }

  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]; // bytes per pixel
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error('PNG data is incomplete');

  // Har line ka filter ulta karo (None, Sub, Up, Average, Paeth)
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[dst + i - bpp] : 0;
      const b = y > 0 ? px[dst - stride + i] : 0;
      const c = y > 0 && i >= bpp ? px[dst - stride + i - bpp] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error('Bad PNG filter');
      px[dst + i] = (raw[src + i] + add) & 0xff;
    }
  }

  const hasAlpha = type === 4 || type === 6 || (type === 3 && trns);
  const rgb = Buffer.alloc(width * height * 3);
  const alpha = hasAlpha ? Buffer.alloc(width * height) : null;
  for (let i = 0, n = width * height; i < n; i++) {
    const o = i * bpp;
    if (type === 2 || type === 6) {
      rgb[i * 3] = px[o];
      rgb[i * 3 + 1] = px[o + 1];
      rgb[i * 3 + 2] = px[o + 2];
      if (type === 6) alpha[i] = px[o + 3];
    } else if (type === 0 || type === 4) {
      rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = px[o];
      if (type === 4) alpha[i] = px[o + 1];
    } else {
      const k = px[o] * 3;
      rgb[i * 3] = palette[k];
      rgb[i * 3 + 1] = palette[k + 1];
      rgb[i * 3 + 2] = palette[k + 2];
      if (alpha) alpha[i] = px[o] < trns.length ? trns[px[o]] : 255;
    }
  }
  return { width, height, rgb, alpha };
}

// JPEG ki sirf size aur rang ki jankari (SOF marker se). Tasveer jyon ki tyon PDF mein jati hai (DCTDecode), is liye decode nahi karte.
export function readJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('Not a JPEG file');
  for (let pos = 2; pos + 9 < buf.length; ) {
    if (buf[pos] !== 0xff) { pos++; continue; }
    const marker = buf[pos + 1];
    if (marker === 0xff) { pos++; continue; }
    const len = buf.readUInt16BE(pos + 2);
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb)) {
      const components = buf[pos + 9];
      if (components !== 3) throw new Error('JPEG must be RGB (3 components)');
      return { jpeg: buf, height: buf.readUInt16BE(pos + 5), width: buf.readUInt16BE(pos + 7) };
    }
    pos += 2 + len;
  }
  throw new Error('JPEG size not found');
}
