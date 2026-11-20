import mongoose from 'mongoose';
import Activity from '../models/Activity.js';
import Language from '../models/Language.js';
import Progress from '../models/Progress.js';
import Quiz from '../models/Quiz.js';
import QuizResult from '../models/QuizResult.js';
import RefreshToken from '../models/RefreshToken.js';
import Topic from '../models/Topic.js';
import User from '../models/User.js';
import UserStats from '../models/UserStats.js';
import Video from '../models/Video.js';
import VideoChunk from '../models/VideoChunk.js';
import { PASS_PERCENT } from '../utils/quiz.js';
import { addDays, badgesFor, buildSeries, currentStreak, levelInfo, quizScore, utcDay } from '../utils/progress.js';
import { shape } from './videoController.js';

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNUP_DAYS = 30;
const EXPORT_LIMIT = 5000;
const STATUSES = ['pending', 'approved', 'rejected'];
const LISTED_ROLES = ['student', 'teacher'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageOf = (req) => Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 1000);
const textOf = (v) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');
const notFound = (res, what = 'Video') => res.status(404).json({ message: `${what} not found` });
const emptyCounts = () => ({ pending: 0, approved: 0, rejected: 0, total: 0 });
const adminShape = (v, user) => ({ ...shape(v, user), uploaderId: v.uploadedBy ? String(v.uploadedBy) : null, reviewedAt: v.reviewedAt ?? null });

// Kuch users ke videos ki ginti: Map(userId -> {pending, approved, rejected, total})
async function videoCounts(userIds) {
  const counts = new Map();
  if (!userIds.length) return counts;
  const grouped = await Video.aggregate([
    { $match: { uploadedBy: { $in: userIds }, status: { $in: STATUSES } } },
    { $group: { _id: { user: '$uploadedBy', status: '$status' }, n: { $sum: 1 } } },
  ]);
  for (const g of grouped) {
    const key = String(g._id.user);
    const c = counts.get(key) ?? emptyCounts();
    c[g._id.status] = g.n;
    c.total += g.n;
    counts.set(key, c);
  }
  return counts;
}

async function statsByUser(userIds, today) {
  const rows = userIds.length ? await UserStats.find({ user: { $in: userIds } }).select('user xp streak lastActiveDay').lean() : [];
  return new Map(rows.map((s) => [String(s.user), { xp: s.xp, level: levelInfo(s.xp).level, streak: currentStreak(s, today), lastActiveDay: s.lastActiveDay || null }]));
}
const noStats = { xp: 0, level: 1, streak: 0, lastActiveDay: null };

// ---------- Overview ----------

