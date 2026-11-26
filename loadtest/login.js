// Login test: sign-in sab se mehnga kaam hai (password hashing). Alag se naapte hain.
//   k6 run loadtest/login.js
import http from 'k6/http';
import { check } from 'k6';
import { BASE, loginEmails, password, failures, rateLimited } from './lib.js';

export const options = {
  scenarios: { logins: { executor: 'ramping-arrival-rate', startRate: 1, timeUnit: '1s', preAllocatedVUs: 50, maxVUs: 200, stages: [{ target: 5, duration: '30s' }, { target: 10, duration: '30s' }, { target: 20, duration: '30s' }] } },
  thresholds: { failures: ['rate<0.01'], 'http_req_duration{name:login}': ['p(95)<1500'] },
};

export default function () {
  const email = loginEmails[(__ITER + __VU * 7) % loginEmails.length];
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.9.${__VU & 255}.${(__ITER % 250) + 1}` },
    tags: { name: 'login' },
  });
  if (res.status === 429) return rateLimited.add(1);
  failures.add(!check(res, { 'login is 200': (r) => r.status === 200 && !!r.json('accessToken') }));
}
