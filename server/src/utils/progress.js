export const XP_PER_LESSON = 10;
export const XP_PER_LEVEL = 100;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const dayMs = (day) => Date.parse(`${day}T00:00:00Z`);

export const utcDay = (date = new Date()) => date.toISOString().slice(0, 10);

// Browser apni local date bhejta hai (taake streak user ke apne din se chale).
// Lekin sirf aaj se +-1 din tak maani jati hai, warna koi streak ghalat tarah nahi barha sakta.
export function resolveDay(input, now = new Date()) {
  const today = utcDay(now);
  if (typeof input !== 'string' || !DAY_RE.test(input)) return today;
  const diff = Math.abs(dayMs(input) - dayMs(today)) / DAY_MS;
  return Number.isNaN(diff) || diff > 1 ? today : input;
}

export const dayDiff = (from, to) => Math.round((dayMs(to) - dayMs(from)) / DAY_MS);

// Naya streak jab user aaj koi lesson mukammal kare
export function nextStreak({ lastActiveDay, streak }, today) {
  if (!lastActiveDay) return 1;
  const gap = dayDiff(lastActiveDay, today);
  if (gap === 0) return Math.max(streak, 1);
  if (gap === 1) return streak + 1;
  return 1;
}

// Dashboard par dikhane wala streak: kal ya aaj active tha to chalta hai, warna toot gaya
export function currentStreak({ lastActiveDay, streak }, today) {
  if (!lastActiveDay) return 0;
  const gap = dayDiff(lastActiveDay, today);
  return gap >= -1 && gap <= 1 ? streak : 0;
}

export function levelInfo(xp) {
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpIntoLevel: xp % XP_PER_LEVEL,
    xpForNext: XP_PER_LEVEL,
  };
}

export function badgesFor({ completedTotal, longestStreak, languages, quizzes = { taken: 0, passed: 0, perfect: 0 } }) {
  return [
    { id: 'first-lesson', title: 'First Step', description: 'Complete your first lesson', earned: completedTotal >= 1 },
    { id: 'ten-lessons', title: 'On a Roll', description: 'Complete 10 lessons', earned: completedTotal >= 10 },
    { id: 'streak-3', title: '3-Day Streak', description: 'Learn 3 days in a row', earned: longestStreak >= 3 },
    { id: 'streak-7', title: '7-Day Streak', description: 'Learn 7 days in a row', earned: longestStreak >= 7 },
    { id: 'first-quiz', title: 'Quiz Taker', description: 'Take your first quiz', earned: quizzes.taken >= 1 },
    { id: 'quiz-ace', title: 'Quiz Ace', description: 'Get a perfect score on a quiz', earned: quizzes.perfect >= 1 },
    { id: 'quiz-five', title: 'Quiz Champion', description: 'Pass 5 quizzes', earned: quizzes.passed >= 5 },
    ...languages.map((l) => ({
      id: `master-${l.slug}`,
      title: `${l.name} Master`,
      description: `Complete every ${l.name} lesson`,
      earned: l.total > 0 && l.completed >= l.total,
    })),
  ];
}

export const WEEKLY_GOAL_XP = 100;

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Pichle `days` din ka hisaab (aaj tak), jis din kuch na hua wahan zero
export function buildSeries(activities, today, days = 14) {
  const start = addDays(today, -(days - 1));
  const byDay = new Map();
  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    byDay.set(day, { day, xp: 0, lessons: 0, quizzes: 0 });
  }
  for (const a of activities) {
    const entry = byDay.get(a.day);
    if (!entry) continue;
    entry.xp += a.xp;
    if (a.type === 'lesson') entry.lessons += 1;
    else entry.quizzes += 1;
  }
  return [...byDay.values()];
}

export function weekSummary(series) {
  const sum = (rows) => rows.reduce((n, r) => n + r.xp, 0);
  const weekXp = sum(series.slice(-7));
  const prevWeekXp = sum(series.slice(-14, -7));
  return {
    weekXp,
    prevWeekXp,
    goal: { target: WEEKLY_GOAL_XP, earned: weekXp, percent: Math.min(100, Math.round((weekXp / WEEKLY_GOAL_XP) * 100)) },
  };
}

// topics order ke mutabiq hon: pehla topic jo abhi mukammal nahi
export function nextIncomplete(topics, completed) {
  const done = new Set(completed);
  const next = topics.find((t) => !done.has(t.slug));
  return next ? { slug: next.slug, title: next.title } : null;
}
