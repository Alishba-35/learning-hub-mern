// Password hashing (asli bcrypt ya bcryptjs) aur login ki rate limits (poori class ek IP par).
import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import bcryptjs from 'bcryptjs';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'password-limits-test-secret-password-limits-test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.BCRYPT_ROUNDS = '10'; // test jaldi chalne ke liye

const { hashPassword, verifyPassword, verifyAgainstDummy, usingNativeBcrypt } = await import('../src/utils/password.js');
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');

test('hashing round-trips, uses the configured cost, and old bcryptjs hashes (cost 12) still verify', async () => {
  const hash = await hashPassword('Secret#1234');
  assert.match(hash, /^\$2[aby]\$10\$/);
  assert.equal(await verifyPassword('Secret#1234', hash), true);
  assert.equal(await verifyPassword('secret#1234', hash), false);
  const legacy = await bcryptjs.hash('Old#Password1', 12); // jaise purane users ke hash
  assert.equal(await verifyPassword('Old#Password1', legacy), true);
  assert.equal(await bcryptjs.compare('Secret#1234', hash), true, 'hashes made here also verify with bcryptjs');
  assert.equal(await verifyAgainstDummy('anything'), false);
  assert.equal(typeof usingNativeBcrypt, 'boolean');
});

let server;
let base;
before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  mock.restoreAll();
  mock.method(User, 'findOne', () => ({ select: async () => null })); // koi account nahi: har login 401
});

const login = async (email, ip) => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ email, password: 'whatever12' }) });
  return res.status;
};

test('a whole class behind one IP can log in; guessing one account is stopped after 10 tries', async () => {
  // 25 alag students ek hi IP se (pehle 21wan bhi 15 minute ke liye bahar ho jata tha)
  const statuses = [];
  for (let i = 0; i < 25; i++) statuses.push(await login(`student${i}@x.com`, '203.0.113.7'));
  assert.deepEqual([...new Set(statuses)], [401], 'every one gets a normal "wrong password", none is rate limited');

  // ek hi account par bar bar andaza: 10 ke baad 429
  const guesses = [];
  for (let i = 0; i < 12; i++) guesses.push(await login('victim@x.com', '203.0.113.7'));
  assert.deepEqual(guesses.slice(0, 10), Array(10).fill(401));
  assert.deepEqual(guesses.slice(10), [429, 429]);

  // wahi email doosre IP se alag hisaab (asli malik ko bahar nahi kiya)
  assert.equal(await login('victim@x.com', '198.51.100.9'), 401);
  // email ke upper/lower case se hadd bypass nahi hoti
  assert.equal(await login('VICTIM@x.com ', '203.0.113.7'), 429);
});
