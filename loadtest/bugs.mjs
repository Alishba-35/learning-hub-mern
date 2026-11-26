// Bug-hunt: server par jaan boojh kar ulti seedhi requests (race conditions, kharab input) bhejta hai. Jo cheez 5xx (server crash) ya
// galat hisaab de, wo FAIL. Sirf apne local server par chalayein (nakli users banata hai):
//   node loadtest/bugs.mjs            (BASE_URL=http://localhost:5055 ho to)
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:5055';
const data = JSON.parse(readFileSync(new URL('./data/users.json', import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url)));
const admin = data.users.find((u) => u.role === 'admin').token;
const students = data.users.filter((u) => u.role === 'student');
let ip = 0;
const nextIp = () => `10.77.${(ip >> 8) & 255}.${(++ip & 255) || 1}`;

const call = async (method, path, { token, body, raw, headers = {} } = {}) => {
  const h = { 'X-Forwarded-For': nextIp(), ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined && raw === undefined) h['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html/empty */ }
  return { status: res.status, json, text, headers: res.headers };
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `   -> ${detail}`}`);
};

const lang = catalog.find((l) => l.quizzes.length && l.topics.length);
const who = students[40].token; // is test ke liye ek student

// 1) Ek hi email se 10 saath register: sirf ek bane (201), baqi 409. Koi 500 nahi.
{
  const email = `race${Date.now()}@loadtest.local`;
  const rs = await Promise.all(Array.from({ length: 10 }, () => call('POST', '/api/auth/register', { body: { name: 'Race Test', email, password: 'Password#12345' } })));
  const codes = rs.map((r) => r.status).sort();
  check('10 parallel sign-ups with one email: exactly one account, no 5xx', codes.filter((c) => c === 201).length === 1 && codes.every((c) => c === 201 || c === 409 || c === 429), JSON.stringify(codes));
}

// 2) Ek hi lesson 20 baar saath complete: XP sirf ek baar
{
  const t = students[41].token;
  const topic = lang.topics[3];
  const xpOf = async () => (await call('GET', '/api/progress', { token: t })).json.stats.xp;
  const before = await xpOf();
  const rs = await Promise.all(Array.from({ length: 20 }, () => call('POST', `/api/progress/${lang.slug}/topics/${topic}/complete`, { token: t, body: {} })));
  const firsts = rs.filter((r) => r.json && r.json.alreadyCompleted === false).length;
  const after = await xpOf();
  check('20 parallel "complete lesson": XP is given exactly once', firsts === 1 && after - before === 10 && rs.every((r) => r.status < 500), `first=${firsts} xpDelta=${after - before} codes=${[...new Set(rs.map((r) => r.status))]}`);
}

// 3) Ek hi quiz 10 baar saath pehli baar submit: XP ek baar, attempts sahi
{
  const t = students[42].token;
  const quiz = lang.quizzes[0];
  const answers = Object.fromEntries(quiz.questionIds.map((id) => [id, 0]));
  const xpOf = async () => (await call('GET', '/api/progress', { token: t })).json.stats.xp;
  const before = await xpOf();
  const rs = await Promise.all(Array.from({ length: 10 }, () => call('POST', `/api/quizzes/${lang.slug}/${quiz.slug}/submit`, { token: t, body: { answers } })));
  const after = await xpOf();
  const single = rs.find((r) => r.json?.previousBest === 0)?.json?.xpGained ?? 0;
  const awarded = rs.filter((r) => r.json && r.json.xpGained > 0).length;
  check('10 parallel quiz submits: XP for the first score is given only once', rs.every((r) => r.status === 200) && after - before === single && awarded <= 1, `codes=${[...new Set(rs.map((r) => r.status))]} delta=${after - before} single=${single} awarded=${awarded}`);
  const list = await call('GET', `/api/quizzes/${lang.slug}`, { token: t });
  const attempts = list.json?.quizzes?.find((q) => q.slug === quiz.slug)?.best?.attempts;
  check('attempts are counted exactly (no lost updates)', attempts === 10, `attempts=${attempts}`);
}

// 4) Kharab input: koi 5xx nahi
{
  const bad = ['%00', '..%2f..%2fetc%2fpasswd', '%E0%A4%A', 'a'.repeat(5000), '{"$ne":1}', '😀', '__proto__', 'constructor'];
  const paths = [];
  for (const b of bad) {
    paths.push(['GET', `/api/languages/${b}`], ['GET', `/api/languages/${lang.slug}/topics/${b}`], ['GET', `/api/quizzes/${b}`], ['GET', `/api/quizzes/${lang.slug}/${b}`], ['GET', `/api/progress/${b}`], ['GET', `/api/certificates/verify/${b}`], ['GET', `/api/certificates/${b}/pdf`], ['GET', `/api/videos/${b}/stream`], ['GET', `/api/search?q=${b}`]);
  }
  let crashes = 0;
  for (const [m, p] of paths) {
    const r = await call(m, p, { token: who });
    if (r.status >= 500) { crashes += 1; check(`${m} ${p.slice(0, 70)} does not crash`, false, `status ${r.status}`); }
  }
  check(`${paths.length} requests with hostile path/query values: no server error`, crashes === 0, `${crashes} crashed`);
  const admins = ['/api/admin/students/not-an-id', '/api/admin/students/' + '0'.repeat(24), '/api/admin/students?search=' + encodeURIComponent('{"$ne":1}'), '/api/admin/students?page=-5&limit=999999', '/api/admin/students?role[$ne]=x', '/api/admin/students?sort=__proto__'];
  for (const p of admins) {
    const r = await call('GET', p, { token: admin });
    check(`admin ${p.slice(0, 60)} gives a clean answer (${r.status})`, r.status < 500, `status ${r.status}`);
  }
}

// 5) Kharab body: NoSQL operators, galat type, bara body, toota hua JSON
{
  const cases = [
    ['POST', '/api/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } }, [400]],
    ['POST', '/api/auth/login', { body: { email: ['a@b.com'], password: 'x' } }, [400]],
    ['POST', '/api/auth/login', { raw: '{"email": ', headers: { 'Content-Type': 'application/json' } }, [400]],
    ['POST', '/api/auth/login', { raw: 'email=a&password=b', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, [400]],
    ['POST', '/api/auth/register', { body: { name: 'x'.repeat(10000), email: 'a@b.com', password: 'Password#12345' } }, [400, 413]],
    ['POST', '/api/auth/forgot-password', { body: { email: { $gt: '' } } }, [400]],
    ['POST', '/api/auth/reset-password', { body: { email: 'a@b.com', otp: { $ne: 1 }, password: 'Password#12345' } }, [400]],
    ['PATCH', '/api/auth/profile', { token: who, body: { name: { $set: 1 } } }, [400]],
    ['PATCH', '/api/auth/profile', { token: who, body: { avatar: 'data:image/png;base64,' + 'A'.repeat(200000) } }, [400, 413]],
    ['PUT', `/api/progress/${lang.slug}/last`, { token: who, body: { topic: { $ne: 1 } } }, [400]],
    ['PUT', `/api/progress/${lang.slug}/topics/${lang.topics[0]}/drafts/0`, { token: who, body: { code: 'x'.repeat(70000) } }, [400, 413]],
    ['POST', `/api/quizzes/${lang.slug}/${lang.quizzes[0].slug}/submit`, { token: who, body: { answers: { a: { $ne: 1 } } } }, [400]],
    ['POST', `/api/quizzes/${lang.slug}/${lang.quizzes[0].slug}/submit`, { token: who, body: { answers: 'nope' } }, [400]],
    ['POST', '/api/admin/email', { token: admin, body: { userIds: ['x'], subject: 'hi there', message: 'hello' } }, [400]],
    ['POST', '/api/admin/nudges/send', { token: admin, body: { group: { $ne: 1 } } }, [400]],
  ];
  for (const [m, p, opts, ok] of cases) {
    const r = await call(m, p, opts);
    check(`${m} ${p.slice(0, 55)} with bad body -> ${ok.join('/')} (got ${r.status})`, ok.includes(r.status), `status ${r.status} ${r.text.slice(0, 80)}`);
  }
}

// 6) Login/token
{
  const noneAlg = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: '000000000000000000000001', role: 'admin' })).toString('base64url')}.`;
  for (const [name, tk] of [['garbage token', 'abc'], ['alg=none admin token', noneAlg], ['empty token', '']]) {
    const r = await call('GET', '/api/admin/stats', { token: tk || undefined });
    check(`${name} is refused (401)`, r.status === 401, `status ${r.status}`);
  }
  const r = await call('GET', '/api/admin/stats', { token: who });
  check('a student cannot open admin pages (403)', r.status === 403, `status ${r.status}`);
  const nm = await call('POST', '/api/auth/login', { body: { email: 'nobody@nowhere.test', password: 'Password#12345' } });
  const wp = await call('POST', '/api/auth/login', { body: { email: students[3].email, password: 'WrongPassword#1' } });
  check('wrong email and wrong password give the same message (no account guessing)', nm.status === 401 && wp.status === 401 && nm.json?.message === wp.json?.message, `${nm.status}/${wp.status}`);
  const fp1 = await call('POST', '/api/auth/forgot-password', { body: { email: 'nobody@nowhere.test' } });
  const fp2 = await call('POST', '/api/auth/forgot-password', { body: { email: students[4].email } });
  check('forgot-password answers the same for known and unknown emails', fp1.status === 200 && fp2.status === 200 && fp1.json?.message === fp2.json?.message);
}

// 7) Headers aur CORS
{
  const r = await call('GET', '/api/health');
  check('security headers are set and x-powered-by is hidden', !r.headers.get('x-powered-by') && r.headers.get('x-content-type-options') === 'nosniff', JSON.stringify([...r.headers.keys()]));
  const evil = await fetch(BASE + '/api/health', { headers: { Origin: 'https://evil.example' } });
  check('CORS does not allow a foreign website', evil.headers.get('access-control-allow-origin') !== 'https://evil.example');
  const nf = await call('GET', '/api/nope');
  check('unknown route gives JSON 404', nf.status === 404 && nf.json?.message);
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