export async function getStats(req, res) {
  const today = utcDay();
  const signupSince = new Date(Date.now() - (SIGNUP_DAYS - 1) * DAY_MS);
  signupSince.setUTCHours(0, 0, 0, 0);

  const [students, newStudents, byStatus, signupRows, activeWeek, topStats, progressRows, languages, quizRows] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'student', createdAt: { $gte: new Date(Date.now() - 7 * DAY_MS) } }),
    Video.aggregate([{ $match: { status: { $in: STATUSES } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    User.aggregate([
      { $match: { role: 'student', createdAt: { $gte: signupSince } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
    ]),
    UserStats.countDocuments({ lastActiveDay: { $gte: addDays(today, -6) } }),
    UserStats.find().sort({ xp: -1 }).limit(10).select('user xp streak').lean(),
    Progress.aggregate([
      { $match: { 'completed.0': { $exists: true } } },
      { $group: { _id: '$languageSlug', learners: { $sum: 1 }, lessons: { $sum: { $size: '$completed' } } } },
    ]),
    Language.find().select('slug name color').lean(),
    QuizResult.aggregate([
      { $match: { attempts: { $gt: 0 } } },
      { $group: { _id: null, attempts: { $sum: '$attempts' }, best: { $sum: '$bestScore' }, possible: { $sum: '$total' }, takers: { $addToSet: '$user' } } },
    ]),
  ]);

  const videos = { pending: 0, approved: 0, rejected: 0 };
  for (const row of byStatus) videos[row._id] = row.n;

  const perDay = new Map(signupRows.map((r) => [r._id, r.n]));
  const signups = Array.from({ length: SIGNUP_DAYS }, (_, i) => {
    const day = addDays(today, i - (SIGNUP_DAYS - 1));
    return { day, count: perDay.get(day) ?? 0 };
  });

  const topUsers = topStats.length ? await User.find({ _id: { $in: topStats.map((s) => s.user) }, role: 'student' }).select('name').lean() : [];
  const nameOf = new Map(topUsers.map((u) => [String(u._id), u.name]));
  const topLearners = topStats
    .filter((s) => nameOf.has(String(s.user)) && s.xp > 0)
    .slice(0, 5)
    .map((s) => ({ id: String(s.user), name: nameOf.get(String(s.user)), xp: s.xp, level: levelInfo(s.xp).level, streak: s.streak }));

  const popularLanguages = progressRows
    .map((r) => ({ slug: r._id, name: languages.find((l) => l.slug === r._id)?.name ?? r._id, color: languages.find((l) => l.slug === r._id)?.color ?? '#4a56c9', learners: r.learners, lessons: r.lessons }))
    .sort((a, b) => b.learners - a.learners || b.lessons - a.lessons)
    .slice(0, 8);

  const q = quizRows[0];
  const quizzes = { attempts: q?.attempts ?? 0, takers: q?.takers?.length ?? 0, averagePercent: q?.possible ? Math.round((q.best / q.possible) * 100) : null };

  res.json({ students, newStudents, activeWeek, videos, signups, topLearners, popularLanguages, quizzes });
}

// ---------- Students ----------

// Signup hue users (naam, email, kab sign up kiya, XP, last active) aur unke videos ki ginti
export async function listStudents(req, res) {
  const role = req.query.role || 'student';
  if (!LISTED_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
  const filter = { role };
  const search = textOf(req.query.search);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const page = pageOf(req);
  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).select('name email purpose role disabled createdAt').lean(),
    User.countDocuments(filter),
  ]);
  const ids = rows.map((u) => u._id);
  const [counts, stats] = await Promise.all([videoCounts(ids), statsByUser(ids, utcDay())]);

  res.json({
    students: rows.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      purpose: u.purpose ?? '',
      role: u.role,
      disabled: Boolean(u.disabled),
      joinedAt: u.createdAt,
      stats: stats.get(String(u._id)) ?? noStats,
      videos: counts.get(String(u._id)) ?? emptyCounts(),
    })),
    page,
    pages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
    total,
  });
}

