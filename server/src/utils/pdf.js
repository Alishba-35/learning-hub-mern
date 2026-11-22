import { deflateSync } from 'node:zlib';
import { WIDTHS } from './pdfMetrics.js';

// Bahut chhota PDF likhne wala: ek page, standard fonts, rangeen shapes aur text. Koi library nahi chahiye
// (is liye Vercel/Render par bhi bina masle ke chalta hai). Sirf Latin (WinAnsi) text; baqi huroof "?" ban jate hain.

const FONT_IDS = { Helvetica: 'F1', 'Helvetica-Bold': 'F2', 'Times-Bold': 'F3', 'Times-Italic': 'F4' };

// Text ko PDF ke liye saaf karo: control chars/line breaks hatao, sirf Latin-1 rakho, baqi "?"
export function toWinAnsi(input) {
  return [...String(input ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()]
    .map((ch) => (ch.codePointAt(0) <= 0xff ? ch : '?'))
    .join('');
}

// Text ki chaurai points mein (accent wale harf apne base harf jitne chaure hote hain)
export function textWidth(text, font, size, spacing = 0) {
  if (font && font.isTtf) return font.width(text, size, spacing);
  const table = WIDTHS[font];
  if (!table) throw new Error(`Unknown font: ${font}`);
  let units = 0;
  for (const ch of toWinAnsi(text)) {
    const base = ch.normalize('NFD')[0];
    const code = base.charCodeAt(0);
    units += code >= 32 && code <= 126 ? table[code - 32] : 556;
  }
  const chars = [...toWinAnsi(text)].length;
  return (units * size) / 1000 + spacing * Math.max(chars - 1, 0);
}

// Bari size se shuru karke tab tak chhota karo jab tak text maxWidth mein na aa jaye
export function fitSize(text, font, maxSize, maxWidth, minSize = 14) {
  let size = maxSize;
  while (size > minSize && textWidth(text, font, size) > maxWidth) size -= 1;
  return size;
}

const num = (n) => (Math.round(n * 100) / 100).toString();
const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => num(parseInt(h.slice(i, i + 2), 16) / 255)).join(' ');
};
const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export class PdfPage {
  constructor(width, height, { title = '', author = '' } = {}) {
    this.width = width;
    this.height = height;
    this.title = toWinAnsi(title);
    this.author = toWinAnsi(author);
    this.ops = [];
    this.images = [];
    this.ttf = new Map(); // TTF font -> { id, used: Map(glyph -> unicode) }
    this.texts = []; // jo text likha gaya (tests aur debugging ke liye)
    this.links = []; // clickable link wale dabbe
  }

  rect(x, y, w, h, { fill, stroke, lineWidth = 1 } = {}) {
    const paint = fill && stroke ? 'B' : fill ? 'f' : 'S';
    this.ops.push(`q ${fill ? `${rgb(fill)} rg ` : ''}${stroke ? `${rgb(stroke)} RG ${num(lineWidth)} w ` : ''}${num(x)} ${num(y)} ${num(w)} ${num(h)} re ${paint} Q`);
  }

  line(x1, y1, x2, y2, { stroke = '#000000', lineWidth = 1 } = {}) {
    this.ops.push(`q ${rgb(stroke)} RG ${num(lineWidth)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S Q`);
  }

  // Kai nuqton se shape: closed=true ho to polygon (fill/stroke), warna sirf lakeer (polyline)
  path(points, { fill, stroke, lineWidth = 1, closed = true } = {}) {
    const [first, ...rest] = points;
    const draw = `${num(first[0])} ${num(first[1])} m ${rest.map(([x, y]) => `${num(x)} ${num(y)} l`).join(' ')}`;
    const paint = fill && stroke && closed ? 'B' : fill ? 'f' : 'S';
    this.ops.push(`q ${fill ? `${rgb(fill)} rg ` : ''}${stroke ? `${rgb(stroke)} RG ${num(lineWidth)} w 1 j ` : ''}${draw}${closed ? ' h' : ''} ${paint} Q`);
  }

  circle(cx, cy, r, { fill, stroke, lineWidth = 1 } = {}) {
    const k = 0.5523 * r;
    const paint = fill && stroke ? 'B' : fill ? 'f' : 'S';
    const path = [
      `${num(cx + r)} ${num(cy)} m`,
      `${num(cx + r)} ${num(cy + k)} ${num(cx + k)} ${num(cy + r)} ${num(cx)} ${num(cy + r)} c`,
      `${num(cx - k)} ${num(cy + r)} ${num(cx - r)} ${num(cy + k)} ${num(cx - r)} ${num(cy)} c`,
      `${num(cx - r)} ${num(cy - k)} ${num(cx - k)} ${num(cy - r)} ${num(cx)} ${num(cy - r)} c`,
      `${num(cx + k)} ${num(cy - r)} ${num(cx + r)} ${num(cy - k)} ${num(cx + r)} ${num(cy)} c`,
    ].join(' ');
    this.ops.push(`q ${fill ? `${rgb(fill)} rg ` : ''}${stroke ? `${rgb(stroke)} RG ${num(lineWidth)} w ` : ''}${path} h ${paint} Q`);
  }

  // align: left (x se shuru), center (x beech mein), right (x par khatam). spacing: harf ke beech extra jagah.
  // font: standard font ka naam (jaise 'Helvetica-Bold') ya loadFont() se mila TTF font.
  // bold: sirf TTF ke liye, harf ke kinare par patli lakeer (lakeer ki motai points mein) taake text mota lage.
  text(str, { x, y, font = 'Helvetica', size = 12, color = '#000000', align = 'left', spacing = 0, bold = 0 }) {
    if (font && font.isTtf) {
      const clean = font.constructor.clean(str);
      if (!clean) return;
      const width = font.width(clean, size, spacing);
      const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
      let rec = this.ttf.get(font);
      if (!rec) {
        rec = { id: `T${this.ttf.size + 1}`, used: new Map() };
        this.ttf.set(font, rec);
      }
      const hex = [...clean]
        .map((ch) => {
          const cp = ch.codePointAt(0);
          const gid = font.glyph(cp);
          if (!rec.used.has(gid)) rec.used.set(gid, gid ? cp : 0xfffd);
          return gid.toString(16).padStart(4, '0');
        })
        .join('');
      const mode = bold ? `${rgb(color)} RG ${num(bold)} w 2 Tr ` : '';
      this.texts.push(clean);
      this.ops.push(`BT /${rec.id} ${num(size)} Tf ${rgb(color)} rg ${mode}${num(spacing)} Tc ${num(left)} ${num(y)} Td <${hex}> Tj ET`);
      return;
    }
    const clean = toWinAnsi(str);
    if (!clean) return;
    const width = textWidth(clean, font, size, spacing);
    const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    this.texts.push(clean);
    this.ops.push(`BT /${FONT_IDS[font]} ${num(size)} Tf ${rgb(color)} rg ${num(spacing)} Tc ${num(left)} ${num(y)} Td (${escape(clean)}) Tj ET`);
  }

  // Clickable link: dabba (x, y neeche-bayen kone se, w x h) kholne par url khulta hai
  link(x, y, w, h, url) {
    this.links.push({ rect: [x, y, x + w, y + h], url: toWinAnsi(url) });
  }

  // Tasveer (decodePng ya readJpeg ka natija) x, y (neeche-bayen kone) par w x h ke dabbe mein. Transparency (alpha) chalti hai.
  image(img, x, y, w, h) {
    let idx = this.images.indexOf(img);
    if (idx === -1) idx = this.images.push(img) - 1;
    this.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /Im${idx + 1} Do Q`);
  }

  toBuffer() {
    const content = this.ops.join('\n');
    const fontNames = Object.keys(FONT_IDS);
    const objects = new Array(5 + fontNames.length).fill(null); // 1-4: catalog, pages, page, content; phir standard fonts; phir info
    const add = (body) => objects.push(body);
    const raw = (dict, buf) => `<< ${dict} /Length ${buf.length} >>\nstream\n${buf.toString('latin1')}\nendstream`;
    const packed = (dict, data) => {
      const body = deflateSync(data);
      return raw(`${dict} /Filter /FlateDecode`, body);
    };

    const fontObjStart = 5;
    const infoNum = fontObjStart + fontNames.length;
    fontNames.forEach((name, i) => {
      objects[fontObjStart - 1 + i] = `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
    });
    objects[infoNum - 1] = `<< /Title (${escape(this.title)}) /Author (${escape(this.author)}) /Producer (Learning Hub) >>`;
    const fontRefs = fontNames.map((name, i) => `/${FONT_IDS[name]} ${fontObjStart + i} 0 R`);

    // Tasveerein: JPEG seedhi, PNG ke liye RGB aur (agar ho) alpha mask (SMask)
    const xobjects = this.images.map((img, i) => {
      const base = `/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height}`;
      if (img.jpeg) return `/Im${i + 1} ${add(raw(`${base} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, img.jpeg))} 0 R`;
      const mask = img.alpha ? add(packed(`${base} /ColorSpace /DeviceGray /BitsPerComponent 8`, img.alpha)) : null;
      const ref = add(packed(`${base} /ColorSpace /DeviceRGB /BitsPerComponent 8${mask ? ` /SMask ${mask} 0 R` : ''}`, img.rgb));
      return `/Im${i + 1} ${ref} 0 R`;
    });

    // TTF fonts: Type0 font + CIDFont + descriptor + font file + ToUnicode (copy/search ke liye)
    for (const [font, rec] of this.ttf) {
      const gids = [...rec.used.keys()].sort((a, b) => a - b);
      const file = add(packed(`/Length1 ${font.data.length}`, font.data));
      const desc = add(`<< /Type /FontDescriptor /FontName /${font.name} /Flags 4 /FontBBox [${font.bbox.join(' ')}] /ItalicAngle ${num(font.italicAngle)} /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV 80 /FontFile2 ${file} 0 R >>`);
      const widths = gids.map((g) => `${g} [${font.advance(g)}]`).join(' ');
      const cid = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${font.name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /CIDToGIDMap /Identity /DW 0 /W [${widths}] >>`);
      const hex4 = (n) => n.toString(16).padStart(4, '0');
      const chunks = [];
      for (let i = 0; i < gids.length; i += 100) {
        const part = gids.slice(i, i + 100);
        chunks.push(`${part.length} beginbfchar\n${part.map((g) => `<${hex4(g)}> <${hex4(rec.used.get(g))}>`).join('\n')}\nendbfchar`);
      }
      const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chunks.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
      const toUnicode = add(packed('', Buffer.from(cmap, 'latin1')));
      const type0 = add(`<< /Type /Font /Subtype /Type0 /BaseFont /${font.name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${toUnicode} 0 R >>`);
      fontRefs.push(`/${rec.id} ${type0} 0 R`);
    }

    const annots = this.links.map((l) => add(`<< /Type /Annot /Subtype /Link /Rect [${l.rect.map(num).join(' ')}] /Border [0 0 0] /A << /S /URI /URI (${escape(l.url)}) >> >>`));
    const resources = `<< /Font << ${fontRefs.join(' ')} >>${xobjects.length ? ` /XObject << ${xobjects.join(' ')} >>` : ''} >>`;
    objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[1] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objects[2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.width)} ${num(this.height)}] /Resources ${resources}${annots.length ? ` /Annots [${annots.map((n) => `${n} 0 R`).join(' ')}]` : ''} /Contents 4 0 R >>`;
    objects[3] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;

    let out = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(out, 'latin1'));
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
}
