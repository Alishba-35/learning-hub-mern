// Announcements ko bina MongoDB ke test karta hai: kaun dekh sakta hai, kaun bana sakta hai, aur kya save hota hai.
import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'announce-test-secret-announce-test-secret-123';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Announcement } = await import('../src/models/Announcement.js');

const OID = (n) => String(n).padStart(24, '0');
const token = (id, role) => jwt.sign({ sub: id, role }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
const ADMIN = token(OID(9), 'admin');
const TEACHER = token(OID(3), 'teacher');
const STUDENT = token(OID(1), 'student');

let server;
let base;
let findFilter;
let created;
let removedId;

before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const chain = (result, onFilter) => {
  const c = { sort: () => c, limit: () => c, select: () => c, lean: async () => result };
  return (filter) => (onFilter?.(filter), c);
};

async function api(method, path, { as, body } = {}) {
  const headers = {};
  if (as) headers.Authorization = `Bearer ${as}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const row = (over = {}) => ({
  _id: OID(70), title: 'Quiz on Friday', body: 'Revise CSS selectors.', level: 'info', audience: 'everyone', recipients: [],
  createdAt: new Date('2026-11-10T10:00:00Z'), expiresAt: null, createdByName: 'Alishba', ...over,
});

beforeEach(() => {
  mock.restoreAll();
  findFilter = created = removedId = undefined;
  mock.method(Announcement, 'find', chain([row()], (f) => (findFilter = f)));
  mock.method(Announcement, 'create', async (doc) => {
    created = doc;
    return { toObject: () => row({ ...doc, _id: OID(71), createdAt: new Date() }) };
  });
  mock.method(Announcement, 'findByIdAndDelete', (id) => ({ lean: async () => (id === OID(99) ? null : row({ _id: id })) }));
  mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ name: 'Alishba' }) }) }));
  mock.method(User, 'find', chain([{ _id: OID(1) }, { _id: OID(2) }]));
});

test('students read announcements, and only a logged-in user can', async () => {
  assert.equal((await api('GET', '/api/announcements')).status, 401);
  const r = await api('GET', '/api/announcements', { as: STUDENT });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.announcements, [{ id: OID(70), title: 'Quiz on Friday', body: 'Revise CSS selectors.', level: 'info', personal: false, createdAt: '2026-11-10T10:00:00.000Z', expiresAt: null }]);
  assert.ok(!JSON.stringify(r.data).includes('recipients'), 'who else got it is never shown');
});

test('the student query hides expired ones and shows only "everyone" or "sent to me"', async () => {
  await api('GET', '/api/announcements', { as: STUDENT });
  const [expiry, audience] = findFilter.$and;
  assert.deepEqual(expiry.$or[0], { expiresAt: null });
  assert.ok(expiry.$or[1].expiresAt.$gt instanceof Date);
  assert.deepEqual(audience.$or, [{ audience: 'everyone' }, { recipients: OID(1) }]);
});

test('important announcements come first, then the newest; at most five', async () => {
  mock.method(Announcement, 'find', chain([
    row({ _id: OID(1), title: 'old info', createdAt: new Date('2026-11-01') }),
    row({ _id: OID(2), title: 'new info', createdAt: new Date('2026-11-09') }),
    row({ _id: OID(3), title: 'important but older', level: 'important', createdAt: new Date('2026-11-02') }),
    ...[4, 5, 6, 7].map((n) => row({ _id: OID(n), title: `filler ${n}`, createdAt: new Date(`2026-10-0${n}`) })),
  ]));
  const r = await api('GET', '/api/announcements', { as: STUDENT });
  assert.equal(r.data.announcements.length, 5);
  assert.deepEqual(r.data.announcements.slice(0, 3).map((a) => a.title), ['important but older', 'new info', 'old info']);
});

test('a personal reminder is flagged as personal', async () => {
  mock.method(Announcement, 'find', chain([row({ audience: 'selected', recipients: [OID(1)] })]));
  const r = await api('GET', '/api/announcements', { as: STUDENT });
  assert.equal(r.data.announcements[0].personal, true);
});

test('only an admin can list, create or delete announcements', async () => {
  for (const [m, p, body] of [['GET', '/api/admin/announcements'], ['POST', '/api/admin/announcements', { title: 'Hello', body: 'World!' }], ['DELETE', `/api/admin/announcements/${OID(70)}`]]) {
    assert.equal((await api(m, p, { body })).status, 401, `${m} no login`);
    assert.equal((await api(m, p, { as: STUDENT, body })).status, 403, `${m} student`);
    assert.equal((await api(m, p, { as: TEACHER, body })).status, 403, `${m} teacher`);
  }
  assert.equal(created, undefined);
});

test('admin list shows status, audience size and who wrote it', async () => {
  mock.method(Announcement, 'find', chain([
    row({ _id: OID(1) }),
    row({ _id: OID(2), audience: 'selected', recipients: [OID(1), OID(2), OID(3)] }),
    row({ _id: OID(3), expiresAt: new Date('2020-01-01') }),
  ]));
  const r = await api('GET', '/api/admin/announcements', { as: ADMIN });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.announcements.map((a) => [a.audience, a.recipientCount, a.active]), [['everyone', null, true], ['selected', 3, true], ['everyone', null, false]]);
  assert.equal(r.data.announcements[0].createdByName, 'Alishba');
});

test('creating for everyone saves the message, the writer and an expiry date', async () => {
  const before = Date.now();
  const r = await api('POST', '/api/admin/announcements', { as: ADMIN, body: { title: '  New JS quiz  ', body: 'Opens tomorrow.', level: 'important', expiresInDays: 7 } });
  assert.equal(r.status, 201);
  assert.equal(created.title, 'New JS quiz', 'trimmed');
  assert.deepEqual([created.level, created.audience, created.recipients], ['important', 'everyone', []]);
  assert.equal(created.createdBy, OID(9));
  assert.equal(created.createdByName, 'Alishba');
  const days = (created.expiresAt - before) / 86400000;
  assert.ok(days > 6.99 && days < 7.01, `expires in 7 days, got ${days}`);
  assert.equal(r.data.recipients, 0);
  assert.equal(r.data.announcement.active, true);
});

test('with no expiry it stays up until an admin removes it', async () => {
  await api('POST', '/api/admin/announcements', { as: ADMIN, body: { title: 'Welcome', body: 'Happy learning!' } });
  assert.equal(created.expiresAt, null);
  assert.equal(created.level, 'info');
});

test('a reminder to selected students only keeps real students', async () => {
  const r = await api('POST', '/api/admin/announcements', { as: ADMIN, body: { title: 'We miss you', body: 'Come back!', audience: 'selected', userIds: [OID(1), OID(2), OID(5)] } });
  assert.equal(r.status, 201);
  assert.deepEqual(created.recipients, [OID(1), OID(2)], 'unknown ids are dropped');
  assert.equal(r.data.recipients, 2);

  mock.method(User, 'find', chain([]));
  created = undefined;
  assert.equal((await api('POST', '/api/admin/announcements', { as: ADMIN, body: { title: 'We miss you', body: 'Come back!', audience: 'selected', userIds: [OID(8)] } })).status, 400);
  assert.equal(created, undefined, 'nothing saved when nobody matches');
});

test('bad announcements are rejected before anything is saved', async () => {
  const good = { title: 'Hello there', body: 'A proper message.' };
  for (const bad of [
    { ...good, title: 'Hi' }, { ...good, title: 'x'.repeat(81) }, { ...good, body: 'ok' }, { ...good, body: 'x'.repeat(501) },
    { ...good, level: 'urgent' }, { ...good, audience: 'selected' }, { ...good, audience: 'selected', userIds: ['nope'] },
    { ...good, expiresInDays: 0 }, { ...good, expiresInDays: 91 }, { ...good, expiresInDays: 1.5 }, { ...good, userIds: Array(201).fill(OID(1)), audience: 'selected' },
  ]) {
    assert.equal((await api('POST', '/api/admin/announcements', { as: ADMIN, body: bad })).status, 400, JSON.stringify(bad).slice(0, 80));
  }
  assert.equal(created, undefined);
});

test('delete: removes it, 404 when it is already gone or the id is bad', async () => {
  mock.method(Announcement, 'findByIdAndDelete', (id) => ({ lean: async () => ((removedId = id) === OID(99) ? null : row()) }));
  assert.equal((await api('DELETE', `/api/admin/announcements/${OID(70)}`, { as: ADMIN })).status, 204);
  assert.equal(removedId, OID(70));
  assert.equal((await api('DELETE', `/api/admin/announcements/${OID(99)}`, { as: ADMIN })).status, 404);
  assert.equal((await api('DELETE', '/api/admin/announcements/nope', { as: ADMIN })).status, 404);
});