// Ek student ki poori tasveer: profile, XP/streak, har language mein progress, quizzes, recent activity, videos
export async function getStudent(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res, 'Student');
  const userId = req.params.id;
  const today = utcDay();
  const since = addDays(today, -13);

  const user = await User.findById(userId).select('name email purpose role disabled disabledReason createdAt').lean();
  if (!user) return notFound(res, 'Student');

  const [stats, progressDocs, languages, topicCounts, quizDefs, results, window, recent, sessions, counts] = await Promise.all([
    UserStats.findOne({ user: userId }).lean(),
    Progress.find({ user: userId }).select('languageSlug completed lastTopic -_id').lean(),
    Language.find().sort('order').select('slug name color -_id').lean(),
    Topic.aggregate([{ $group: { _id: '$languageSlug', n: { $sum: 1 } } }]),
    Quiz.find().select('languageSlug slug title -_id').lean(),
    QuizResult.find({ user: userId, attempts: { $gt: 0 } }).select('languageSlug quizSlug bestScore lastScore total attempts lastAt -_id').lean(),
    Activity.find({ user: userId, day: { $gte: since } }).select('day xp type -_id').lean(),
    Activity.find({ user: userId }).sort({ at: -1 }).limit(15).select('type languageSlug title detail xp at -_id').lean(),
    RefreshToken.countDocuments({ user: userId }),
    videoCounts([user._id]),
  ]);

  const quizTitle = new Map(quizDefs.map((q) => [`${q.languageSlug}/${q.slug}`, q.title]));
  const taken = results.filter((r) => quizTitle.has(`${r.languageSlug}/${r.quizSlug}`)); // sirf maujooda quizzes
  const topicsIn = new Map(topicCounts.map((t) => [t._id, t.n]));
  const progressBy = new Map(progressDocs.map((p) => [p.languageSlug, p]));

  const langRows = languages.map((l) => {
    const total = topicsIn.get(l.slug) ?? 0;
    const completed = Math.min(progressBy.get(l.slug)?.completed.length ?? 0, total);
    const inLang = taken.filter((r) => r.languageSlug === l.slug);
    return {
      slug: l.slug,
      name: l.name,
      color: l.color,
      total,
      completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
      lastTopic: progressBy.get(l.slug)?.lastTopic ?? '',
      quizzesTaken: inLang.length,
      score: quizScore(inLang),
    };
  });

  const quizTotals = {
    total: quizDefs.length,
    taken: taken.length,
    passed: taken.filter((r) => r.total && (r.bestScore / r.total) * 100 >= PASS_PERCENT).length,
    perfect: taken.filter((r) => r.total && r.bestScore === r.total).length,
  };
  const completedTotal = langRows.reduce((sum, r) => sum + r.completed, 0);
  const xp = stats?.xp ?? 0;
  const longestStreak = stats?.longestStreak ?? 0;
  const badges = badgesFor({ completedTotal, longestStreak, languages: langRows, quizzes: quizTotals });

  res.json({
    student: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      purpose: user.purpose ?? '',
      role: user.role,
      disabled: Boolean(user.disabled),
      disabledReason: user.disabledReason ?? '',
      joinedAt: user.createdAt,
      sessions,
    },
    stats: { xp, ...levelInfo(xp), streak: stats ? currentStreak(stats, today) : 0, longestStreak, lastActiveDay: stats?.lastActiveDay || null, completedTotal, quizzes: quizTotals },
    languages: langRows,
    quizzes: taken
      .map((r) => ({
        languageSlug: r.languageSlug,
        quizSlug: r.quizSlug,
        title: quizTitle.get(`${r.languageSlug}/${r.quizSlug}`),
        bestScore: r.bestScore,
        total: r.total,
        percent: r.total ? Math.round((r.bestScore / r.total) * 100) : 0,
        attempts: r.attempts,
        lastAt: r.lastAt ?? null,
      }))
      .sort((a, b) => new Date(b.lastAt ?? 0) - new Date(a.lastAt ?? 0)),
    badges: badges.filter((b) => b.earned).map(({ id, title, description }) => ({ id, title, description })),
    series: buildSeries(window, today, 14),
    recent,
    videos: counts.get(String(user._id)) ?? emptyCounts(),
  });
}

// ---------- Account actions ----------

// Admin ya khud apne par koi action nahi chalta (galti se apna account na ura de)
async function loadManageable(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res, 'Student'), null;
  const user = await User.findById(req.params.id).select('name email role').lean();
  if (!user) return notFound(res, 'Student'), null;
  if (user.role === 'admin' || String(user._id) === req.user.id) {
    res.status(403).json({ message: 'Admin accounts cannot be changed here' });
    return null;
  }
  return user;
}

export async function setSuspension(req, res) {
  const user = await loadManageable(req, res);
  if (!user) return;
  const { disabled, reason } = req.body;
  const disabledReason = disabled ? reason : '';
  await User.updateOne({ _id: user._id }, { $set: { disabled, disabledReason } });
  if (disabled) await RefreshToken.deleteMany({ user: user._id }); // refresh nahi hoga: access token khatam hote hi bahar
  res.json({ id: String(user._id), disabled, disabledReason });
}

export async function setRole(req, res) {
  const user = await loadManageable(req, res);
  if (!user) return;
  await User.updateOne({ _id: user._id }, { $set: { role: req.body.role } });
  res.json({ id: String(user._id), role: req.body.role });
}

