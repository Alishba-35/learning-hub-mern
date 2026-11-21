import { fitSize, PdfPage } from './pdf.js';

// A4 aaray (landscape). Design: halka grey kaghaz, kone mein gehre teal tikone, sunehri tirchhi lakeer,
// seal, naam aur verify link. Naqsha 757x527 ke reference design par bana hai, is liye nuqte usi paimane mein (px) likhe hain.
const W = 841.89;
const H = 595.28;
const SX = W / 757;
const SY = H / 527;
const P = ([x, y]) => [x * SX, H - y * SY]; // design ka nuqta -> PDF ka nuqta

const TEAL = '#0f2d38';
const TEAL_SOFT = '#1f4a57';
const GOLD = '#c9a227';
const PAPER = '#e8eaec';
const INK = '#14313b';
const MUTED = '#7b838a';

const longDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// 5 konon ka sitara
function star(cx, cy, r) {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.42;
    return [cx + Math.cos(angle) * radius, cy - Math.sin(angle) * radius * -1];
  });
}

function seal(page, cx, cy) {
  const edge = Array.from({ length: 56 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 56;
    const r = i % 2 === 0 ? 63 : 58;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  });
  page.path(edge, { fill: TEAL });
  page.circle(cx, cy, 50, { stroke: GOLD, lineWidth: 3 });
  page.circle(cx, cy, 45, { fill: TEAL_SOFT });
  for (let i = 0; i < 4; i++) page.path(star(cx - 15 + i * 10, cy + 28, 3.6), { fill: GOLD });
  page.text('COURSE', { x: cx, y: cy + 4, font: 'Helvetica-Bold', size: 15, color: '#ffffff', align: 'center', spacing: 1 });
  page.text('COMPLETE', { x: cx, y: cy - 12, font: 'Helvetica-Bold', size: 11.5, color: '#ffffff', align: 'center', spacing: 1 });
  for (let i = 0; i < 4; i++) page.path(star(cx - 15 + i * 10, cy - 28, 3.6), { fill: GOLD });
}

export function renderCertificate({ studentName, languageName, issuedAt, code, verifyUrl, lessonCount }) {
  const page = new PdfPage(W, H, { title: `${languageName} Certificate - ${studentName}`, author: 'Learning Hub' });
  const cx = W / 2 - 4;

  // Kaghaz
  page.rect(0, 0, W, H, { fill: PAPER });

  // Safed andar ka hissa, kate hue konon ke saath, aur uski sunehri lakeer
  const frame = [[228, 33], [722, 33], [722, 330], [688, 290], [520, 468], [28, 468], [28, 178], [62, 210]].map(P);
  page.path(frame, { fill: '#ffffff', stroke: GOLD, lineWidth: 1.6 });

  // Gehre teal kone (upar-bayen aur neeche-dayen) aur un ke andar patli safed lakeer
  page.path([[0, 0], [203, 0], [46, 167], [0, 115]].map(P), { fill: TEAL });
  page.path([[0, 103], [44, 153], [188, 0]].map(P), { stroke: '#ffffff', lineWidth: 1, closed: false });
  page.path([[757, 328], [757, 527], [545, 527], [716, 330]].map(P), { fill: TEAL });
  page.path([[580, 527], [716, 372], [757, 411]].map(P), { stroke: '#ffffff', lineWidth: 1, closed: false });

  // Title
  page.text('CERTIFICATE', { x: cx, y: H - 110 * SY, font: 'Helvetica-Bold', size: 36, color: TEAL, align: 'center', spacing: 5 });
  page.text('of completion', { x: cx, y: H - 136 * SY, font: 'Times-Italic', size: 21, color: TEAL, align: 'center', spacing: 3 });

  // Sunehri sajawat: lakeer aur dono taraf heere
  const orn = H - 152 * SY;
  page.line(cx - 78, orn, cx + 78, orn, { stroke: GOLD, lineWidth: 1.3 });
  for (const dx of [-84, 84]) page.path([[cx + dx - 6, orn], [cx + dx, orn + 4], [cx + dx + 6, orn], [cx + dx, orn - 4]], { fill: GOLD });
  page.path([[cx - 6, orn], [cx, orn + 3], [cx + 6, orn], [cx, orn - 3]], { fill: GOLD });

  // Naam
  page.text('THIS CERTIFICATE IS PROUDLY PRESENTED TO', { x: cx, y: H - 203 * SY, font: 'Helvetica-Bold', size: 11.5, color: INK, align: 'center', spacing: 1.2 });
  page.text(studentName, { x: cx, y: H - 252 * SY, font: 'Times-Italic', size: fitSize(studentName, 'Times-Italic', 50, 430, 22), color: TEAL, align: 'center' });
  page.line(cx - 190, H - 266 * SY, cx + 190, H - 266 * SY, { stroke: GOLD, lineWidth: 1.6 });

  // Tafseel
  page.text(`for successfully completing every lesson of the ${languageName} Course`, { x: cx, y: H - 303 * SY, font: 'Helvetica-Bold', size: 12.5, color: INK, align: 'center' });
  const lessons = lessonCount ? `all ${lessonCount} lessons` : 'every lesson';
  page.text(`Awarded on ${longDate(issuedAt)} for finishing ${lessons} of the ${languageName} course on Learning Hub.`, { x: cx, y: H - 328 * SY, font: 'Helvetica', size: 8.5, color: MUTED, align: 'center' });
  page.text('Anyone can confirm that this certificate is genuine by opening the link below.', { x: cx, y: H - 341 * SY, font: 'Helvetica', size: 8.5, color: MUTED, align: 'center' });

  // Neeche do jagah: tareekh aur certificate ID (dono sunehri lakeer ke upar)
  const base = H - 412 * SY;
  for (const [x, value, label] of [[cx - 130, longDate(issuedAt), 'DATE ISSUED'], [cx + 130, code, 'CERTIFICATE ID']]) {
    page.line(x - 76, base, x + 76, base, { stroke: GOLD, lineWidth: 1.4 });
    page.text(value, { x, y: base + 6, font: label === 'CERTIFICATE ID' ? 'Helvetica-Bold' : 'Helvetica', size: 11.5, color: INK, align: 'center', spacing: label === 'CERTIFICATE ID' ? 0.8 : 0 });
    page.text(label, { x, y: base - 11, font: 'Helvetica-Bold', size: 7.5, color: TEAL, align: 'center', spacing: 1.2 });
  }
  page.text(`Verify at ${verifyUrl}`, { x: cx, y: H - 446 * SY, font: 'Helvetica', size: 8.5, color: MUTED, align: 'center' });

  // Seal sab se upar (upar-dayen), border ke upar se guzarta hua
  seal(page, 613 * SX, H - 112 * SY);

  return page.toBuffer();
}
