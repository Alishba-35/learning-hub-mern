// "Login ke dauran baqi site chalti rehti hai?" Ek taraf har second kuch logins, doosri taraf 5 students jo lesson parh rahe hain.
// Dekhein: studentJourney ki response time (p95) login ke bojh mein. Achi baat: wo lagbhag wahi rehti hai jo bina login ke thi.
//   k6 run -e RATE=4 loadtest/login-blocking.js
import http from 'k6/http';
import { check } from 'k6';
import { BASE, loginEmails, password, studentJourney } from './lib.js';

export const options = {
  scenarios: {
    logins: { executor: 'constant-arrival-rate', rate: Number(__ENV.RATE || 4), timeUnit: '1s', duration: '40s', preAllocatedVUs: 60, maxVUs: 120, exec: 'doLogin' },
    students: { executor: 'constant-vus', vus: 5, duration: '40s', exec: 'doStudent', env: { THINK: '0.2' } },
  },
  thresholds: { 'http_req_duration{scenario:students}': ['p(95)<300'], 'http_req_duration{name:login}': ['p(95)<5000'] },
};

export function doLogin() {
  const email = loginEmails[(__ITER * 13 + __VU) % loginEmails.length];
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.8.${__VU & 255}.${(__ITER % 250) + 1}` },
    tags: { name: 'login' },
  });
  check(res, { 'login ok': (r) => r.status === 200 });
}
export function doStudent() {
  studentJourney();
}