// Account aur uska sara data hamesha ke liye. Server khud email dobara poochta hai (confirm), taake galti se na ho.
export async function deleteStudent(req, res) {
  const user = await loadManageable(req, res);
  if (!user) return;
  if (String(req.query.confirm ?? '').trim().toLowerCase() !== user.email) {
    return res.status(400).json({ message: "Type the student's email to confirm" });
  }
  const uploads = await Video.find({ uploadedBy: user._id, source: 'upload' }).select('_id').lean();
  if (uploads.length) await VideoChunk.deleteMany({ video: { $in: uploads.map((v) => v._id) } });
  await Promise.all([
    Video.deleteMany({ uploadedBy: user._id }),
    Progress.deleteMany({ user: user._id }),
    QuizResult.deleteMany({ user: user._id }),
    UserStats.deleteMany({ user: user._id }),
    Activity.deleteMany({ user: user._id }),
    RefreshToken.deleteMany({ user: user._id }),
  ]);
  await User.deleteOne({ _id: user._id });
  res.status(204).end();
}

// CSV: Excel/Sheets mein khulti hai. "=" "+" "-" "@" se shuru hone wali cells ko ' laga dete hain (formula injection se bachao).
const cell = (value) => {
  const s = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function exportStudents(req, res) {
  const rows = await User.find({ role: 'student' }).sort({ createdAt: -1 }).limit(EXPORT_LIMIT).select('name email purpose disabled createdAt').lean();
  const ids = rows.map((u) => u._id);
  const [counts, stats] = await Promise.all([videoCounts(ids), statsByUser(ids, utcDay())]);

  const header = ['Name', 'Email', 'Signed up', 'Purpose', 'XP', 'Level', 'Streak', 'Last active', 'Videos approved', 'Videos waiting', 'Videos rejected', 'Status'];
  const lines = rows.map((u) => {
    const s = stats.get(String(u._id)) ?? noStats;
    const v = counts.get(String(u._id)) ?? emptyCounts();
    return [u.name, u.email, new Date(u.createdAt).toISOString().slice(0, 10), u.purpose, s.xp, s.level, s.streak, s.lastActiveDay ?? '', v.approved, v.pending, v.rejected, u.disabled ? 'Suspended' : 'Active'].map(cell).join(',');
  });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="students-${utcDay()}.csv"`, 'Cache-Control': 'no-store' });
  res.send(`\uFEFF${[header.map(cell).join(','), ...lines].join('\r\n')}\r\n`);
}

// ---------- Videos ----------

// Saare videos (filter: status, student, search) taake admin irrelevant video pakar sake
export async function listVideos(req, res) {
  const filter = {};
  const { status, student } = req.query;
  if (status && status !== 'all') {
    if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    filter.status = status;
  } else {
    filter.status = { $in: STATUSES }; // adhoori (uploading) uploads nahi
  }
  if (student) {
    if (!mongoose.isValidObjectId(student)) return res.status(400).json({ message: 'Invalid student' });
    filter.uploadedBy = student;
  }
  const search = textOf(req.query.search);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { uploaderName: rx }];
  }
  const page = pageOf(req);
  const [rows, total] = await Promise.all([
    Video.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Video.countDocuments(filter),
  ]);
  res.json({ videos: rows.map((v) => adminShape(v, req.user)), page, pages: Math.max(Math.ceil(total / PAGE_SIZE), 1), total });
}

// Admin ka faisla: approved / rejected (wajah ke saath) / wapas pending
export async function setVideoStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const { status, reason } = req.body;
  const update = {
    status,
    rejectReason: status === 'rejected' ? reason : '',
    reviewedBy: status === 'pending' ? null : req.user.id,
    reviewedAt: status === 'pending' ? null : new Date(),
  };
  const video = await Video.findOneAndUpdate({ _id: req.params.id, status: { $in: STATUSES } }, { $set: update }, { returnDocument: 'after' }).lean();
  if (!video) return notFound(res);
  res.json({ video: adminShape(video, req.user) });
}
