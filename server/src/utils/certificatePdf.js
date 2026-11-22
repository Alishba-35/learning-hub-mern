import { readFileSync } from 'node:fs';
import { fitSize, PdfPage } from './pdf.js';
import { decodePng } from './png.js';

// A4 aaray (landscape). Design: halka ivory kaghaz, kone mein gehre navy-teal tikone, sunehri lakeer,
// upar-dayen Learning Hub ka logo, neeche signature, naam aur verify link. Naqsha 757x527 ke reference design par
// bana hai, is liye nuqte usi paimane mein (px) likhe hain.
const W = 841.89;
const H = 595.28;
const SX = W / 757;
const SY = H / 527;
const P = ([x, y]) => [x * SX, H - y * SY]; // design ka nuqta -> PDF ka nuqta

// Rang Learning Hub ke logo se liye gaye hain: gehra navy-teal + sunehri, ivory kaghaz par
const NAVY = '#0a3a4c';
const NAVY_SOFT = '#17596e';
const ACCENT = '#1b7f9a'; // logo ki kitaab wali neeli-hari patti
const GOLD = '#cf9f35';
const GOLD_LIGHT = '#e8c46a';
const PAPER = '#f4efe2';
const INK = '#12313d';
const MUTED = '#6b7479';

// Signature wale ka naam aur oohda: yahan se badal sakte hain
const SIGNATORY = { name: 'Alishba Noor', title: 'Founder, Learning Hub' };

// Logo aur signature (server/src/assets). Ek baar parh kar yaad rakhte hain; file na mile to certificate phir bhi banta hai.
const cache = new Map();
function loadImage(file) {
  if (!cache.has(file)) {
    try {
      cache.set(file, decodePng(readFileSync(new URL(`../assets/${file}`, import.meta.url))));
    } catch (err) {
      console.warn(`Certificate: could not load ${file}: ${err.message}`);
      cache.set(file, null);
    }
  }
  return cache.get(file);
}

const longDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Tasveer ko dabbe (cx, cy, maxW, maxH) ke beech mein, asli tanasub (aspect) mein rakho
function placeImage(page, img, cx, cy, maxW, maxH) {
  if (!img) return;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.image(img, cx - w / 2, cy - h / 2, w, h);
}

