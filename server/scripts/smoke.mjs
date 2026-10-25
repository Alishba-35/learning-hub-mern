// Auth flow smoke test. Server chal raha ho (npm run dev), phir:  node scripts/smoke.mjs
const BASE = process.env.API || 'http://localhost:5000';
const email = `smoke_${Date.now()}@example.com`;
const password = 'Test@1234';
let cookie = '';
let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}  ${detail}`);
  }
}

async function call(method, path, { body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('refreshToken='));
  if (setCookie) {
    const pair = setCookie.split(';')[0];
    cookie = pair === 'refreshToken=' ? '' : pair; // khali value = cookie clear hui
  }
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* 204 par body nahi hoti */ }
  return { status: res.status, data, setCookie };
}

try {
  let r = await call('GET', '/api/health');
  check('health check', r.status === 200);

  r = await call('POST', '/api/auth/register', {
    body: { name: 'Smoke Test', email, password, remember: true, role: 'admin' },
  });
  check('register -> 201', r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);
  check('register returns accessToken', Boolean(r.data?.accessToken));
  check('role injection ignored (stays student)', r.data?.user?.role === 'student', `role=${r.data?.user?.role}`);
  check('refresh cookie is HttpOnly', /httponly/i.test(r.setCookie || ''));
  check('remember=true -> persistent cookie', /max-age/i.test(r.setCookie || ''));
  check('password hash not in response', !JSON.stringify(r.data).includes('passwordHash'));

  r = await call('POST', '/api/auth/register', { body: { name: 'Smoke Test', email, password } });
  check('duplicate email -> 409', r.status === 409, `got ${r.status}`);

  r = await call('POST', '/api/auth/register', {
    body: { name: 'Weak Pass', email: `weak_${Date.now()}@example.com`, password: '123' },
  });
  check('weak password -> 400', r.status === 400, `got ${r.status}`);

  r = await call('POST', '/api/auth/login', { body: { email, password: 'WrongPass1' } });
  check('wrong password -> 401', r.status === 401, `got ${r.status}`);

  r = await call('POST', '/api/auth/login', { body: { email, password, remember: true } });
  check('login -> 200', r.status === 200, `got ${r.status}`);
  const accessToken = r.data?.accessToken;

  r = await call('GET', '/api/auth/me', { token: accessToken });
  check('me with token -> 200', r.status === 200 && r.data?.user?.email === email, `got ${r.status}`);

  r = await call('GET', '/api/auth/me');
  check('me without token -> 401', r.status === 401, `got ${r.status}`);

  const oldCookie = cookie;
  r = await call('POST', '/api/auth/refresh');
  check('refresh -> 200 + new token', r.status === 200 && Boolean(r.data?.accessToken), `got ${r.status}`);
  check('refresh token rotated', cookie !== '' && cookie !== oldCookie);

  const goodCookie = cookie;
  cookie = oldCookie;
  r = await call('POST', '/api/auth/refresh');
  check('old refresh token rejected -> 401', r.status === 401, `got ${r.status}`);
  cookie = goodCookie;

  r = await call('POST', '/api/auth/logout');
  check('logout -> 204', r.status === 204, `got ${r.status}`);
  cookie = goodCookie; // logout ke baad purani cookie se dobara try
  r = await call('POST', '/api/auth/refresh');
  check('refresh after logout -> 401', r.status === 401, `got ${r.status}`);

  cookie = '';
  r = await call('POST', '/api/auth/login', { body: { email, password, remember: false } });
  check('remember=false -> session cookie (no max-age)', r.status === 200 && !/max-age|expires/i.test(r.setCookie || ''), r.setCookie);
} catch (err) {
  failed++;
  console.log(`FAIL  script error: ${err.message} (server chal raha hai?)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
