import Language from '../models/Language.js';
import Progress from '../models/Progress.js';
import QuestionStat from '../models/QuestionStat.js';
import Quiz from '../models/Quiz.js';
import Topic from '../models/Topic.js';
import User from '../models/User.js';
import UserStats from '../models/UserStats.js';
import { currentStreak, dayDiff, utcDay } from '../utils/progress.js';

const INACTIVE_DAYS = 7; // itne din se kuch nahi kiya
const NEVER_STARTED_DAYS = 3; // sign up ke itne din baad bhi koi lesson/quiz nahi
const STREAK_LOSS_DAYS = 2; // streak toote ko itne din
const MIN_LOST_STREAK = 3; // aur pehle kam az kam itna streak tha
const MIN_ASKED = 3; // sawal ko "mushkil" kehne ke liye kam az kam itne students ka data
const MIN_FOR_DROP = 3; // drop-off tab gino jab lesson kam az kam itne ne khatam kiya ho
const MAX_LIST = 50;
const MAX_STUDENTS = 2000;
const MAX_HARD = 10;

// Kin students ko "nudge" chahiye: ruk gaye, kabhi shuru hi nahi kiya, ya streak toot gayi
function atRiskStudents(students, statsByUser, today) {
  const inactive = [];
  const neverStarted = [];
  const streakBroken = [];

  for (const u of students) {
    const s = statsByUser.get(String(u._id));
    const lastActiveDay = s?.lastActiveDay || null;
    const row = {
      id: String(u._id),
      name: u.name,
      email: u.email,
      joinedAt: u.createdAt,
      xp: s?.xp ?? 0,
      longestStreak: s?.longestStreak ?? 0,
      lastActiveDay,
      daysInactive: lastActiveDay ? dayDiff(lastActiveDay, today) : null,
      daysSinceJoined: dayDiff(utcDay(new Date(u.createdAt)), today),
    };
    if (!lastActiveDay) {
      if (row.daysSinceJoined >= NEVER_STARTED_DAYS) neverStarted.push(row);
    } else if (row.daysInactive >= INACTIVE_DAYS) {
      inactive.push(row);
    } else if (row.daysInactive >= STREAK_LOSS_DAYS && row.longestStreak >= MIN_LOST_STREAK && currentStreak(s, today) === 0) {
      streakBroken.push(row);
    }
  }

  const list = (rows, compare) => ({ total: rows.length, students: rows.sort(compare).slice(0, MAX_LIST) });
  return {
    inactive: list(inactive, (a, b) => b.daysInactive - a.daysInactive),
    neverStarted: list(neverStarted, (a, b) => b.daysSinceJoined - a.daysSinceJoined),
    streakBroken: list(streakBroken, (a, b) => b.longestStreak - a.longestStreak),
  };
}

// Har language mein lesson-by-lesson: kitne students ne khatam kiya, aur kahan sab se zyada log ruk jate hain
function lessonDropOff(languages, topics, completions, starters) {
  const completedBy = new Map(completions.map((c) => [`${c._id.l}/${c._id.t}`, c.n]));
  const startersBy = new Map(starters.map((s) => [s._id, s.n]));

  return languages
    .filter((l) => (startersBy.get(l.slug) ?? 0) > 0)
    .map((l) => {
      const count = startersBy.get(l.slug);
      const lessons = topics
        .filter((t) => t.languageSlug === l.slug)
        .map((t) => {
          const completed = completedBy.get(`${l.slug}/${t.slug}`) ?? 0;
          return { slug: t.slug, title: t.title, completed, percent: Math.min(Math.round((completed / count) * 100), 100) };
        });

      let biggestDrop = null;
      for (let i = 0; i < lessons.length - 1; i++) {
        const from = lessons[i].completed;
        const to = lessons[i + 1].completed;
        if (from < MIN_FOR_DROP || to >= from) continue;
        const rate = (from - to) / from;
        if (!biggestDrop || rate > biggestDrop.rate) {
          biggestDrop = { rate, from: lessons[i].title, to: lessons[i + 1].title, fromCount: from, toCount: to, dropPercent: Math.round(rate * 100) };
        }
      }
      if (biggestDrop) delete biggestDrop.rate;
      return { slug: l.slug, name: l.name, color: l.color, starters: count, lessons, biggestDrop };
    })
    .sort((a, b) => b.starters - a.starters);
}

// Sab se zyada ghalat hone wale sawal (pehli koshish ke hisab se)
async function hardestQuestions(languages) {
  const weak = await QuestionStat.aggregate([
    { $match: { asked: { $gte: MIN_ASKED }, wrong: { $gt: 0 } } },
    { $addFields: { rate: { $divide: ['$wrong', '$asked'] } } },
    { $sort: { rate: -1, asked: -1 } },
    { $limit: MAX_HARD },
  ]);
  if (!weak.length) return [];

  const quizzes = await Quiz.find({ $or: weak.map((w) => ({ languageSlug: w.languageSlug, slug: w.quizSlug })) })
    .select('languageSlug slug title questions.id questions.prompt -_id')
    .lean();
  const quizBy = new Map(quizzes.map((q) => [`${q.languageSlug}/${q.slug}`, q]));
  const nameBy = new Map(languages.map((l) => [l.slug, l.name]));

  return weak
    .map((w) => {
      const quiz = quizBy.get(`${w.languageSlug}/${w.quizSlug}`);
      const question = quiz?.questions.find((q) => q.id === w.questionId);
      if (!question) return null; // quiz ya sawal ab nahi raha
      return {
        languageSlug: w.languageSlug,
        language: nameBy.get(w.languageSlug) ?? w.languageSlug,
        quizSlug: w.quizSlug,
        quizTitle: quiz.title,
        questionId: w.questionId,
        prompt: question.prompt,
        asked: w.asked,
        wrong: w.wrong,
        wrongPercent: Math.round((w.wrong / w.asked) * 100),
      };
    })
    .filter(Boolean);
}

export async function getInsights(req, res) {
  const today = utcDay();
  const [students, languages, topics, completions, starters] = await Promise.all([
    User.find({ role: 'student', disabled: { $ne: true } }).sort({ createdAt: -1 }).limit(MAX_STUDENTS).select('name email createdAt').lean(),
    Language.find().sort('order').select('slug name color -_id').lean(),
    Topic.find().sort({ languageSlug: 1, order: 1 }).select('languageSlug slug title -_id').lean(),
    Progress.aggregate([{ $unwind: '$completed' }, { $group: { _id: { l: '$languageSlug', t: '$completed' }, n: { $sum: 1 } } }]),
    Progress.aggregate([{ $match: { 'completed.0': { $exists: true } } }, { $group: { _id: '$languageSlug', n: { $sum: 1 } } }]),
  ]);

  const stats = students.length ? await UserStats.find({ user: { $in: students.map((u) => u._id) } }).select('user xp streak longestStreak lastActiveDay -_id').lean() : [];
  const statsByUser = new Map(stats.map((s) => [String(s.user), s]));

  res.json({
    thresholds: { inactiveDays: INACTIVE_DAYS, neverStartedDays: NEVER_STARTED_DAYS, minAsked: MIN_ASKED },
    atRisk: atRiskStudents(students, statsByUser, today),
    hardQuestions: await hardestQuestions(languages),
    dropOff: lessonDropOff(languages, topics, completions, starters),
  });
}
