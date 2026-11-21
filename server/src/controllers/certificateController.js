import Certificate from '../models/Certificate.js';
import Language from '../models/Language.js';
import Progress from '../models/Progress.js';
import Topic from '../models/Topic.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { makeCertificateCode, normalizeCode } from '../utils/certificateCode.js';
import { renderCertificate } from '../utils/certificatePdf.js';

const SLUG = /^[a-z0-9-]{1,50}$/;
const MAX_CODE_TRIES = 4;

const shape = (c) => ({ code: c.code, languageSlug: c.languageSlug, languageName: c.languageName, issuedAt: c.issuedAt, revoked: Boolean(c.revoked) });
const siteUrl = () => String(env.clientOrigin ?? '').split(',')[0].trim().replace(/\/+$/, '');

// ---------- Student ----------

export async function listMine(req, res) {
  const rows = await Certificate.find({ user: req.user.id }).sort({ issuedAt: -1 }).select('code languageSlug languageName issuedAt revoked -_id').lean();
  res.json({ certificates: rows.map(shape) });
}

// Language ke saare lessons khatam hon to certificate milta hai. Dobara maango to wahi purana wapas (koi duplicate nahi).
export async function issue(req, res) {
  const { slug } = req.params;
  if (!SLUG.test(slug)) return res.status(404).json({ message: 'Language not found' });

  const language = await Language.findOne({ slug }).select('name').lean();
  if (!language) return res.status(404).json({ message: 'Language not found' });

  const existing = await Certificate.findOne({ user: req.user.id, languageSlug: slug }).lean();
  if (existing) return res.json({ certificate: shape(existing), created: false });

  const [topics, progress] = await Promise.all([
    Topic.find({ languageSlug: slug }).select('slug -_id').lean(),
    Progress.findOne({ user: req.user.id, languageSlug: slug }).select('completed -_id').lean(),
  ]);
  const done = new Set(progress?.completed ?? []);
  const completed = topics.filter((t) => done.has(t.slug)).length;
  if (topics.length === 0 || completed < topics.length) {
    return res.status(403).json({ message: `Finish every lesson in ${language.name} first (${completed} of ${topics.length} done)`, completed, total: topics.length });
  }

  const me = await User.findById(req.user.id).select('name').lean();
  for (let attempt = 0; attempt < MAX_CODE_TRIES; attempt++) {
    try {
      const doc = await Certificate.create({
        user: req.user.id,
        languageSlug: slug,
        languageName: language.name,
        studentName: me?.name || 'Learner',
        code: makeCertificateCode(),
        lessonCount: topics.length,
      });
      return res.status(201).json({ certificate: shape(doc.toObject()), created: true });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      // Do tab ek saath dabane se duplicate: pehle wala hi sahi. Warna sirf code takraya, naya code try karo.
      const again = await Certificate.findOne({ user: req.user.id, languageSlug: slug }).lean();
      if (again) return res.json({ certificate: shape(again), created: false });
    }
  }
  res.status(500).json({ message: 'Could not create the certificate, please try again' });
}

// ---------- Public (login ke bagair): verify aur PDF ----------

async function findByCode(raw) {
  const code = normalizeCode(raw);
  return code ? Certificate.findOne({ code }).lean() : null;
}

export async function verify(req, res) {
  const cert = await findByCode(req.params.code);
  if (!cert) return res.status(404).json({ valid: false, message: 'No certificate found for this code' });
  if (cert.revoked) return res.json({ valid: false, revoked: true, message: 'This certificate has been revoked' });
  // Sirf naam, course aur tareekh: email ya koi aur zaati maloomat nahi
  res.json({ valid: true, code: cert.code, studentName: cert.studentName, languageName: cert.languageName, lessonCount: cert.lessonCount, issuedAt: cert.issuedAt });
}

export async function pdf(req, res) {
  const cert = await findByCode(req.params.code);
  if (!cert || cert.revoked) return res.status(404).json({ message: 'No certificate found for this code' });
  const file = renderCertificate({
    studentName: cert.studentName,
    languageName: cert.languageName,
    issuedAt: cert.issuedAt,
    code: cert.code,
    lessonCount: cert.lessonCount,
    verifyUrl: `${siteUrl()}/verify/${cert.code}`,
  });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="Learning-Hub-${cert.languageSlug}-certificate.pdf"`,
    'Cache-Control': 'no-cache', // revoke hone par purani copy na chale
    'Content-Length': String(file.length),
  });
  res.send(file);
}
