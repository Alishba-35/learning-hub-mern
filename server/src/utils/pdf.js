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
  text(str, { x, y, font = 'Helvetica', size = 12, color = '#000000', align = 'left', spacing = 0 }) {
    const clean = toWinAnsi(str);
    if (!clean) return;
    const width = textWidth(clean, font, size, spacing);
    const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    this.ops.push(`BT /${FONT_IDS[font]} ${num(size)} Tf ${rgb(color)} rg ${num(spacing)} Tc ${num(left)} ${num(y)} Td (${escape(clean)}) Tj ET`);
  }

  toBuffer() {
    const content = this.ops.join('\n');
    const fontNames = Object.keys(FONT_IDS);
    const fontObjStart = 5;
    const fontRefs = fontNames.map((name, i) => `/${FONT_IDS[name]} ${fontObjStart + i} 0 R`).join(' ');
    const infoNum = fontObjStart + fontNames.length;

    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.width)} ${num(this.height)}] /Resources << /Font << ${fontRefs} >> >> /Contents 4 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
      ...fontNames.map((name) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`),
      `<< /Title (${escape(this.title)}) /Author (${escape(this.author)}) /Producer (Learning Hub) >>`,
    ];

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
