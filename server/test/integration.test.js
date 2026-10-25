// Asli MongoDB ke khilaf poora API test. Sirf tab chalta hai jab TEST_MONGO_URI set ho, jaise:
//   $env:TEST_MONGO_URI="mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/"; npm test
// Ye apna alag database (lh_test_...) banata hai aur aakhir mein delete kar deta hai. Aap ka asli data safe hai.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import mongoose from 'mongoose';

const URI = process.env.TEST_MONGO_URI;
const skip = URI ? false : 'set TEST_MONGO_URI to run the database tests';

let server;
let base;
const dbName = `lh_test_${Date.now()}`;
const seedDir = new URL('../src/seed/', import.meta.url);
const quizFiles = fs.readdirSync(new URL('quizzes/', seedDir)).map((f) => JSON.parse(fs.readFileSync(new URL(`quizzes/${f}`, seedDir), 'utf8')));
const LANGUAGE_COUNT = quizFiles.length;
const QUIZ_COUNT = quizFiles.reduce((n, f) => n + f.quizzes.length, 0);
const quizzesIn = (slug) => quizFiles.find((f) => f.languageSlug === slug).quizzes.length;

async function api(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const utcDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
let counter = 0;
async function newUser() {
  counter += 1;
  const r = await api('POST', '/api/auth/register', {
    body: { name: `Tester ${counter}`, email: `t${counter}_${Date.now()}@example.com`, password: 'Test@1234' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.accessToken;
}

before(async () => {
  if (skip) return;
  process.env.MONGO_URI ??= URI;
  process.env.JWT_ACCESS_SECRET ??= 'integration-test-secret-integration-test-secret';
  process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';
  await mongoose.connect(URI, { dbName });
  const { seedAll } = await import('../src/seed/seedData.js');
  await seedAll();
  const { default: app } = await import('../src/app.js');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (skip) return;
  server?.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('lesson API needs a login and returns sections, topics and prev/next', { skip }, async () => {
  assert.equal((await api('GET', '/api/languages/html')).status, 401);
  const token = await newUser();

  const lang = await api('GET', '/api/languages/html', { token });
  assert.equal(lang.status, 200);
  assert.equal(lang.data.topics.length, 8);
  assert.equal(lang.data.topics[0].section, 'Getting Started');

  const topic = await api('GET', '/api/languages/html/topics/basictags', { token });
  assert.equal(topic.status, 200);
  assert.equal(topic.data.prev.slug, 'introduction');
  assert.equal(topic.data.next.slug, 'attributes');
  assert.ok(topic.data.topic.blocks.length > 0);

  assert.equal((await api('GET', '/api/languages/html/topics/nope', { token })).status, 404);
  assert.equal((await api('GET', '/api/languages/fortran', { token })).status, 404);
});

test('completing a lesson gives XP once, updates level/streak and is idempotent', { skip }, async () => {
  const token = await newUser();
  const day = utcDay();

  let r = await api('POST', '/api/progress/html/topics/introduction/complete', { token, body: { day } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.xpGained, 10);
  assert.equal(r.data.stats.xp, 10);
  assert.equal(r.data.stats.streak, 1);
  assert.equal(r.data.stats.level, 1);

  r = await api('POST', '/api/progress/html/topics/introduction/complete', { token, body: { day } });
  assert.equal(r.data.alreadyCompleted, true);
  assert.equal(r.data.xpGained, 0);

  r = await api('POST', '/api/progress/html/topics/basictags/complete', { token, body: { day } });
  assert.equal(r.data.stats.xp, 20);
  assert.equal(r.data.stats.streak, 1, 'same day does not raise the streak');

  const overview = await api('GET', `/api/progress?day=${day}`, { token });
  assert.equal(overview.status, 200);
  const html = overview.data.languages.find((l) => l.slug === 'html');
  assert.equal(html.completed, 2);
  assert.equal(html.total, 8);
  assert.equal(html.percent, 25);
  assert.equal(html.xp, 20);
  assert.equal(overview.data.stats.xp, 20);
  assert.equal(overview.data.stats.completedTotal, 2);
  assert.equal(overview.data.stats.activeToday, true);
  assert.ok(overview.data.badges.find((b) => b.id === 'first-lesson').earned);
  assert.ok(!overview.data.badges.find((b) => b.id === 'ten-lessons').earned);
  assert.equal(overview.data.languages.length, LANGUAGE_COUNT);

  const detail = await api('GET', '/api/progress/html', { token });
  assert.deepEqual(detail.data.completed.sort(), ['basictags', 'introduction']);
  assert.equal(detail.data.lastTopic, 'basictags');
});

test('five simultaneous completes of the same lesson award XP exactly once', { skip }, async () => {
  const token = await newUser();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => api('POST', '/api/progress/css/topics/intro/complete', { token, body: { day: utcDay() } }))
  );
  assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.data)));
  assert.equal(results.filter((r) => r.data.xpGained === 10).length, 1);
  const overview = await api('GET', `/api/progress?day=${utcDay()}`, { token });
  assert.equal(overview.data.stats.xp, 10);
});

test('streak grows on consecutive days and the client cannot fake a far-away date', { skip }, async () => {
  const token = await newUser();
  let r = await api('POST', '/api/progress/cpp/topics/intro/complete', { token, body: { day: utcDay(-1) } });
  assert.equal(r.data.stats.streak, 1);
  r = await api('POST', '/api/progress/cpp/topics/loops/complete', { token, body: { day: utcDay(0) } });
  assert.equal(r.data.stats.streak, 2);
  assert.equal(r.data.stats.longestStreak, 2);

  // a date 30 days away is ignored (treated as today), so the streak does not jump
  r = await api('POST', '/api/progress/cpp/topics/strings/complete', { token, body: { day: utcDay(30) } });
  assert.equal(r.data.stats.streak, 2);
  const overview = await api('GET', `/api/progress?day=${utcDay(0)}`, { token });
  assert.equal(overview.data.stats.streak, 2);
});

test('drafts can be saved, listed, overwritten and deleted; bad input is rejected', { skip }, async () => {
  const token = await newUser();
  const put = (index, code) => api('PUT', `/api/progress/javascript/topics/variable/drafts/${index}`, { token, body: { code } });

  assert.equal((await put(0, 'console.log(1)')).status, 204);
  assert.equal((await put(1, 'console.log(2)')).status, 204);
  assert.equal((await put(0, 'console.log("changed")')).status, 204);

  let detail = await api('GET', '/api/progress/javascript', { token });
  assert.equal(detail.data.drafts['variable__0'].code, 'console.log("changed")');
  assert.equal(detail.data.drafts['variable__1'].code, 'console.log(2)');

  assert.equal((await put(0, '')).status, 204); // empty code deletes the draft
  detail = await api('GET', '/api/progress/javascript', { token });
  assert.equal(detail.data.drafts['variable__0'], undefined);
  assert.ok(detail.data.drafts['variable__1']);

  assert.equal((await put(99, 'x')).status, 404, 'index too large');
  assert.equal((await put(0, 'x'.repeat(20001))).status, 400, 'code too long');
  const unknown = await api('PUT', '/api/progress/javascript/topics/not-a-lesson/drafts/0', { token, body: { code: 'x' } });
  assert.equal(unknown.status, 404);
});

test('last opened lesson is remembered and unknown lessons are refused', { skip }, async () => {
  const token = await newUser();
  assert.equal((await api('PUT', '/api/progress/html/last', { token, body: { topic: 'semantic' } })).status, 204);
  assert.equal((await api('GET', '/api/progress/html', { token })).data.lastTopic, 'semantic');
  assert.equal((await api('PUT', '/api/progress/html/last', { token, body: { topic: 'nope' } })).status, 404);
  assert.equal((await api('PUT', '/api/progress/html/last', { token, body: {} })).status, 400);
});

test('progress belongs to the user: another user starts from zero', { skip }, async () => {
  const a = await newUser();
  const b = await newUser();
  await api('POST', '/api/progress/html/topics/introduction/complete', { token: a, body: {} });
  const overview = await api('GET', `/api/progress?day=${utcDay()}`, { token: b });
  assert.equal(overview.data.stats.xp, 0);
  assert.equal(overview.data.stats.completedTotal, 0);
  assert.equal((await api('GET', '/api/progress/html', { token: b })).data.completed.length, 0);
  assert.equal((await api('GET', '/api/progress')).status, 401);
});

// ---------------- quizzes ----------------
const quizPath = (suffix = '') => `/api/quizzes/html/getting-started${suffix}`;

test('quiz list and quiz fetch never reveal answers or explanations', { skip }, async () => {
  const token = await newUser();
  const list = await api('GET', '/api/quizzes/html', { token });
  assert.equal(list.status, 200);
  assert.equal(list.data.quizzes.length, quizzesIn('html'));
  assert.equal(list.data.quizzes[0].questionCount, 6);
  assert.equal(list.data.quizzes[0].best, null);

  const quiz = await api('GET', quizPath(), { token });
  assert.equal(quiz.status, 200);
  assert.equal(quiz.data.quiz.questions.length, 6);
  const text = JSON.stringify(quiz.data);
  for (const secret of ['correctIndex', 'explanation', 'answers', 'caseSensitive']) {
    assert.ok(!text.includes(secret), `leaks ${secret}`);
  }
  assert.ok(quiz.data.quiz.questions.every((q) => q.options || q.type === 'fill'));

  assert.equal((await api('GET', '/api/quizzes/html/nope', { token })).status, 404);
  assert.equal((await api('GET', '/api/quizzes/fortran', { token })).data.quizzes.length, 0);
  assert.equal((await api('GET', quizPath())).status, 401);
});

// Sahi jawab seed file se (sirf test mein): production API ye kabhi nahi bhejti
async function correctAnswers() {
  const { default: Quiz } = await import('../src/models/Quiz.js');
  const quiz = await Quiz.findOne({ languageSlug: 'html', slug: 'getting-started' }).lean();
  return Object.fromEntries(quiz.questions.map((q) => [q.id, q.type === 'choice' ? q.correctIndex : q.answers[0]]));
}

test('submitting a quiz grades on the server, explains every answer and gives XP once per improvement', { skip }, async () => {
  const token = await newUser();
  const right = await correctAnswers();
  const ids = Object.keys(right);
  const day = utcDay();

  // 1) perfect score
  let r = await api('POST', quizPath('/submit'), { token, body: { answers: right, day } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.score, 6);
  assert.equal(r.data.percent, 100);
  assert.equal(r.data.passed, true);
  assert.equal(r.data.xpGained, 30);
  assert.equal(r.data.stats.xp, 30);
  assert.equal(r.data.results.length, 6);
  assert.ok(r.data.results.every((x) => x.correct && x.explanation));

  // 2) same score again: no extra XP
  r = await api('POST', quizPath('/submit'), { token, body: { answers: right, day } });
  assert.equal(r.data.xpGained, 0);
  assert.equal(r.data.stats.xp, 30);

  // 3) a worse attempt keeps the best score and gives nothing
  const worse = { ...right, [ids[0]]: 9 }; // option 9 does not exist, so this answer is wrong
  r = await api('POST', quizPath('/submit'), { token, body: { answers: worse, day } });
  assert.equal(r.data.score, 5);
  assert.equal(r.data.xpGained, 0);
  assert.equal(r.data.bestScore, 6);
  assert.equal(r.data.results[0].correct, false);
  assert.ok(r.data.results[0].explanation);

  const list = await api('GET', '/api/quizzes/html', { token });
  assert.deepEqual(list.data.quizzes[0].best, { score: 6, total: 6, attempts: 3 });
  assert.equal((await api('GET', quizPath(), { token })).data.best.score, 6);
});

test('improving a lower score earns only the difference', { skip }, async () => {
  const token = await newUser();
  const right = await correctAnswers();
  const [first, second, ...rest] = Object.keys(right);
  const partial = Object.fromEntries([first, second].map((id) => [id, right[id]])); // 2 right
  const better = Object.fromEntries([first, second, ...rest.slice(0, 2)].map((id) => [id, right[id]])); // 4 right

  let r = await api('POST', quizPath('/submit'), { token, body: { answers: partial } });
  assert.deepEqual([r.data.score, r.data.xpGained], [2, 10]);
  r = await api('POST', quizPath('/submit'), { token, body: { answers: better } });
  assert.deepEqual([r.data.score, r.data.xpGained], [4, 10]);
  assert.equal(r.data.stats.xp, 20);
  r = await api('POST', quizPath('/submit'), { token, body: { answers: {} } });
  assert.deepEqual([r.data.score, r.data.xpGained, r.data.bestScore], [0, 0, 4]);
});

test('five simultaneous perfect submissions award the XP only once', { skip }, async () => {
  const token = await newUser();
  const right = await correctAnswers();
  const results = await Promise.all(Array.from({ length: 5 }, () => api('POST', quizPath('/submit'), { token, body: { answers: right } })));
  assert.ok(results.every((x) => x.status === 200), JSON.stringify(results.map((x) => x.data)));
  assert.equal(results.reduce((sum, x) => sum + x.data.xpGained, 0), 30);
  const overview = await api('GET', `/api/progress?day=${utcDay()}`, { token });
  assert.equal(overview.data.stats.xp, 30);
});

test('quiz submit rejects bad input and counts as activity for the streak', { skip }, async () => {
  const token = await newUser();
  assert.equal((await api('POST', quizPath('/submit'), { token, body: {} })).status, 400);
  assert.equal((await api('POST', quizPath('/submit'), { token, body: { answers: { a: { x: 1 } } } })).status, 400);
  assert.equal((await api('POST', quizPath('/submit'), { token, body: { answers: { a: 'x'.repeat(201) } } })).status, 400);
  assert.equal((await api('POST', '/api/quizzes/html/nope/submit', { token, body: { answers: {} } })).status, 404);
  assert.equal((await api('POST', quizPath('/submit'), { body: { answers: {} } })).status, 401);

  const r = await api('POST', quizPath('/submit'), { token, body: { answers: {}, day: utcDay() } });
  assert.equal(r.status, 200);
  assert.equal(r.data.stats.streak, 1);
});

test('the dashboard counts quizzes and awards the quiz badges', { skip }, async () => {
  const token = await newUser();
  const right = await correctAnswers();
  let overview = await api('GET', `/api/progress?day=${utcDay()}`, { token });
  assert.deepEqual(overview.data.stats.quizzes, { total: QUIZ_COUNT, taken: 0, passed: 0, perfect: 0 });
  assert.equal(overview.data.badges.find((b) => b.id === 'first-quiz').earned, false);

  await api('POST', quizPath('/submit'), { token, body: { answers: right } });
  overview = await api('GET', `/api/progress?day=${utcDay()}`, { token });
  assert.deepEqual(overview.data.stats.quizzes, { total: QUIZ_COUNT, taken: 1, passed: 1, perfect: 1 });
  assert.equal(overview.data.badges.find((b) => b.id === 'first-quiz').earned, true);
  assert.equal(overview.data.badges.find((b) => b.id === 'quiz-ace').earned, true);
  assert.equal(overview.data.badges.find((b) => b.id === 'quiz-five').earned, false);
  const html = overview.data.languages.find((l) => l.slug === 'html');
  assert.deepEqual(html.quizzes, { total: quizzesIn('html'), taken: 1 });
  assert.deepEqual(overview.data.languages.find((l) => l.slug === 'css').quizzes, { total: quizzesIn('css'), taken: 0 });
});

test('lesson XP and quiz XP add up and share one streak', { skip }, async () => {
  const token = await newUser();
  const right = await correctAnswers();
  await api('POST', '/api/progress/html/topics/introduction/complete', { token, body: { day: utcDay() } });
  const r = await api('POST', quizPath('/submit'), { token, body: { answers: right, day: utcDay() } });
  assert.equal(r.data.stats.xp, 40);
  assert.equal(r.data.stats.streak, 1);
});

// ---------------- dashboard data: activity, chart, goal, next lesson, search ----------------
test('lessons and quiz attempts appear in recent activity and in the 14-day XP chart', { skip }, async () => {
  const token = await newUser();
  const right = await correctAnswers();
  const day = utcDay();

  await api('POST', '/api/progress/html/topics/introduction/complete', { token, body: { day } });
  await api('POST', '/api/progress/html/topics/introduction/complete', { token, body: { day } }); // repeat: no second entry
  await api('POST', quizPath('/submit'), { token, body: { answers: right, day } }); // +30 XP
  await api('POST', quizPath('/submit'), { token, body: { answers: right, day } }); // 0 XP but still an attempt

  const overview = await api('GET', `/api/progress?day=${day}`, { token });
  assert.equal(overview.status, 200);
  const { series, week, recent } = overview.data;

  assert.equal(series.length, 14);
  assert.equal(series[13].day, day);
  assert.deepEqual([series[13].xp, series[13].lessons, series[13].quizzes], [40, 1, 2]);
  assert.equal(series.slice(0, 13).reduce((n, d) => n + d.xp, 0), 0);
  assert.deepEqual(week.goal, { target: 100, earned: 40, percent: 40 });
  assert.equal(week.prevWeekXp, 0);

  assert.equal(recent.length, 3); // the repeated lesson completion did not add a fourth entry
  assert.equal(recent[0].type, 'quiz');
  assert.equal(recent[0].xp, 0);
  assert.equal(recent[0].detail, 'Score 6/6');
  assert.equal(recent[1].type, 'quiz');
  assert.equal(recent[1].xp, 30);
  assert.equal(recent[2].type, 'lesson');
  assert.equal(recent[2].title, 'Introduction');
  assert.equal(recent[2].languageSlug, 'html');
  assert.ok(recent.every((r) => r.at));
});

test('older activity moves to the previous-week total and out of the 14-day window', { skip }, async () => {
  const token = await newUser();
  await api('POST', '/api/progress/html/topics/introduction/complete', { token, body: { day: utcDay(-1) } });
  await api('POST', '/api/progress/html/topics/basictags/complete', { token, body: { day: utcDay(0) } });
  const overview = await api('GET', `/api/progress?day=${utcDay(0)}`, { token });
  const { series, week } = overview.data;
  assert.equal(series[12].xp, 10);
  assert.equal(series[13].xp, 10);
  assert.equal(week.weekXp, 20);
  assert.equal(overview.data.recent.length, 2);
});

test('each language reports the next unfinished lesson', { skip }, async () => {
  const token = await newUser();
  let overview = await api('GET', `/api/progress?day=${utcDay()}`, { token });
  let html = overview.data.languages.find((l) => l.slug === 'html');
  assert.deepEqual(html.nextTopic, { slug: 'introduction', title: 'Introduction' });

  // finishing the 2nd lesson first leaves the 1st as "next"
  await api('POST', '/api/progress/html/topics/basictags/complete', { token, body: { day: utcDay() } });
  overview = await api('GET', `/api/progress?day=${utcDay()}`, { token });
  html = overview.data.languages.find((l) => l.slug === 'html');
  assert.equal(html.nextTopic.slug, 'introduction');

  await api('POST', '/api/progress/html/topics/introduction/complete', { token, body: { day: utcDay() } });
  overview = await api('GET', `/api/progress?day=${utcDay()}`, { token });
  html = overview.data.languages.find((l) => l.slug === 'html');
  assert.equal(html.nextTopic.slug, 'attributes');
});

test('search finds lessons and languages, ignores short or odd input, and needs a login', { skip }, async () => {
  const token = await newUser();
  assert.equal((await api('GET', '/api/search?q=forms')).status, 401);

  let r = await api('GET', '/api/search?q=forms', { token });
  assert.equal(r.status, 200);
  assert.ok(r.data.lessons.some((l) => l.slug === 'forms-validation' && l.languageSlug === 'html' && l.languageName === 'HTML'));
  assert.ok(r.data.lessons.every((l) => l.section && l.title));

  r = await api('GET', '/api/search?q=PYTHON', { token });
  assert.ok(r.data.languages.some((l) => l.slug === 'python'), 'case-insensitive language match');

  r = await api('GET', '/api/search?q=c%2B%2B', { token }); // "c++" must not break the regex
  assert.equal(r.status, 200);
  assert.ok(r.data.languages.some((l) => l.slug === 'cpp'));

  for (const q of ['a', '', '.*', '(((', '[']) {
    r = await api('GET', `/api/search?q=${encodeURIComponent(q)}`, { token });
    assert.equal(r.status, 200, `q=${q}`);
  }
  assert.deepEqual((await api('GET', '/api/search?q=%5B%5B', { token })).data.lessons, []);
  assert.deepEqual((await api('GET', '/api/search?q=zzzzqqq', { token })).data, { languages: [], lessons: [] });
  assert.equal((await api('GET', '/api/search', { token })).status, 200);
  assert.ok((await api('GET', '/api/search?q=a', { token })).data.lessons.length === 0, 'one letter is too short');
  assert.ok((await api('GET', '/api/search?q=in', { token })).data.lessons.length <= 8);
});
