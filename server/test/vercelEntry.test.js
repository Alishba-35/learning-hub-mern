import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGO_URI = 'mongodb://127.0.0.1:1/none';
process.env.JWT_ACCESS_SECRET = 'vercel-entry-test-secret-vercel-entry-test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { default: mongoose } = await import('mongoose');
const { mock } = test;

test('api/index.js: connects once, then serves the Express app; a failed start answers 503 and retries', async () => {
  let connects = 0;
  let fail = true;
  mock.method(mongoose, 'connect', async () => {
    connects++;
    if (fail) throw new Error('db down');
  });
  const { default: handler } = await import('../api/index.js');
  const call = (url) => {
    const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    return handler({ url, method: 'GET', headers: {} }, res).then(() => res);
  };

  const down = await call('/api/health');
  assert.equal(down.code, 503);
  assert.equal(connects, 1);
  fail = false;
  // Express app ko asli HTTP request chahiye, is liye yahan sirf yeh dekhte hain ke dobara connect ki koshish hui aur 503 nahi aaya
  const up = await Promise.race([call('/api/health'), new Promise((r) => setTimeout(() => r({ code: 'pending' }), 300))]);
  assert.notEqual(up.code, 503);
  assert.equal(connects, 2);
});
