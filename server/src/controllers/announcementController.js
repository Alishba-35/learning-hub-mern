import mongoose from 'mongoose';
import Announcement from '../models/Announcement.js';
import User from '../models/User.js';

const STUDENT_LIMIT = 5;
const ADMIN_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- Student: apne announcements ----------

// Sab ke liye + jo khaas mujhe bheje gaye; expired nahi. Important pehle, phir nayi.
export async function listMine(req, res) {
  const now = new Date();
  const rows = await Announcement.find({
    $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $or: [{ audience: 'everyone' }, { recipients: req.user.id }] }],
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('title body level audience createdAt expiresAt')
    .lean();

  const rank = (a) => (a.level === 'important' ? 0 : 1);
  const announcements = rows
    .sort((a, b) => rank(a) - rank(b) || new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, STUDENT_LIMIT)
    .map((a) => ({ id: String(a._id), title: a.title, body: a.body, level: a.level, personal: a.audience === 'selected', createdAt: a.createdAt, expiresAt: a.expiresAt ?? null }));
  res.json({ announcements });
}

// ---------- Admin ----------

const adminShape = (a, now = new Date()) => ({
  id: String(a._id),
  title: a.title,
  body: a.body,
  level: a.level,
  audience: a.audience,
  recipientCount: a.audience === 'selected' ? (a.recipients?.length ?? 0) : null,
  createdAt: a.createdAt,
  expiresAt: a.expiresAt ?? null,
  active: !a.expiresAt || new Date(a.expiresAt) > now,
  createdByName: a.createdByName ?? '',
});

export async function listAll(req, res) {
  const rows = await Announcement.find().sort({ createdAt: -1 }).limit(ADMIN_LIMIT).lean();
  res.json({ announcements: rows.map((a) => adminShape(a)) });
}

export async function create(req, res) {
  const { title, body, level, audience, userIds, expiresInDays } = req.body;

  let recipients = [];
  if (audience === 'selected') {
    // Sirf maujooda students; baqi ids chup chap hata di jati hain
    const found = await User.find({ _id: { $in: userIds }, role: 'student' }).select('_id').lean();
    if (!found.length) return res.status(400).json({ message: 'No matching students found' });
    recipients = found.map((u) => u._id);
  }

  const me = await User.findById(req.user.id).select('name').lean();
  const doc = await Announcement.create({
    title,
    body,
    level,
    audience,
    recipients,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * DAY_MS) : null,
    createdBy: req.user.id,
    createdByName: me?.name ?? '',
  });
  res.status(201).json({ announcement: adminShape(doc.toObject()), recipients: recipients.length });
}

export async function remove(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Announcement not found' });
  const gone = await Announcement.findByIdAndDelete(req.params.id).lean();
  if (!gone) return res.status(404).json({ message: 'Announcement not found' });
  res.status(204).end();
}
