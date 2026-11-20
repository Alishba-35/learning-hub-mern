// Admin insights ko bina MongoDB ke test karta hai: at-risk students, mushkil sawal, lesson drop-off, aur sawalon ki ginti.
import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'insights-test-secret-insights-test-secret-1234';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: UserStats } = await import('../src/models/UserStats.js');
const { default: Progress } = await import('../src/models/Progress.js');
const { default: Language } = await import('../src/models/Language.js');
const { default: Topic } = await import('../src/models/Topic.js');
const { default: Quiz } = await import('../src/models/Quiz.js');
const { default: QuizResult } = await import('../src/models/QuizResult.js');
const { default: QuestionStat } = await import('../src/models/QuestionStat.js');
const { default: Activity } = await import('../src/models/Activity.js');
const { addDays, utcDay } = await import('../src/utils/progress.js');

const OID = (n) => String(n).padStart(24, '0');
const token = (id, role) => jwt.sign({ sub: id, role }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
const ADMIN = token(OID(9), 'admin');
const STUDENT = token(OID(1), 'student');
const today = utcDay();
const daysAgo = (n) => addDays(today, -n);
const joined = (n) => new Date(`${daysAgo(n)}T10:00:00Z`);

let server;
let base;
let hardPipeline;
let written;

before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const chain = (result) => {
  const c = { sort: () => c, limit: () => c, select: () => c, lean: async () => result };
  return () => c;
};

async function api(method, path, { as, body } = {}) {
  const headers = {};
  if (as) headers.Authorization = `Bearer ${as}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const quiz = {
  languageSlug: 'css', slug: 'q1', title: 'CSS Checkpoint', section: 'Basics',
  questions: [
    { id: 'q1-1', type: 'choice', prompt: 'Which property sets text colour?', options: ['color', 'font'], correctIndex: 0, explanation: 'color' },
    { id: 'q1-2', type: 'choice', prompt: 'Which unit is relative?', options: ['px', 'em'], correctIndex: 1, explanation: 'em' },
  ],
};

beforeEach(() => {
  mock.restoreAll();
  hardPipeline = undefined;
  written = undefined;
  mock.method(User, 'find', chain([
    { _id: OID(1), name: 'Inactive Ina', email: 'ina@x.com', createdAt: joined(30) },
    { _id: OID(2), name: 'Never Nadia', email: 'nadia@x.com', createdAt: joined(5) },
    { _id: OID(3), name: 'Brand New', email: 'new@x.com', createdAt: joined(0) },
    { _id: OID(4), name: 'Streak Sam', email: 'sam@x.com', createdAt: joined(20) },
    { _id: OID(5), name: 'Active Amir', email: 'amir@x.com', createdAt: joined(20) },
    { _id: OID(6), name: 'Casual Cara', email: 'cara@x.com', createdAt: joined(20) },
  ]));
  mock.method(UserStats, 'find', chain([
    { user: OID(1), xp: 50, streak: 2, longestStreak: 2, lastActiveDay: daysAgo(10) },
    { user: OID(4), xp: 120, streak: 5, longestStreak: 5, lastActiveDay: daysAgo(3) },
    { user: OID(5), xp: 300, streak: 4, longestStreak: 4, lastActiveDay: today },
    { user: OID(6), xp: 20, streak: 1, longestStreak: 1, lastActiveDay: daysAgo(3) },
  ]));
  mock.method(Language, 'find', chain([{ slug: 'css', name: 'CSS', color: '#1f4e78' }, { slug: 'html', name: 'HTML', color: '#9b2d30' }]));
  mock.method(Topic, 'find', chain([
    { languageSlug: 'css', slug: 'a', title: 'Intro' }, { languageSlug: 'css', slug: 'b', title: 'Selectors' },
    { languageSlug: 'css', slug: 'c', title: 'Flexbox' }, { languageSlug: 'css', slug: 'd', title: 'Grid' },
    { languageSlug: 'html', slug: 'h1', title: 'Tags' },
  ]));
  mock.method(Progress, 'aggregate', async (pipeline) =>
    pipeline[0].$unwind
      ? [{ _id: { l: 'css', t: 'a' }, n: 5 }, { _id: { l: 'css', t: 'b' }, n: 4 }, { _id: { l: 'css', t: 'c' }, n: 1 }, { _id: { l: 'css', t: 'd' }, n: 1 }]
      : [{ _id: 'css', n: 5 }]
  );
  mock.method(QuestionStat, 'aggregate', async (pipeline) => {
    hardPipeline = pipeline;
    return [
      { languageSlug: 'css', quizSlug: 'q1', questionId: 'q1-2', asked: 4, wrong: 3 },
      { languageSlug: 'css', quizSlug: 'q1', questionId: 'deleted', asked: 5, wrong: 5 },
    ];
  });
  mock.method(Quiz, 'find', chain([quiz]));
});

test('insights are admin only', async () => {
  assert.equal((await api('GET', '/api/admin/insights')).status, 401);
  assert.equal((await api('GET', '/api/admin/insights', { as: STUDENT })).status, 403);
});

test('at-risk: inactive, never started and broken streaks are found; active and brand-new students are left alone', async () => {
  const r = await api('GET', '/api/admin/insights', { as: ADMIN });
  assert.equal(r.status, 200);
  const { inactive, neverStarted, streakBroken } = r.data.atRisk;
  assert.deepEqual(inactive.students.map((s) => [s.name, s.daysInactive]), [['Inactive Ina', 10]]);
  assert.deepEqual(neverStarted.students.map((s) => [s.name, s.daysSinceJoined]), [['Never Nadia', 5]]);
  assert.deepEqual(streakBroken.students.map((s) => [s.name, s.longestStreak]), [['Streak Sam', 5]]);
  assert.equal(inactive.total + neverStarted.total + streakBroken.total, 3);
  assert.equal(inactive.students[0].email, 'ina@x.com');
  assert.ok(!JSON.stringify(r.data).includes('passwordHash'));
});

test('hardest questions: need enough answers, show the prompt, skip deleted questions', async () => {
  const r = await api('GET', '/api/admin/insights', { as: ADMIN });
  assert.deepEqual(hardPipeline[0].$match, { asked: { $gte: 3 }, wrong: { $gt: 0 } }, 'a question answered by one or two students is not judged');
  assert.equal(r.data.hardQuestions.length, 1);
  assert.deepEqual(r.data.hardQuestions[0], {
    languageSlug: 'css', language: 'CSS', quizSlug: 'q1', quizTitle: 'CSS Checkpoint', questionId: 'q1-2',
    prompt: 'Which unit is relative?', asked: 4, wrong: 3, wrongPercent: 75,
  });
});

test('hardest questions: empty list while no data has been collected', async () => {
  mock.method(QuestionStat, 'aggregate', async () => []);
  const r = await api('GET', '/api/admin/insights', { as: ADMIN });
  assert.deepEqual(r.data.hardQuestions, []);
});

test('drop-off: per-lesson completion and the biggest drop, only languages students have started', async () => {
  const r = await api('GET', '/api/admin/insights', { as: ADMIN });
  assert.deepEqual(r.data.dropOff.map((l) => l.slug), ['css'], 'HTML has no starters so it is left out');
  const css = r.data.dropOff[0];
  assert.equal(css.starters, 5);
  assert.deepEqual(css.lessons.map((l) => [l.title, l.completed, l.percent]), [['Intro', 5, 100], ['Selectors', 4, 80], ['Flexbox', 1, 20], ['Grid', 1, 20]]);
  assert.deepEqual(css.biggestDrop, { from: 'Selectors', to: 'Flexbox', fromCount: 4, toCount: 1, dropPercent: 75 });
});

test('first quiz attempt records which questions were wrong; retries do not change the counters', async () => {
  const stats = { xp: 0, streak: 0, longestStreak: 0, lastActiveDay: '' };
  mock.method(Quiz, 'findOne', () => ({ lean: async () => quiz }));
  mock.method(UserStats, 'findOneAndUpdate', async () => stats);
  mock.method(UserStats, 'updateOne', async () => ({}));
  mock.method(Activity, 'create', async () => ({}));
  mock.method(QuestionStat, 'bulkWrite', async (ops) => (written = ops));
  const submit = () => api('POST', '/api/quizzes/css/q1/submit', { as: STUDENT, body: { answers: { 'q1-1': 0, 'q1-2': 0 } } });

  mock.method(QuizResult, 'findOneAndUpdate', async () => null); // pehli baar: pehle koi record nahi
  assert.equal((await submit()).status, 200);
  assert.deepEqual(written.map((o) => [o.updateOne.filter.questionId, o.updateOne.update.$inc]), [['q1-1', { asked: 1, wrong: 0 }], ['q1-2', { asked: 1, wrong: 1 }]]);
  assert.equal(written[0].updateOne.upsert, true);

  written = undefined;
  mock.method(QuizResult, 'findOneAndUpdate', async () => ({ bestScore: 1, attempts: 1 })); // dobara dena
  assert.equal((await submit()).status, 200);
  assert.equal(written, undefined, 'a retry must not count again');
});

test('a failing stats write never breaks the student quiz submit', async () => {
  mock.method(Quiz, 'findOne', () => ({ lean: async () => quiz }));
  mock.method(UserStats, 'findOneAndUpdate', async () => ({ xp: 0, streak: 0, longestStreak: 0, lastActiveDay: '' }));
  mock.method(UserStats, 'updateOne', async () => ({}));
  mock.method(Activity, 'create', async () => ({}));
  mock.method(QuizResult, 'findOneAndUpdate', async () => null);
  mock.method(QuestionStat, 'bulkWrite', async () => {
    throw new Error('db down');
  });
  mock.method(console, 'error', () => {});
  const r = await api('POST', '/api/quizzes/css/q1/submit', { as: STUDENT, body: { answers: { 'q1-1': 0, 'q1-2': 1 } } });
  assert.equal(r.status, 200);
  assert.equal(r.data.score, 2);
});
