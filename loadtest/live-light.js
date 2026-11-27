// Halka (light) load test: bina database seed kiye, bina login ke. Seedha apni LIVE site par chal sakta hai.
// Sirf public cheezein naapta hai: website ka pehla page, API ki health, aur login ka jawab. 20 users tak, 1 minute.
//
//   Windows PowerShell:
//   k6 run -e SITE_URL=https://learning-hub-lilac-theta.vercel.app -e API_URL=https://learning-hub-mern.vercel.app loadtest/live-light.js
//
// Zyada bojh mat dalein: free plans (Vercel, Atlas) ki hadein hoti hain. MAX=20 se upar na jayein.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const SITE = (__ENV.SITE_URL || '').replace(/\/+$/, '');
const API = (__ENV.API_URL || __ENV.BASE_URL || 'http://localhost:5055').replace(/\/+$/, '');
const MAX = Math.min(Number(__ENV.MAX || 20), 50);

const failures = new Rate('failures');
const rateLimited = new Counter('rate_limited'); // 429: server ka bachao, ghalti nahi

export const options = {
  stages: [
    { duration: '15s', target: Math.ceil(MAX / 2) },
    { duration: '30s', target: MAX },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    failures: ['rate<0.02'],
    http_req_duration: ['p(95)<1500'],
  },
};

function ok(res, name, expected) {
  if (res.status === 429) {
    rateLimited.add(1);
    return;
  }
  failures.add(!check(res, { [`${name} is ${expected.join('/')}`]: (r) => expected.includes(r.status) }));
}

export default function () {
  if (SITE) {
    group('website', () => {
      const home = http.get(`${SITE}/`, { tags: { name: 'home page' } });
      ok(home, 'home page', [200]);
      check(home, { 'home page has the title': (r) => r.body.includes('<title>Learning Hub') });
      ok(http.get(`${SITE}/login`, { tags: { name: 'login page' } }), 'login page', [200]);
      ok(http.get(`${SITE}/robots.txt`, { tags: { name: 'robots.txt' } }), 'robots.txt', [200]);
    });
  }
  group('api', () => {
    const health = http.get(`${API}/api/health`, { tags: { name: 'health' } });
    ok(health, 'health', [200]);
    // Login aur certificate-verify par server ki rate limit hoti hai (ek IP se bohat zyada requests rok di jati hain),
    // is liye inhein har 10wi baar bhejte hain; warna test zyada tar "429 Too many attempts" hi naapta.
    if (__ITER % 10 !== 0) return;
    // Galat password: 401 aana chahiye (server crash ya 500 nahi). Har VU ka alag email, taake ek account par limit na lage.
    const bad = http.post(`${API}/api/auth/login`, JSON.stringify({ email: `nobody${__VU}@example.com`, password: 'WrongPassword#1' }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login (wrong password)' },
    });
    ok(bad, 'login with wrong password', [401, 400]);
    ok(http.get(`${API}/api/certificates/verify/LH-FAKE-0000-0000`, { tags: { name: 'verify fake certificate' } }), 'fake certificate', [404, 400]);
  });
  sleep(1);
}
