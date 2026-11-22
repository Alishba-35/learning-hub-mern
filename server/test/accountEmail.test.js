// OTP se password reset, profile (naam/photo) aur students ko seedha email. Models mock, baqi sab asli (bina MongoDB).
// SMTP set nahi, is liye email console mein print hoti hai: test usi se OTP padhta hai.
import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'account-email-test-secret-account-email-test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: PasswordReset } = await import('../src/models/PasswordReset.js');
const { default: RefreshToken } = await import('../src/models/RefreshToken.js');

const OID = (n) => String(n).padStart(24, '0');
const token = (id, role) => jwt.sign({ sub: id, role }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
const hmac = (userId, otp) => crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET).update(`${userId}:${otp}`).digest('hex');
const sara = { _id: OID(1), id: OID(1), name: 'Sara Khan', email: 'sara@x.com', role: 'student', disabled: false };

let server;
let base;
let mails;
let calls;

before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function api(method, path, { body, as } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (as) headers.Authorization = `Bearer ${as}`;
  const res = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

beforeEach(() => {
  mock.restoreAll();
  mails = [];
  calls = { upsert: null, inc: null, passwordUpdate: null, resetDeleted: 0, tokensDeleted: 0, profile: null };
  // sendMail ki jagah console.log pakadte hain
  mock.method(console, 'log', (...args) => mails.push(args.join(' ')));
  mock.method(User, 'findOne', async ({ email }) => (email === 'sara@x.com' ? sara : email === 'off@x.com' ? { ...sara, disabled: true } : null));
  mock.method(PasswordReset, 'findOne', async () => null);
  mock.method(PasswordReset, 'findOneAndUpdate', async (filter, update, opts) => (calls.upsert = { filter, update, opts }));
  mock.method(PasswordReset, 'updateOne', async (filter, update) => (calls.inc = { filter, update }));
  mock.method(PasswordReset, 'deleteOne', async () => (calls.resetDeleted += 1));
  mock.method(PasswordReset, 'deleteMany', async () => (calls.resetDeleted += 1));
  mock.method(RefreshToken, 'deleteMany', async () => (calls.tokensDeleted += 1));
  mock.method(User, 'updateOne', async (filter, change) => (calls.passwordUpdate = { filter, change }));
});

// ---------- Password reset ----------
// (reset raaste 15 minute mein 10 baar hi chalte hain, is liye is section mein kul 9 requests)

test('forgot-password: an unknown, suspended or unregistered email gets the same answer and no email', async () => {
  const unknown = await api('POST', '/api/auth/forgot-password', { body: { email: 'nobody@x.com' } });
  const suspended = await api('POST', '/api/auth/forgot-password', { body: { email: 'off@x.com' } });
  assert.equal(unknown.status, 200);
  assert.deepEqual(unknown.data, suspended.data);
  assert.equal(mails.length, 0);
  assert.equal(calls.upsert, null);
});

test('forgot-password: sends a 6-digit code, stores only its hash, valid for 10 minutes', async () => {
  const r = await api('POST', '/api/auth/forgot-password', { body: { email: 'SARA@x.com ' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.resendSeconds, 60);
  const text = mails.join('\n');
  const otp = text.match(/reset code is (\d{6})/)[1];
  assert.match(text, /To: sara@x\.com/);
  assert.equal(calls.upsert.update.otpHash, hmac(OID(1), otp));
  assert.ok(!JSON.stringify(calls.upsert).includes(otp), 'the code itself is never stored');
  assert.equal(calls.upsert.update.attempts, 0);
  const minutes = (calls.upsert.update.expiresAt - Date.now()) / 60000;
  assert.ok(minutes > 9.5 && minutes <= 10);
});

test('forgot-password: asking again within a minute does not send another email', async () => {
  mock.method(PasswordReset, 'findOne', async () => ({ sentAt: new Date() }));
  const r = await api('POST', '/api/auth/forgot-password', { body: { email: 'sara@x.com' } });
  assert.equal(r.status, 200);
  assert.equal(mails.length, 0);
  assert.equal(calls.upsert, null);
});

test('reset-password: a wrong code is refused and counted', async () => {
  mock.method(PasswordReset, 'findOne', async () => ({ otpHash: hmac(OID(1), '123456'), attempts: 1, expiresAt: new Date(Date.now() + 60000) }));
  const r = await api('POST', '/api/auth/reset-password', { body: { email: 'sara@x.com', otp: '654321', password: 'NewPassword1' } });
  assert.equal(r.status, 400);
  assert.match(r.data.message, /wrong or has expired/);
  assert.deepEqual(calls.inc.update, { $inc: { attempts: 1 } });
  assert.equal(calls.passwordUpdate, null);
});

test('reset-password: the right code sets the new password and signs out every device', async () => {
  mock.method(PasswordReset, 'findOne', async () => ({ otpHash: hmac(OID(1), '123456'), attempts: 0, expiresAt: new Date(Date.now() + 60000) }));
  const r = await api('POST', '/api/auth/reset-password', { body: { email: 'sara@x.com', otp: '123456', password: 'NewPassword1' } });
  assert.equal(r.status, 200);
  assert.ok(await bcrypt.compare('NewPassword1', calls.passwordUpdate.change.passwordHash));
  assert.equal(calls.resetDeleted, 1, 'the code is used up');
  assert.equal(calls.tokensDeleted, 1, 'old logins are removed');
});

test('reset-password: an expired code, and a code that was guessed too often, are refused', async () => {
  mock.method(PasswordReset, 'findOne', async () => ({ otpHash: hmac(OID(1), '123456'), attempts: 0, expiresAt: new Date(Date.now() - 1000) }));
  const expired = await api('POST', '/api/auth/reset-password', { body: { email: 'sara@x.com', otp: '123456', password: 'NewPassword1' } });
  assert.equal(expired.status, 400);
  mock.method(PasswordReset, 'findOne', async () => ({ otpHash: hmac(OID(1), '123456'), attempts: 5, expiresAt: new Date(Date.now() + 60000) }));
  const guessed = await api('POST', '/api/auth/reset-password', { body: { email: 'sara@x.com', otp: '123456', password: 'NewPassword1' } });
  assert.equal(guessed.status, 400, 'even the right code is refused after 5 wrong tries');
  assert.equal(calls.passwordUpdate, null);
});

test('reset-password: the code must be 6 digits and the password 8+ characters', async () => {
  const r = await api('POST', '/api/auth/reset-password', { body: { email: 'sara@x.com', otp: '12ab', password: 'short' } });
  assert.equal(r.status, 400);
  assert.deepEqual(r.data.errors.map((e) => e.field).sort(), ['otp', 'password']);
});

// ---------- Profile ----------

const JPEG = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.alloc(40, 1)]).toString('base64')}`;
const profileMock = () =>
  mock.method(User, 'findByIdAndUpdate', (id, change) => {
    calls.profile = { id, change };
    return { select: async (s) => ({ toSafeJSON: () => ({ id, name: change.$set.name ?? 'Sara Khan', avatar: change.$set.avatar ?? '', selected: s }) }) };
  });

test('profile: needs a login, and needs something to change', async () => {
  profileMock();
  assert.equal((await api('PATCH', '/api/auth/profile', { body: { name: 'Sara' } })).status, 401);
  const empty = await api('PATCH', '/api/auth/profile', { body: {}, as: token(OID(1), 'student') });
  assert.equal(empty.status, 400);
});

test('profile: updates the name and the photo of the logged-in user only', async () => {
  profileMock();
  const as = token(OID(1), 'student');
  const name = await api('PATCH', '/api/auth/profile', { body: { name: '  Sara K  ' }, as });
  assert.equal(name.status, 200);
  assert.equal(name.data.user.name, 'Sara K');
  assert.equal(calls.profile.id, OID(1));
  assert.deepEqual(calls.profile.change, { $set: { name: 'Sara K' } });
  assert.equal(name.data.user.selected, '+avatar', 'the photo comes back with the user');
  const photo = await api('PATCH', '/api/auth/profile', { body: { avatar: JPEG }, as });
  assert.equal(photo.status, 200);
  assert.equal(calls.profile.change.$set.avatar, JPEG);
  const removed = await api('PATCH', '/api/auth/profile', { body: { avatar: null }, as });
  assert.equal(removed.status, 200);
  assert.equal(calls.profile.change.$set.avatar, '');
});

test('profile: a photo must be a real JPEG/PNG/WebP image, and a 60 KB photo fits', async () => {
  profileMock();
  const as = token(OID(1), 'student');
  const fakeBytes = `data:image/jpeg;base64,${Buffer.from('this is not an image at all').toString('base64')}`;
  assert.equal((await api('PATCH', '/api/auth/profile', { body: { avatar: fakeBytes }, as })).status, 400);
  assert.equal((await api('PATCH', '/api/auth/profile', { body: { avatar: 'data:text/html;base64,PGI+aGk8L2I+' }, as })).status, 400);
  assert.equal((await api('PATCH', '/api/auth/profile', { body: { avatar: 'https://evil.example/x.png' }, as })).status, 400);
  assert.equal((await api('PATCH', '/api/auth/profile', { body: { name: 'A' }, as })).status, 400, 'name too short');
  const big = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(45000, 7)]).toString('base64')}`;
  assert.ok(big.length > 55000);
  assert.equal((await api('PATCH', '/api/auth/profile', { body: { avatar: big }, as })).status, 200);
});

