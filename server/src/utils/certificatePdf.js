import { readFileSync } from 'node:fs';
import { fitSize, PdfPage, textWidth } from './pdf.js';
import { decodePng, readJpeg } from './png.js';
import { loadFont } from './ttf.js';

// Design: certificate-template.jpg (navy + purple, Learning Hub ke rang). Template mein sirf wo cheezein hain jo
// har certificate par ek jaisi rehti hain (title, seal, rosette, sajawat). Naam, course, tareekh, ID, signature aur logo
// har baar PDF mein asli (saaf, crisp) text/tasveer ki tarah likhe jate hain.
// Saare nuqte template ke 1536 x 1024 px par naape gaye hain; PX() unhein PDF points mein badalta hai.
const W = 841.89;
const H = (W * 1024) / 1536;
const K = W / 1536;
const X = (px) => px * K;
const Y = (px) => H - px * K;

// Rang template se liye gaye hain
const NAVY = '#06102f';
const PURPLE = '#4814c4';
const MUTED = '#565b78';

// Signature wale ka naam: yahan se badal sakte hain
const SIGNATORY = 'Alishba Noor';

// Tasveerein (server/src/assets). Ek baar parh kar yaad rakhte hain; na milein to certificate phir bhi banta hai.
const cache = new Map();
function load(file, reader) {
  if (!cache.has(file)) {
    try {
      cache.set(file, reader(readFileSync(new URL(`../assets/${file}`, import.meta.url))));
    } catch (err) {
      console.warn(`Certificate: could not load ${file}: ${err.message}`);
      cache.set(file, null);
    }
  }
  return cache.get(file);
}
const png = (file) => load(file, decodePng);
const jpeg = (file) => load(file, readJpeg);

const TtfClean = (t) => String(t ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const longDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Tasveer ko dabbe (cx, cy, maxW, maxH) ke beech mein, asli tanasub (aspect) mein rakho
function placeImage(page, img, cx, cy, maxW, maxH) {
  if (!img) return;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.image(img, cx - w / 2, cy - h / 2, w, h);
}

// Ek line jis mein alag alag font/rang ke tukde hon, beech mein rakhi hui. Zyada chaurai ho to size chhota ho jata hai.
function centeredRuns(page, runs, cx, y, size, maxWidth) {
  const gapAt = (font, s) => textWidth('i i', font, s) - textWidth('ii', font, s);
  const total = (s) => runs.reduce((sum, r, i) => sum + textWidth(r.text, r.font, s) + (i ? gapAt(r.font, s) : 0), 0);
  let s = size;
  while (s > 7 && total(s) > maxWidth) s -= 0.2;
  let x = cx - total(s) / 2;
  runs.forEach((r, i) => {
    if (i) x += gapAt(r.font, s);
    page.text(r.text, { x, y, font: r.font, size: s, color: r.color });
    x += textWidth(r.text, r.font, s);
  });
}

// Pehle certificate ka page banata hai (tests isi ko dekhte hain), renderCertificate use PDF bana deta hai
export function buildCertificate({ studentName, languageName, issuedAt, code, verifyUrl, lessonCount }) {
  const page = new PdfPage(W, H, { title: `${languageName} Certificate - ${studentName}`, author: 'Learning Hub' });

  // Fonts: na milein to standard fonts se kaam chalta hai
  const script = loadFont('GreatVibes-Regular.ttf', 'GreatVibes-Regular');
  const medium = loadFont('Poppins-Medium.ttf', 'Poppins-Medium') || 'Helvetica';
  const semi = loadFont('Poppins-SemiBold.ttf', 'Poppins-SemiBold') || 'Helvetica-Bold';
  // Script font mein sirf Latin harf hain; kisi aur zabaan ka naam ho to Times-Italic (jahan "?" ban jate hain)
  const nameFont = script && script.covers(studentName) ? script : 'Times-Italic';

  // Background template (poora page), warna saada safed
  const template = jpeg('certificate-template.jpg');
  if (template) page.image(template, 0, 0, W, H);
  else page.rect(0, 0, W, H, { fill: '#f4f3fb' });

  // Logo (dark panel ke liye halka version), upar-bayen
  placeImage(page, png('logo-light.png'), X(186), Y(155), X(262), X(262));

  // Naam: script font ka space bahut tang hota hai, is liye har lafz alag likhte hain aur beech mein saaf gap rakhte hain
  const CX = 821;
  const nameSize = fitSize(TtfClean(studentName).split(' ').join('  '), nameFont, nameFont === script ? 70 : 54, X(800), 22);
  const words = TtfClean(studentName).split(' ').filter(Boolean);
  const gap = nameSize * (nameFont === script ? 0.34 : 0.25);
  const widths = words.map((w) => textWidth(w, nameFont, nameSize));
  let wx = X(CX) - (widths.reduce((a, b) => a + b, 0) + gap * Math.max(words.length - 1, 0)) / 2;
  words.forEach((w, i) => {
    page.text(w, { x: wx, y: Y(466), font: nameFont, size: nameSize, color: NAVY, bold: nameFont === script ? 0.7 : 0 });
    wx += widths[i] + gap;
  });

  // Course aur tafseel
  const TX = 816;
  const language = String(languageName ?? '');
  centeredRuns(page, [{ text: 'for successfully completing the', font: medium, color: NAVY }, { text: `${language} Course`, font: semi, color: PURPLE }], X(TX), Y(571), 13.4, X(810));
  const lessons = lessonCount ? `You completed all ${lessonCount} lessons and showed excellent ${language} skills` : `You showed excellent ${language} skills`;
  [['with dedication, hard work and a passion for coding.', 612], [lessons, 644], ['and are now one step closer to becoming a skilled developer.', 676]].forEach(([line, y]) => {
    centeredRuns(page, [{ text: line, font: medium, color: NAVY }], X(TX), Y(y), 11.6, X(790));
  });

  // Tareekh (calendar icon aur "DATE OF ISSUE" template mein hain)
  page.text(longDate(issuedAt), { x: X(432), y: Y(853), font: medium, size: 13, color: NAVY });

  // Certificate ID aur verify link, tareekh ke neeche (seal se pehle khatam)
  page.text('CERTIFICATE ID', { x: X(433), y: Y(938), font: medium, size: 6.6, color: MUTED, spacing: 1.2 });
  page.text(code, { x: X(433) + textWidth('CERTIFICATE ID', medium, 6.6, 1.2) + 6, y: Y(938), font: semi, size: 8.2, color: PURPLE, spacing: 0.5 });
  const link = String(verifyUrl ?? '').replace(/^https?:\/\//, '');
  const linkSize = [6.6, 6.2, 5.8, 5.4, 5].find((sz) => textWidth(link, medium, sz) <= X(335)) ?? 5;
  page.text(link, { x: X(433), y: Y(958), font: medium, size: linkSize, color: MUTED });
  if (verifyUrl) page.link(X(433), Y(958) - 2, textWidth(link, medium, linkSize), linkSize + 3, verifyUrl); // PDF mein clickable

  // Signature: lakeer (template mein) ke upar, neeche naam aur "AUTHORIZED SIGNATURE"
  placeImage(page, png('signature.png'), X(1163), Y(868 - 70), X(250), X(140));
  page.text(SIGNATORY, { x: X(1163), y: Y(902), font: semi, size: 10.8, color: NAVY, align: 'center' });
  page.text('AUTHORIZED SIGNATURE', { x: X(1163), y: Y(924), font: medium, size: 7.2, color: NAVY, align: 'center', spacing: 1.6 });

  return page;
}

export function renderCertificate(details) {
  return buildCertificate(details).toBuffer();
}
