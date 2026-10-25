import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEEKLY_GOAL_XP,
  addDays,
  badgesFor,
  buildSeries,
  currentStreak,
  dayDiff,
  levelInfo,
  nextIncomplete,
  nextStreak,
  resolveDay,
  weekSummary,
} from '../src/utils/progress.js';

const now = new Date('2026-10-20T10:00:00Z');

test('resolveDay trusts the client date only within one day of today', () => {
  assert.equal(resolveDay('2026-10-20', now), '2026-10-20');
  assert.equal(resolveDay('2026-10-19', now), '2026-10-19'); // user behind UTC
  assert.equal(resolveDay('2026-10-21', now), '2026-10-21'); // user ahead of UTC (Pakistan at night)
  assert.equal(resolveDay('2026-11-20', now), '2026-10-20'); // too far -> today
  assert.equal(resolveDay('2020-01-01', now), '2026-10-20');
});

test('resolveDay ignores garbage input', () => {
  for (const bad of [undefined, null, 42, '', 'today', '2026-13-45', '2026-10-2', ['2026-10-20'], { a: 1 }]) {
    assert.equal(resolveDay(bad, now), '2026-10-20', String(bad));
  }
});

test('dayDiff counts calendar days, also across month and year ends', () => {
  assert.equal(dayDiff('2026-10-19', '2026-10-20'), 1);
  assert.equal(dayDiff('2026-10-31', '2026-11-01'), 1);
  assert.equal(dayDiff('2026-12-31', '2027-01-01'), 1);
  assert.equal(dayDiff('2026-10-20', '2026-10-20'), 0);
});

test('nextStreak: first lesson, same day, next day, and after a gap', () => {
  assert.equal(nextStreak({ lastActiveDay: '', streak: 0 }, '2026-10-20'), 1);
  assert.equal(nextStreak({ lastActiveDay: '2026-10-20', streak: 4 }, '2026-10-20'), 4);
  assert.equal(nextStreak({ lastActiveDay: '2026-10-19', streak: 4 }, '2026-10-20'), 5);
  assert.equal(nextStreak({ lastActiveDay: '2026-10-17', streak: 9 }, '2026-10-20'), 1);
});

test('currentStreak shows a broken streak as 0 but keeps today and yesterday', () => {
  assert.equal(currentStreak({ lastActiveDay: '', streak: 0 }, '2026-10-20'), 0);
  assert.equal(currentStreak({ lastActiveDay: '2026-10-20', streak: 3 }, '2026-10-20'), 3);
  assert.equal(currentStreak({ lastActiveDay: '2026-10-19', streak: 3 }, '2026-10-20'), 3);
  assert.equal(currentStreak({ lastActiveDay: '2026-10-18', streak: 3 }, '2026-10-20'), 0);
  assert.equal(currentStreak({ lastActiveDay: '2026-10-21', streak: 3 }, '2026-10-20'), 3); // timezone ahead
});

test('levelInfo: 100 XP per level', () => {
  assert.deepEqual(levelInfo(0), { level: 1, xpIntoLevel: 0, xpForNext: 100 });
  assert.deepEqual(levelInfo(99), { level: 1, xpIntoLevel: 99, xpForNext: 100 });
  assert.deepEqual(levelInfo(250), { level: 3, xpIntoLevel: 50, xpForNext: 100 });
});

test('badgesFor awards the quiz badges from quiz stats', () => {
  const earned = (quizzes) =>
    Object.fromEntries(badgesFor({ completedTotal: 0, longestStreak: 0, languages: [], quizzes }).map((b) => [b.id, b.earned]));
  assert.deepEqual(
    [earned({ taken: 1, passed: 0, perfect: 0 })['first-quiz'], earned({ taken: 1, passed: 0, perfect: 0 })['quiz-ace']],
    [true, false]
  );
  assert.equal(earned({ taken: 6, passed: 5, perfect: 1 })['quiz-five'], true);
  assert.equal(earned({ taken: 6, passed: 4, perfect: 1 })['quiz-five'], false);
  assert.equal(earned({ taken: 1, passed: 1, perfect: 1 })['quiz-ace'], true);
});

test('badgesFor marks earned badges, including a language master', () => {
  const languages = [
    { slug: 'html', name: 'HTML', total: 8, completed: 8 },
    { slug: 'css', name: 'CSS', total: 12, completed: 3 },
    { slug: 'empty', name: 'Empty', total: 0, completed: 0 },
  ];
  const badges = badgesFor({ completedTotal: 11, longestStreak: 3, languages });
  const earned = Object.fromEntries(badges.map((b) => [b.id, b.earned]));
  assert.deepEqual(earned, {
    'first-lesson': true,
    'ten-lessons': true,
    'streak-3': true,
    'streak-7': false,
    'first-quiz': false,
    'quiz-ace': false,
    'quiz-five': false,
    'master-html': true,
    'master-css': false,
    'master-empty': false,
  });
});

test('addDays crosses month and year ends', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-10-20', -13), '2026-10-07');
});

test('buildSeries gives one entry per day, zero-filled, counting lessons and quizzes separately', () => {
  const activities = [
    { day: '2026-10-20', xp: 10, type: 'lesson' },
    { day: '2026-10-20', xp: 15, type: 'quiz' },
    { day: '2026-10-18', xp: 10, type: 'lesson' },
    { day: '2026-10-01', xp: 99, type: 'lesson' }, // outside the window: ignored
  ];
  const series = buildSeries(activities, '2026-10-20', 14);
  assert.equal(series.length, 14);
  assert.equal(series[0].day, '2026-10-07');
  assert.equal(series[13].day, '2026-10-20');
  assert.deepEqual(series[13], { day: '2026-10-20', xp: 25, lessons: 1, quizzes: 1 });
  assert.deepEqual(series[11], { day: '2026-10-18', xp: 10, lessons: 1, quizzes: 0 });
  assert.deepEqual(series[12], { day: '2026-10-19', xp: 0, lessons: 0, quizzes: 0 });
  assert.equal(series.reduce((n, d) => n + d.xp, 0), 35);
});

test('weekSummary compares the last 7 days with the 7 before and tracks the weekly goal', () => {
  const series = Array.from({ length: 14 }, (_, i) => ({ day: `d${i}`, xp: i < 7 ? 10 : 20, lessons: 0, quizzes: 0 }));
  const w = weekSummary(series);
  assert.equal(w.weekXp, 140);
  assert.equal(w.prevWeekXp, 70);
  assert.deepEqual(w.goal, { target: WEEKLY_GOAL_XP, earned: 140, percent: 100 }); // capped at 100
  const half = weekSummary(Array.from({ length: 14 }, (_, i) => ({ day: `d${i}`, xp: i === 13 ? 50 : 0, lessons: 0, quizzes: 0 })));
  assert.equal(half.goal.percent, 50);
  assert.equal(half.prevWeekXp, 0);
});

test('nextIncomplete returns the first lesson that is not finished yet', () => {
  const topics = [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }, { slug: 'c', title: 'C' }];
  assert.deepEqual(nextIncomplete(topics, []), { slug: 'a', title: 'A' });
  assert.deepEqual(nextIncomplete(topics, ['a', 'c']), { slug: 'b', title: 'B' }); // skipped lesson comes first
  assert.equal(nextIncomplete(topics, ['a', 'b', 'c']), null);
  assert.equal(nextIncomplete([], []), null);
});
