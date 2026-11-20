// Admin API ko bina MongoDB ke test karta hai (models mock, baqi sab asli): role check, students list, video review.
import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'admin-route-test-secret-admin-route-test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { default: app } = await import('../src/app.js');
const { default: Video } = await import('../src/models/Video.js');
const { default: User } = await import('../src/models/User.js');
const { default: UserStats } = await import('../src/models/UserStats.js');
const { default: Progress } = await import('../src/models/Progress.js');
const { default: Language } = await import('../src/models/Language.js');
const { default: Topic } = await import('../src/models/Topic.js');
const { default: Quiz } = await import('../src/models/Quiz.js');
const { default: QuizResult } = await import('../src/models/QuizResult.js');
const { default: Activity } = await import('../src/models/Activity.js');
const { default: RefreshToken } = await import('../src/models/RefreshToken.js');
const { default: VideoChunk } = await import('../src/models/VideoChunk.js');

const OID = (n) => String(n).padStart(24, '0');
const token = (id, role) => jwt.sign({ sub: id, role }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
const ADMIN = { id: OID(9), token: token(OID(9), 'admin') };
const TEACHER = { id: OID(3), token: token(OID(3), 'teacher') };
const STUDENT = { id: OID(1), token: token(OID(1), 'student') };

let server;
let base;
let userFilter;
let videoFilter;
let update;
let userUpdate;
let deleted;
const today = new Date().toISOString().slice(0, 10);
const student = (over = {}) => ({ _id: OID(1), name: 'Sara', email: 'sara@x.com', role: 'student', purpose: 'Learn web', createdAt: new Date('2026-02-01'), ...over });

before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const chain = (result, onFilter) => {
  const c = { sort: () => c, skip: () => c, limit: () => c, select: () => c, lean: async () => result };
  return (filter) => (onFilter?.(filter), c);
};

const video = (over = {}) => ({
  _id: OID(50), title: 'Cat memes', description: '', languageSlug: '', source: 'youtube', youtubeId: 'dQw4w9WgXcQ',
  status: 'pending', uploaderName: 'Sara', uploadedBy: OID(1), createdAt: new Date('2026-01-01'), ...over,
});

beforeEach(() => {
  mock.restoreAll();
  userFilter = videoFilter = update = userUpdate = undefined;
  deleted = [];
  mock.method(User, 'find', chain([student({ _id: OID(1) })], (f) => (userFilter = f)));
  mock.method(User, 'countDocuments', async () => 3);
  mock.method(User, 'findById', (id) => chain(id === OID(77) ? null : id === OID(9) ? student({ _id: OID(9), role: 'admin' }) : id === OID(2) ? student({ _id: OID(2), role: 'teacher', name: 'Ms T', email: 't@x.com' }) : student({ _id: id }))());
  mock.method(User, 'updateOne', async (filter, change) => (userUpdate = { filter, change }));
  mock.method(User, 'deleteOne', async (f) => deleted.push(['User', f]));
  mock.method(User, 'aggregate', async () => [{ _id: today, n: 2 }]);
  mock.method(UserStats, 'find', chain([{ user: OID(1), xp: 230, streak: 3, lastActiveDay: today }]));
  mock.method(UserStats, 'findOne', () => ({ lean: async () => ({ user: OID(1), xp: 230, streak: 3, longestStreak: 5, lastActiveDay: today }) }));
  mock.method(UserStats, 'countDocuments', async () => 4);
  mock.method(UserStats, 'deleteMany', async (f) => deleted.push(['UserStats', f]));
  mock.method(Progress, 'find', chain([{ languageSlug: 'css', completed: ['a', 'b', 'c'], lastTopic: 'c' }]));
  mock.method(Progress, 'aggregate', async () => [{ _id: 'css', learners: 2, lessons: 7 }, { _id: 'html', learners: 1, lessons: 1 }]);
  mock.method(Progress, 'deleteMany', async (f) => deleted.push(['Progress', f]));
  mock.method(Language, 'find', chain([{ slug: 'css', name: 'CSS', color: '#1f4e78' }, { slug: 'html', name: 'HTML', color: '#9b2d30' }]));
  mock.method(Topic, 'aggregate', async () => [{ _id: 'css', n: 6 }, { _id: 'html', n: 4 }]);
  mock.method(Quiz, 'find', chain([{ languageSlug: 'css', slug: 'css-basics', title: 'CSS Basics' }]));
  mock.method(QuizResult, 'find', chain([{ languageSlug: 'css', quizSlug: 'css-basics', bestScore: 4, lastScore: 3, total: 5, attempts: 2, lastAt: new Date('2026-03-01') }, { languageSlug: 'css', quizSlug: 'gone', bestScore: 1, total: 1, attempts: 1 }]));
  mock.method(QuizResult, 'aggregate', async () => [{ _id: null, attempts: 4, best: 6, possible: 10, takers: [OID(1), OID(2)] }]);
  mock.method(QuizResult, 'deleteMany', async (f) => deleted.push(['QuizResult', f]));
  mock.method(Activity, 'find', chain([{ type: 'lesson', languageSlug: 'css', title: 'Selectors', xp: 10, day: today, at: new Date() }]));
  mock.method(Activity, 'deleteMany', async (f) => deleted.push(['Activity', f]));
  mock.method(RefreshToken, 'countDocuments', async () => 2);
  mock.method(RefreshToken, 'deleteMany', async (f) => deleted.push(['RefreshToken', f]));
  mock.method(VideoChunk, 'deleteMany', async (f) => deleted.push(['VideoChunk', f]));
  mock.method(Video, 'find', chain([video()], (f) => (videoFilter = f)));
  mock.method(Video, 'countDocuments', async () => 1);
  mock.method(Video, 'deleteMany', async (f) => deleted.push(['Video', f]));
  mock.method(Video, 'aggregate', async (pipeline) =>
    pipeline.some((s) => s.$group?._id === '$status')
      ? [{ _id: 'pending', n: 2 }, { _id: 'approved', n: 5 }]
      : [{ _id: { user: OID(1), status: 'approved' }, n: 2 }, { _id: { user: OID(1), status: 'rejected' }, n: 1 }]
  );
  mock.method(Video, 'findOneAndUpdate', (filter, change) => {
    update = { filter, change };
    return { lean: async () => video({ ...change.$set, _id: filter._id }) };
  });
});

async function api(method, path, { as, body } = {}) {
  const headers = {};
  if (as) headers.Authorization = `Bearer ${as.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, data: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null };
}

test('admin routes need a login and the admin role', async () => {
  for (const [m, p] of [['GET', '/api/admin/stats'], ['GET', '/api/admin/students'], ['GET', '/api/admin/videos'], ['PATCH', `/api/admin/videos/${OID(50)}/status`], ['DELETE', `/api/admin/videos/${OID(50)}`]]) {
    assert.equal((await api(m, p)).status, 401, `${m} ${p} without login`);
    assert.equal((await api(m, p, { as: STUDENT })).status, 403, `${m} ${p} as student`);
    assert.equal((await api(m, p, { as: TEACHER })).status, 403, `${m} ${p} as teacher`);
  }
});

test('stats: overview numbers, 30-day signups, top learners, popular languages, quiz average', async () => {
  const r = await api('GET', '/api/admin/stats', { as: ADMIN });
  assert.equal(r.status, 200);
  const d = r.data;
  assert.equal(d.students, 3);
  assert.equal(d.activeWeek, 4);
  assert.deepEqual(d.videos, { pending: 2, approved: 5, rejected: 0 });
  assert.equal(d.signups.length, 30);
  assert.equal(d.signups.at(-1).day, today);
  assert.equal(d.signups.at(-1).count, 2);
  assert.equal(d.signups[0].count, 0, 'quiet days are zero, not missing');
  assert.deepEqual(d.topLearners, [{ id: OID(1), name: 'Sara', xp: 230, level: 3, streak: 3 }]);
  assert.deepEqual(d.popularLanguages.map((l) => [l.name, l.learners]), [['CSS', 2], ['HTML', 1]]);
  assert.deepEqual(d.quizzes, { attempts: 4, takers: 2, averagePercent: 60 });
});

test('students list shows signup date, XP, last active and video counts, never secrets', async () => {
  const r = await api('GET', '/api/admin/students?search=sar.a%2B', { as: ADMIN });
  assert.equal(r.status, 200);
  assert.equal(userFilter.role, 'student', 'students are listed by default');
  assert.ok(userFilter.$or[0].name instanceof RegExp && userFilter.$or[0].name.test('sar.a+'), 'search text is escaped, not treated as regex');
  const s = r.data.students[0];
  assert.deepEqual(s.videos, { pending: 0, approved: 2, rejected: 1, total: 3 });
  assert.deepEqual(s.stats, { xp: 230, level: 3, streak: 3, lastActiveDay: today });
  assert.equal(s.email, 'sara@x.com');
  assert.ok(s.joinedAt);
  assert.ok(!('passwordHash' in s));
  await api('GET', '/api/admin/students?role=teacher', { as: ADMIN });
  assert.equal(userFilter.role, 'teacher');
  assert.equal((await api('GET', '/api/admin/students?role=admin', { as: ADMIN })).status, 400, 'admins are never listed');
});

test('student detail: profile, level, per-language progress, quizzes, badges, activity', async () => {
  const r = await api('GET', `/api/admin/students/${OID(1)}`, { as: ADMIN });
  assert.equal(r.status, 200);
  const d = r.data;
  assert.deepEqual([d.student.name, d.student.email, d.student.sessions, d.student.disabled], ['Sara', 'sara@x.com', 2, false]);
  assert.ok(!('passwordHash' in d.student));
  assert.deepEqual([d.stats.xp, d.stats.level, d.stats.streak, d.stats.longestStreak, d.stats.completedTotal], [230, 3, 3, 5, 3]);
  const css = d.languages.find((l) => l.slug === 'css');
  assert.deepEqual([css.completed, css.total, css.percent, css.quizzesTaken], [3, 6, 50, 1]);
  assert.equal(d.quizzes.length, 1, 'results of quizzes that no longer exist are hidden');
  assert.deepEqual([d.quizzes[0].title, d.quizzes[0].percent, d.quizzes[0].attempts], ['CSS Basics', 80, 2]);
  assert.ok(d.badges.some((b) => b.id === 'first-lesson') && d.badges.some((b) => b.id === 'streak-3'));
  assert.equal(d.series.length, 14);
  assert.equal(d.recent[0].title, 'Selectors');
  assert.deepEqual(d.videos, { pending: 0, approved: 2, rejected: 1, total: 3 });
  assert.equal((await api('GET', `/api/admin/students/${OID(77)}`, { as: ADMIN })).status, 404);
  assert.equal((await api('GET', '/api/admin/students/nope', { as: ADMIN })).status, 404);
});

test('suspending needs a reason, hides nothing else, and signs the student out everywhere', async () => {
  const path = `/api/admin/students/${OID(1)}/suspension`;
  assert.equal((await api('PATCH', path, { as: ADMIN, body: { disabled: true } })).status, 400, 'reason required');
  assert.equal(userUpdate, undefined);
  const r = await api('PATCH', path, { as: ADMIN, body: { disabled: true, reason: 'Spam uploads' } });
  assert.equal(r.status, 200);
  assert.deepEqual(userUpdate.change.$set, { disabled: true, disabledReason: 'Spam uploads' });
  assert.deepEqual(deleted.find(([m]) => m === 'RefreshToken')?.[1], { user: OID(1) }, 'refresh sessions are revoked');
  deleted = [];
  await api('PATCH', path, { as: ADMIN, body: { disabled: false } });
  assert.deepEqual(userUpdate.change.$set, { disabled: false, disabledReason: '' });
  assert.equal(deleted.length, 0, 'reactivating revokes nothing');
});

test('admins and yourself are protected from account actions', async () => {
  for (const [m, p, body] of [
    ['PATCH', `/api/admin/students/${OID(9)}/suspension`, { disabled: true, reason: 'x y z' }],
    ['PATCH', `/api/admin/students/${OID(9)}/role`, { role: 'student' }],
    ['DELETE', `/api/admin/students/${OID(9)}?confirm=sara%40x.com`, undefined],
  ]) {
    assert.equal((await api(m, p, { as: ADMIN, body })).status, 403, `${m} ${p}`);
  }
  assert.equal(userUpdate, undefined);
  assert.equal(deleted.length, 0);
});

test('role can only be student or teacher (admin is made from the command line)', async () => {
  const path = `/api/admin/students/${OID(1)}/role`;
  assert.equal((await api('PATCH', path, { as: ADMIN, body: { role: 'admin' } })).status, 400);
  assert.equal(userUpdate, undefined);
  assert.equal((await api('PATCH', path, { as: ADMIN, body: { role: 'teacher' } })).status, 200);
  assert.equal(userUpdate.change.$set.role, 'teacher');
});

test('deleting a student needs the email typed, then removes the account and everything it owns', async () => {
  const path = `/api/admin/students/${OID(1)}`;
  assert.equal((await api('DELETE', path, { as: ADMIN })).status, 400);
  assert.equal((await api('DELETE', `${path}?confirm=wrong%40x.com`, { as: ADMIN })).status, 400);
  assert.equal(deleted.length, 0, 'nothing deleted without the right confirmation');

  mock.method(Video, 'find', chain([]));
  const r = await api('DELETE', `${path}?confirm=SARA%40x.com`, { as: ADMIN });
  assert.equal(r.status, 204);
  assert.deepEqual(deleted.map(([m]) => m).sort(), ['Activity', 'Progress', 'QuizResult', 'RefreshToken', 'User', 'UserStats', 'Video']);

  deleted = [];
  mock.method(Video, 'find', chain([{ _id: OID(60) }]));
  await api('DELETE', `${path}?confirm=sara%40x.com`, { as: ADMIN });
  assert.deepEqual(deleted.find(([m]) => m === 'VideoChunk')?.[1], { video: { $in: [OID(60)] } }, 'uploaded video files are removed too');
});

test('CSV export: one row per student, spreadsheet formulas are neutralised', async () => {
  mock.method(User, 'find', chain([student({ name: '=HYPERLINK("http://evil")', email: 'a,b@x.com' })]));
  const r = await api('GET', '/api/admin/students/export.csv', { as: ADMIN });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.match(r.headers.get('content-disposition'), /attachment; filename="students-\d{4}-\d{2}-\d{2}\.csv"/);
  const lines = r.text.replace(/^\uFEFF/, '').trim().split('\r\n');
  assert.equal(lines[0], 'Name,Email,Signed up,Purpose,XP,Level,Streak,Last active,Videos approved,Videos waiting,Videos rejected,Status');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].startsWith('"\'=HYPERLINK(""http://evil"")","a,b@x.com",2026-02-01,Learn web,230,3,3,'), lines[1]);
  assert.ok(lines[1].endsWith(',2,0,1,Active'));
  assert.equal((await api('GET', '/api/admin/students/export.csv', { as: STUDENT })).status, 403);
});

test('a suspended student cannot log in, and does not learn that from a wrong password', async () => {
  const passwordHash = bcrypt.hashSync('correct-horse', 4);
  mock.method(User, 'findOne', () => ({ select: async () => ({ id: OID(1), passwordHash, disabled: true, role: 'student' }) }));
  const login = (password) => api('POST', '/api/auth/login', { body: { email: 'sara@x.com', password } });
  const ok = await login('correct-horse');
  assert.equal(ok.status, 403);
  assert.match(ok.data.message, /suspended/i);
  assert.equal((await login('wrong-password')).status, 401);
});

test('video list filters by status and student, and rejects bad input', async () => {
  const r = await api('GET', `/api/admin/videos?status=pending&student=${OID(1)}`, { as: ADMIN });
  assert.equal(r.status, 200);
  assert.equal(videoFilter.status, 'pending');
  assert.equal(videoFilter.uploadedBy, OID(1));
  assert.equal(r.data.videos[0].uploaderId, OID(1));
  assert.ok(!('chunkCount' in r.data.videos[0]));

  await api('GET', '/api/admin/videos', { as: ADMIN });
  assert.deepEqual(videoFilter.status, { $in: ['pending', 'approved', 'rejected'] }, 'half-finished uploads are hidden');
  assert.equal((await api('GET', '/api/admin/videos?status=bogus', { as: ADMIN })).status, 400);
  assert.equal((await api('GET', '/api/admin/videos?student=nope', { as: ADMIN })).status, 400);
});

test('rejecting a video needs a reason and records who reviewed it', async () => {
  const path = `/api/admin/videos/${OID(50)}/status`;
  assert.equal((await api('PATCH', path, { as: ADMIN, body: { status: 'rejected' } })).status, 400);
  assert.equal((await api('PATCH', path, { as: ADMIN, body: { status: 'deleted' } })).status, 400);
  assert.equal(update, undefined, 'nothing saved for invalid requests');

  const r = await api('PATCH', path, { as: ADMIN, body: { status: 'rejected', reason: 'Not about programming' } });
  assert.equal(r.status, 200);
  assert.equal(update.change.$set.status, 'rejected');
  assert.equal(update.change.$set.rejectReason, 'Not about programming');
  assert.equal(update.change.$set.reviewedBy, ADMIN.id);
  assert.equal(r.data.video.rejectReason, 'Not about programming');
});

test('approving clears an old reject reason; moving back to pending clears the review', async () => {
  const path = `/api/admin/videos/${OID(50)}/status`;
  await api('PATCH', path, { as: ADMIN, body: { status: 'approved', reason: 'ignored' } });
  assert.equal(update.change.$set.rejectReason, '');
  assert.equal(update.change.$set.reviewedBy, ADMIN.id);
  await api('PATCH', path, { as: ADMIN, body: { status: 'pending' } });
  assert.equal(update.change.$set.reviewedBy, null);
  assert.equal((await api('PATCH', '/api/admin/videos/not-an-id/status', { as: ADMIN, body: { status: 'approved' } })).status, 404);
});
