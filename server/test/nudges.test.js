// Insights ki emails: ek click (poora group) aur roz khud chalne wali (Vercel Cron). Models mock, bina MongoDB.
import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'nudge-test-secret-nudge-test-secret-nudge-test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.CRON_SECRET = 'cron-secret-for-tests-1234567890';
process.env.AUTO_NUDGE_MAX = '3';
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: UserStats } = await import('../src/models/UserStats.js');
const { default: NudgeLog } = await import('../src/models/NudgeLog.js');
const { default: Setting } = await import('../src/models/Setting.js');
const { utcDay } = await import('../src/utils/progress.js');

const OID = (n) => String(n).padStart(24, '0');
const DAY = 24 * 60 * 60 * 1000;
const day = (ago) => utcDay(new Date(Date.now() - ago * DAY));
const token = (id, role) => jwt.sign({ sub: id, role }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
const ADMIN = token(OID(99), 'admin');

// 5 students ruke hue (10 din), 1 ne kabhi shuru nahi kiya, 1 active
const joined = new Date(Date.now() - 20 * DAY);
const students = [1, 2, 3, 4, 5].map((n) => ({ _id: OID(n), name: `Student ${n}`, email: `s${n}@x.com`, createdAt: joined }));
students.push({ _id: OID(6), name: 'Newbie', email: 'new@x.com', createdAt: joined }, { _id: OID(7), name: 'Active', email: 'active@x.com', createdAt: joined });
const stats = [1, 2, 3, 4, 5].map((n) => ({ user: OID(n), xp: 10, longestStreak: 1, lastActiveDay: day(10) })).concat([{ user: OID(7), xp: 50, longestStreak: 2, lastActiveDay: day(0) }]);

let server;
let base;
let mails;
let state;

before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function api(method, path, { body, as, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (as) h.Authorization = `Bearer ${as}`;
  const res = await fetch(base + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

beforeEach(() => {
  mock.restoreAll();
  mails = [];
  state = { recent: [], logs: [], setting: null };
  mock.method(console, 'log', (...a) => mails.push(a.join(' ')));
  mock.method(User, 'find', () => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => students }) }) }) }));
  mock.method(UserStats, 'find', () => ({ select: () => ({ lean: async () => stats }) }));
  mock.method(NudgeLog, 'find', () => ({ select: () => ({ lean: async () => state.recent.map((user) => ({ user })) }) }));
  mock.method(NudgeLog, 'insertMany', async (rows) => state.logs.push(...rows));
  mock.method(Setting, 'findOne', () => ({ lean: async () => state.setting }));
  mock.method(Setting, 'findOneAndUpdate', async (filter, update) => (state.setting = { key: filter.key, value: update.value }));
});

test('one click: the ready message goes to EVERY student of the group, not only the first 50', async () => {
  const r = await api('POST', '/api/admin/nudges/send', { body: { group: 'inactive' }, as: ADMIN });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { sent: 5, failed: 0, skippedRecent: 0, waiting: 0, devLogged: true });
  const text = mails.join('\n');
  for (const n of [1, 2, 3, 4, 5]) assert.match(text, new RegExp(`To: s${n}@x\\.com`));
  assert.ok(!text.includes('new@x.com') && !text.includes('active@x.com'), 'other groups are not emailed');
  assert.match(text, /Subject: We miss you on Learning Hub/);
  assert.match(text, /Hi Student,/);
  assert.equal(state.logs.length, 5);
  assert.ok(state.logs.every((l) => l.group === 'inactive' && l.auto === false));
});

test('one click: a student who was nudged in the last 7 days is skipped', async () => {
  state.recent = [OID(2), OID(3)];
  const r = await api('POST', '/api/admin/nudges/send', { body: { group: 'inactive' }, as: ADMIN });
  assert.equal(r.data.sent, 3);
  assert.equal(r.data.skippedRecent, 2);
  assert.ok(!mails.join('\n').includes('s2@x.com'));
});

test('one click: other groups use their own message; only admins; the group must be valid', async () => {
  const r = await api('POST', '/api/admin/nudges/send', { body: { group: 'neverStarted' }, as: ADMIN });
  assert.equal(r.data.sent, 1);
  assert.match(mails.join('\n'), /Subject: Start your first lesson on Learning Hub/);
  assert.equal((await api('POST', '/api/admin/nudges/send', { body: { group: 'neverStarted' }, as: token(OID(1), 'student') })).status, 403);
  assert.equal((await api('POST', '/api/admin/nudges/send', { body: { group: 'everyone' }, as: ADMIN })).status, 400);
});

test('automatic settings: off by default, can be switched on and limited to some groups', async () => {
  const first = await api('GET', '/api/admin/nudges/auto', { as: ADMIN });
  assert.deepEqual([first.data.enabled, first.data.groups, first.data.cooldownDays, first.data.dailyMax, first.data.cronReady], [false, ['inactive', 'neverStarted', 'streakBroken'], 7, 3, true]);
  const on = await api('PUT', '/api/admin/nudges/auto', { body: { enabled: true, groups: ['inactive'] }, as: ADMIN });
  assert.equal(on.status, 200);
  assert.deepEqual([on.data.enabled, on.data.groups], [true, ['inactive']]);
  assert.equal((await api('PUT', '/api/admin/nudges/auto', { body: { enabled: true, groups: [] }, as: ADMIN })).status, 400);
  assert.equal((await api('PUT', '/api/admin/nudges/auto', { body: { enabled: 'yes' }, as: ADMIN })).status, 400);
  assert.equal((await api('GET', '/api/admin/nudges/auto')).status, 401);
});

test('cron: refuses anyone without the secret', async () => {
  assert.equal((await api('GET', '/api/cron/nudges')).status, 401);
  assert.equal((await api('GET', '/api/cron/nudges', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await api('GET', '/api/cron/nudges', { as: ADMIN })).status, 401, 'an admin login is not the cron secret');
  assert.equal(mails.length, 0);
});

test('cron: does nothing while automatic emails are switched off', async () => {
  const r = await api('GET', '/api/cron/nudges', { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert.equal(r.status, 200);
  assert.equal(r.data.ran, false);
  assert.equal(mails.length, 0);
});

test('cron: when on, sends to the chosen groups up to the daily limit, logs them and remembers the last run', async () => {
  state.setting = { key: 'autoNudges', value: { enabled: true, groups: ['inactive', 'neverStarted'], lastRun: null } };
  const r = await api('GET', '/api/cron/nudges', { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert.equal(r.status, 200);
  assert.equal(r.data.ran, true);
  assert.equal(r.data.sent, 3, 'AUTO_NUDGE_MAX is 3');
  assert.equal(r.data.waiting, 3, 'the rest wait for tomorrow');
  assert.equal(state.logs.length, 3);
  assert.ok(state.logs.every((l) => l.auto === true));
  assert.equal(state.setting.value.lastRun.sent, 3);
  assert.equal(state.setting.value.enabled, true, 'saving the last run keeps the settings');
});

test('cron: tomorrow the students already emailed are skipped and the waiting ones go out', async () => {
  state.setting = { key: 'autoNudges', value: { enabled: true, groups: ['inactive', 'neverStarted'], lastRun: null } };
  state.recent = [OID(1), OID(2), OID(3)];
  const r = await api('GET', '/api/cron/nudges', { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert.equal(r.data.sent, 3);
  assert.equal(r.data.skippedRecent, 3);
  assert.equal(r.data.waiting, 0);
  const text = mails.join('\n');
  assert.ok(text.includes('s4@x.com') && text.includes('s5@x.com') && text.includes('new@x.com'));
});