// ---------- Admin: students ko seedha email ----------

const ADMIN = token(OID(9), 'admin');
const students = [
  { _id: OID(1), name: 'Sara Khan', email: 'sara@x.com' },
  { _id: OID(2), name: 'Ali <b>Raza</b>', email: 'ali@x.com' },
];
const findMock = (rows) =>
  mock.method(User, 'find', (filter) => {
    calls.find = filter;
    return { select: () => ({ lean: async () => rows }) };
  });

test('admin email: each student gets their own email; others cannot send', async () => {
  findMock(students);
  const body = { userIds: [OID(1), OID(2), OID(3)], subject: 'We miss you', message: 'Finish one lesson today!\n\nSee you soon.' };
  assert.equal((await api('POST', '/api/admin/email', { body, as: token(OID(1), 'student') })).status, 403);
  assert.equal((await api('POST', '/api/admin/email', { body })).status, 401);
  const r = await api('POST', '/api/admin/email', { body, as: ADMIN });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { sent: 2, failed: 0, skipped: 1, devLogged: true });
  assert.deepEqual(calls.find.role, 'student');
  assert.deepEqual(calls.find.disabled, { $ne: true }, 'suspended students are skipped');
  const text = mails.join('\n');
  assert.match(text, /To: sara@x\.com/);
  assert.match(text, /To: ali@x\.com/);
  assert.ok(!/To: [^\n]*,/.test(text), 'one recipient per email, nobody sees other addresses');
  assert.match(text, /Hi Sara,/);
  assert.match(text, /Finish one lesson today!/);
});

test('admin email: checks the input and says when nobody can be emailed', async () => {
  findMock([]);
  const bad = await api('POST', '/api/admin/email', { body: { userIds: [], subject: 'x', message: '' }, as: ADMIN });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.data.errors.map((e) => e.field).sort(), ['message', 'subject', 'userIds']);
  const none = await api('POST', '/api/admin/email', { body: { userIds: [OID(5)], subject: 'Hello', message: 'Hi there' }, as: ADMIN });
  assert.equal(none.status, 404);
});

test('the email templates escape html in names and messages', async () => {
  const { studentEmail, otpEmail } = await import('../src/utils/mailTemplates.js');
  const m = studentEmail({ name: '<script>x</script> Ali', subject: 'Hi <b>', message: '<img src=x onerror=alert(1)>\nline two' });
  assert.ok(!m.html.includes('<script>') && !m.html.includes('<img'));
  assert.ok(m.html.includes('&lt;img'));
  const o = otpEmail({ name: 'Sara', otp: '042917', minutes: 10 });
  assert.match(o.subject, /^042917 /);
  assert.ok(o.html.includes('042917') && o.text.includes('10 minutes'));
});
