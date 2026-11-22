import { readFileSync } from 'node:fs';

// Chhota TrueType (.ttf) parser: PDF mein font embed karne ke liye sirf itna chahiye: har harf ka glyph number,
// har glyph ki chaurai aur font ki basic naap. Koi library nahi. Sirf Basic Latin / Latin-1 wale subset fonts ke liye bana hai.
export class TtfFont {
  constructor(data, name) {
    this.data = data;
    this.name = name;
    const tables = {};
    for (let i = 0, n = data.readUInt16BE(4); i < n; i++) {
      const o = 12 + i * 16;
      tables[data.toString('latin1', o, o + 4)] = { offset: data.readUInt32BE(o + 8), length: data.readUInt32BE(o + 12) };
    }
    for (const t of ['head', 'hhea', 'maxp', 'hmtx', 'cmap']) if (!tables[t]) throw new Error(`Font is missing the ${t} table`);

    const head = tables.head.offset;
    this.unitsPerEm = data.readUInt16BE(head + 18);
    const scale = (v) => Math.round((v * 1000) / this.unitsPerEm);
    this.bbox = [36, 38, 40, 42].map((d) => scale(data.readInt16BE(head + d)));
    const hhea = tables.hhea.offset;
    this.ascent = scale(data.readInt16BE(hhea + 4));
    this.descent = scale(data.readInt16BE(hhea + 6));
    const numMetrics = data.readUInt16BE(hhea + 34);
    this.glyphCount = data.readUInt16BE(tables.maxp.offset + 4);
    const os2 = tables['OS/2'];
    this.capHeight = os2 && os2.length >= 90 && data.readUInt16BE(os2.offset) >= 2 ? scale(data.readInt16BE(os2.offset + 88)) : this.ascent;
    const post = tables.post;
    this.italicAngle = post ? data.readInt32BE(post.offset + 4) / 65536 : 0;

    // hmtx: har glyph ki advance width (aakhri wali baqi glyphs ke liye dohrai jati hai)
    this.advances = new Array(this.glyphCount);
    for (let g = 0; g < this.glyphCount; g++) {
      const idx = Math.min(g, numMetrics - 1);
      this.advances[g] = data.readUInt16BE(tables.hmtx.offset + idx * 4);
    }

    // cmap: unicode -> glyph number (format 4)
    this.cmap = new Map();
    const cmapAt = tables.cmap.offset;
    let sub = null;
    for (let i = 0, n = data.readUInt16BE(cmapAt + 2); i < n; i++) {
      const rec = cmapAt + 4 + i * 8;
      const platform = data.readUInt16BE(rec);
      const encoding = data.readUInt16BE(rec + 2);
      const at = cmapAt + data.readUInt32BE(rec + 4);
      if (data.readUInt16BE(at) !== 4) continue;
      if (platform === 3 && encoding === 1) { sub = at; break; }
      if (platform === 0 && sub === null) sub = at;
    }
    if (sub === null) throw new Error('Font has no format 4 cmap');
    const segCount = data.readUInt16BE(sub + 6) / 2;
    const end = sub + 14;
    const start = end + segCount * 2 + 2;
    const delta = start + segCount * 2;
    const range = delta + segCount * 2;
    for (let s = 0; s < segCount; s++) {
      const lo = data.readUInt16BE(start + s * 2);
      const hi = data.readUInt16BE(end + s * 2);
      const d = data.readUInt16BE(delta + s * 2);
      const r = data.readUInt16BE(range + s * 2);
      for (let c = lo; c <= hi && c < 0xffff; c++) {
        let g;
        if (r === 0) g = (c + d) & 0xffff;
        else {
          g = data.readUInt16BE(range + s * 2 + r + (c - lo) * 2);
          if (g !== 0) g = (g + d) & 0xffff;
        }
        if (g) this.cmap.set(c, g);
      }
    }
  }

  isTtf = true;

  // Text ko saaf karo (extra space, line break hatao)
  static clean(text) {
    return String(text ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  glyph(cp) {
    return this.cmap.get(cp) || 0;
  }

  // Kya font ke paas text ka har harf hai?
  covers(text) {
    return [...TtfFont.clean(text)].every((ch) => this.cmap.has(ch.codePointAt(0)));
  }

  // 1000 units wali chaurai
  advance(gid) {
    return Math.round((this.advances[gid] * 1000) / this.unitsPerEm);
  }

  width(text, size, spacing = 0) {
    const chars = [...TtfFont.clean(text)];
    let units = 0;
    for (const ch of chars) units += this.advance(this.glyph(ch.codePointAt(0)));
    return (units * size) / 1000 + spacing * Math.max(chars.length - 1, 0);
  }
}

const cache = new Map();
// server/src/assets/fonts/<file> se font parho (ek baar). Na mile to null, taake certificate phir bhi bane (standard fonts se).
export function loadFont(file, name) {
  if (!cache.has(file)) {
    try {
      cache.set(file, new TtfFont(readFileSync(new URL(`../assets/fonts/${file}`, import.meta.url)), name));
    } catch (err) {
      console.warn(`Certificate: could not load font ${file}: ${err.message}`);
      cache.set(file, null);
    }
  }
  return cache.get(file);
}