export function renderCertificate({ studentName, languageName, issuedAt, code, verifyUrl, lessonCount }) {
  const page = new PdfPage(W, H, { title: `${languageName} Certificate - ${studentName}`, author: 'Learning Hub' });
  const cx = W / 2 - 4;

  // Kaghaz
  page.rect(0, 0, W, H, { fill: PAPER });
  page.rect(10, 10, W - 20, H - 20, { stroke: GOLD, lineWidth: 0.8 }); // bahar ki patli sunehri fareem

  // Safed andar ka hissa, kate hue konon ke saath, aur uski sunehri lakeer
  const frame = [[228, 33], [722, 33], [722, 330], [688, 290], [520, 468], [28, 468], [28, 178], [62, 210]].map(P);
  page.path(frame, { fill: '#fffdf8', stroke: GOLD, lineWidth: 1.6 });

  // Gehre teal kone (upar-bayen aur neeche-dayen) aur un ke andar patli safed lakeer
  page.path([[0, 0], [203, 0], [46, 167], [0, 115]].map(P), { fill: NAVY });
  page.path([[0, 103], [44, 153], [188, 0]].map(P), { stroke: GOLD_LIGHT, lineWidth: 1, closed: false });
  page.path([[757, 328], [757, 527], [545, 527], [716, 330]].map(P), { fill: NAVY });
  page.path([[580, 527], [716, 372], [757, 411]].map(P), { stroke: GOLD_LIGHT, lineWidth: 1, closed: false });

  // Title
  page.text('CERTIFICATE', { x: cx, y: H - 110 * SY, font: 'Helvetica-Bold', size: 36, color: NAVY, align: 'center', spacing: 5 });
  page.text('of completion', { x: cx, y: H - 136 * SY, font: 'Times-Italic', size: 21, color: NAVY, align: 'center', spacing: 3 });

  // Sunehri sajawat: lakeer aur dono taraf heere
  const orn = H - 152 * SY;
  page.line(cx - 78, orn, cx + 78, orn, { stroke: GOLD, lineWidth: 1.3 });
  for (const dx of [-84, 84]) page.path([[cx + dx - 6, orn], [cx + dx, orn + 4], [cx + dx + 6, orn], [cx + dx, orn - 4]], { fill: GOLD });
  page.path([[cx - 6, orn], [cx, orn + 3], [cx + 6, orn], [cx, orn - 3]], { fill: GOLD });

  // Naam
  page.text('THIS CERTIFICATE IS PROUDLY PRESENTED TO', { x: cx, y: H - 203 * SY, font: 'Helvetica-Bold', size: 11.5, color: INK, align: 'center', spacing: 1.2 });
  page.text(studentName, { x: cx, y: H - 252 * SY, font: 'Times-Italic', size: fitSize(studentName, 'Times-Italic', 50, 430, 22), color: NAVY, align: 'center' });
  page.line(cx - 190, H - 266 * SY, cx + 190, H - 266 * SY, { stroke: GOLD, lineWidth: 1.6 });

  // Tafseel
  page.text(`for successfully completing every lesson of the ${languageName} Course`, { x: cx, y: H - 303 * SY, font: 'Helvetica-Bold', size: 12.5, color: INK, align: 'center' });
  const lessons = lessonCount ? `all ${lessonCount} lessons` : 'every lesson';
  page.text(`Awarded on ${longDate(issuedAt)} for finishing ${lessons} of the ${languageName} course on Learning Hub.`, { x: cx, y: H - 328 * SY, font: 'Helvetica', size: 8.5, color: MUTED, align: 'center' });
  page.text('Anyone can confirm that this certificate is genuine by opening the link below.', { x: cx, y: H - 341 * SY, font: 'Helvetica', size: 8.5, color: MUTED, align: 'center' });

  // Neeche teen jagah, sab sunehri lakeer ke upar: signature, tareekh, certificate ID.
  // Neeche-dayen kone ka navy tikona hai, is liye teeno bayen taraf ko khiske hue hain.
  const base = H - 412 * SY;
  const colSig = 140;
  const colDate = 340;
  const colId = 540;
  const rule = (x) => page.line(x - 76, base, x + 76, base, { stroke: GOLD, lineWidth: 1.4 });

  // 1) Signature: lakeer ke upar haath ka signature, neeche naam aur oohda
  rule(colSig);
  placeImage(page, loadImage('signature.png'), colSig, base + 42, 142, 82);
  page.text(SIGNATORY.name, { x: colSig, y: base - 13, font: 'Times-Italic', size: 14, color: NAVY, align: 'center' });
  page.text(SIGNATORY.title, { x: colSig, y: base - 25, font: 'Helvetica-Bold', size: 7, color: ACCENT, align: 'center', spacing: 0.9 });

  // 2) Tareekh aur 3) certificate ID
  for (const [x, value, label] of [[colDate, longDate(issuedAt), 'DATE ISSUED'], [colId, code, 'CERTIFICATE ID']]) {
    rule(x);
    page.text(value, { x, y: base + 6, font: label === 'CERTIFICATE ID' ? 'Helvetica-Bold' : 'Helvetica', size: 11.5, color: INK, align: 'center', spacing: label === 'CERTIFICATE ID' ? 0.8 : 0 });
    page.text(label, { x, y: base - 11, font: 'Helvetica-Bold', size: 7.5, color: ACCENT, align: 'center', spacing: 1.2 });
  }
  page.text(`Verify at ${verifyUrl}`, { x: cx, y: H - 446 * SY, font: 'Helvetica', size: 8.5, color: MUTED, align: 'center' });

  // Learning Hub ka logo (upar-dayen), jo pehle seal ki jagah tha
  placeImage(page, loadImage('logo.png'), 613 * SX, H - 112 * SY, 132, 132);

  return page.toBuffer();
}
