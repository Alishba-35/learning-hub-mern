import Activity from '../models/Activity.js';
import Language from '../models/Language.js';
import Progress from '../models/Progress.js';
import Quiz from '../models/Quiz.js';
import QuizResult from '../models/QuizResult.js';
import Topic from '../models/Topic.js';
import UserStats from '../models/UserStats.js';
import { awardXp } from '../utils/award.js';
import { retryOnDuplicate } from '../utils/retry.js';
import { topicTitle } from '../utils/topicIndex.js';
import { PASS_PERCENT } from '../utils/quiz.js';
import {
  XP_PER_LESSON,
  addDays,
  badgesFor,
  buildSeries,
  currentStreak,
  levelInfo,
  nextIncomplete,
  resolveDay,
  weekSummary,
} from '../utils/progress.js';

const SLUG = /^[a-z0-9-]{1,50}$/;
const notFound = (res) => res.status(404).json({ message: 'Lesson not found' });

// Lesson ka title (ya null agar maujood nahi)
async function lessonTitle(language, topic) {
  return SLUG.test(language) && SLUG.test(topic) ? topicTitle(language, topic) : null;
}

const upsertProgress = (filter, update) => retryOnDuplicate(() => Progress.updateOne(filter, update, { upsert: true }));

export async function getOverview(req, res) {
  const userId = req.user.id;
  const today = resolveDay(req.query.day);
  const since = addDays(today, -13);

  const [progressDocs, stats, languages, topicRows, quizRows, quizResults, windowActivities, recent] = await Promise.all([
    Progress.find({ user: userId }).select('languageSlug completed lastTopic -_id').lean(),
    UserStats.findOne({ user: userId }).lean(),
    Language.find().sort('order').select('slug name color description -_id').lean(),
    Topic.find().sort('order').select('languageSlug slug title -_id').lean(),
    Quiz.find().select('languageSlug slug -_id').lean(),
    QuizResult.find({ user: userId, attempts: { $gt: 0 } }).select('languageSlug quizSlug bestScore total -_id').lean(),
    Activity.find({ user: userId, day: { $gte: since } }).select('day xp type -_id').lean(),
    Activity.find({ user: userId }).sort({ at: -1 }).limit(6).select('type languageSlug title detail xp at -_id').lean(),
  ]);

  const progressBySlug = new Map(progressDocs.map((p) => [p.languageSlug, p]));
  // topicRows order ke mutabiq sorted hain
  const topicsByLanguage = new Map();
  for (const t of topicRows) {
    if (!topicsByLanguage.has(t.languageSlug)) topicsByLanguage.set(t.languageSlug, []);
    topicsByLanguage.get(t.languageSlug).push(t);
  }

  // Quiz ke sirf wohi natije gine jate hain jo quiz abhi maujood hain
  const existingQuizzes = new Set(quizRows.map((q) => `${q.languageSlug}/${q.slug}`));
  const taken = quizResults.filter((r) => existingQuizzes.has(`${r.languageSlug}/${r.quizSlug}`));
  const quizzes = {
    total: quizRows.length,
    taken: taken.length,
    passed: taken.filter((r) => r.total && (r.bestScore / r.total) * 100 >= PASS_PERCENT).length,
    perfect: taken.filter((r) => r.total && r.bestScore === r.total).length,
  };

  const rows = languages.map((l) => {
    const topics = topicsByLanguage.get(l.slug) ?? [];
    const progress = progressBySlug.get(l.slug);
    const total = topics.length;
    const completed = Math.min(progress?.completed.length || 0, total);
    return {
      slug: l.slug,
      name: l.name,
      color: l.color,
      total,
      completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
      xp: completed * XP_PER_LESSON,
      lastTopic: progress?.lastTopic || '',
      firstTopic: topics[0]?.slug || '',
      nextTopic: nextIncomplete(topics, progress?.completed ?? []),
      quizzes: {
        total: quizRows.filter((q) => q.languageSlug === l.slug).length,
        taken: taken.filter((r) => r.languageSlug === l.slug).length,
      },
    };
  });

  const xp = stats?.xp || 0;
  const longestStreak = stats?.longestStreak || 0;
  const completedTotal = rows.reduce((sum, r) => sum + r.completed, 0);
  const series = buildSeries(windowActivities, today, 14);

  res.json({
    stats: {
      xp,
      ...levelInfo(xp),
      streak: stats ? currentStreak(stats, today) : 0,
      longestStreak,
      activeToday: stats?.lastActiveDay === today,
      completedTotal,
      quizzes,
    },
    languages: rows,
    badges: badgesFor({ completedTotal, longestStreak, languages: rows, quizzes }),
    series,
    week: weekSummary(series),
    recent,
  });
}

export async function getLanguageProgress(req, res) {
  const { slug } = req.params;
  if (!SLUG.test(slug)) return res.status(404).json({ message: 'Language not found' });
  const doc = await Progress.findOne({ user: req.user.id, languageSlug: slug })
    .select('completed lastTopic drafts -_id')
    .lean();
  res.json({ completed: doc?.completed || [], lastTopic: doc?.lastTopic || '', drafts: doc?.drafts || {} });
}

export async function markLast(req, res) {
  const { slug } = req.params;
  const { topic } = req.body;
  if (!(await lessonTitle(slug, topic))) return notFound(res);
  await upsertProgress({ user: req.user.id, languageSlug: slug }, { $set: { lastTopic: topic } });
  res.status(204).end();
}

export async function complete(req, res) {
  const { slug, topic } = req.params;
  const title = await lessonTitle(slug, topic);
  if (!title) return notFound(res);
  const userId = req.user.id;

  // Atomic: sirf pehli baar kamyab hota hai. Dobara complete karne par unique index E11000 deta hai.
  let first = true;
  try {
    await Progress.updateOne(
      { user: userId, languageSlug: slug, completed: { $ne: topic } },
      { $addToSet: { completed: topic }, $set: { lastTopic: topic } },
      { upsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    first = false;
  }
  if (!first) return res.json({ alreadyCompleted: true, xpGained: 0 });

  const day = resolveDay(req.body.day);
  const stats = await awardXp(userId, XP_PER_LESSON, day);
  // Activity sirf dikhane ke liye hai: ye fail ho to lesson ka XP phir bhi mil chuka hota hai
  await Activity.create({ user: userId, type: 'lesson', languageSlug: slug, title, xp: XP_PER_LESSON, day }).catch((err) =>
    console.error('activity log failed:', err.message)
  );
  res.json({ alreadyCompleted: false, xpGained: XP_PER_LESSON, stats });
}

export async function saveDraft(req, res) {
  const { slug, topic, index } = req.params;
  if (!/^\d{1,2}$/.test(index) || Number(index) > 19 || !(await lessonTitle(slug, topic))) return notFound(res);
  const key = `drafts.${topic}__${Number(index)}`;
  const { code } = req.body;
  const update = code === '' ? { $unset: { [key]: 1 } } : { $set: { [key]: { code, updatedAt: new Date() } } };
  await upsertProgress({ user: req.user.id, languageSlug: slug }, update);
  res.status(204).end();
}
