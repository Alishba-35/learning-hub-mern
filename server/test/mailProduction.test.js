// Production mein SMTP set na ho to email chup-chap "bhej di" nahi jati: admin ko saaf error milta hai.
import test, { after, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'production';
process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'mail-production-test-secret-mail-production-test';
process.env.CLIENT_ORIGIN = 'https://learning-hub.example';
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: PasswordReset } = await import('../src/models/PasswordReset.js');

let server;
let base;
before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = async (path, body, auth) => {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
};

test('without SMTP settings: the admin is told, and forgot-password still answers the same but keeps no unusable code', async () => {
  const OID = '000000000000000000000001';
  const admin = jwt.sign({ sub: '000000000000000000000009', role: 'admin' }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  mock.method(User, 'find', () => ({ select: () => ({ lean: async () => [{ _id: OID, name: 'Sara', email: 'sara@x.com' }] }) }));
  const r = await post('/api/admin/email', { userIds: [OID], subject: 'Hello there', message: 'Hi Sara' }, admin);
  assert.equal(r.status, 503);
  assert.match(r.data.message, /SMTP/);

  let deleted = 0;
  mock.method(User, 'findOne', async () => ({ _id: OID, id: OID, name: 'Sara', email: 'sara@x.com', disabled: false }));
  mock.method(PasswordReset, 'findOne', async () => null);
  mock.method(PasswordReset, 'findOneAndUpdate', async () => ({}));
  mock.method(PasswordReset, 'deleteOne', async () => (deleted += 1));
  mock.method(console, 'error', () => {});
  const f = await post('/api/auth/forgot-password', { email: 'sara@x.com' });
  assert.equal(f.status, 200);
  assert.equal(deleted, 1, 'the stored code is removed when the email could not be sent');
});
