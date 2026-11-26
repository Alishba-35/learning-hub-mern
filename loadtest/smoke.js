// Smoke test: 1 student, 1 baar. Dekhta hai ke sab kuch chal raha hai (load se pehle yahi chalayein).
//   k6 run loadtest/smoke.js
import http from 'k6/http';
import { check } from 'k6';
import { BASE, studentJourney, admin, failures } from './lib.js';

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: { failures: ['rate==0'], http_req_duration: ['p(95)<800'] },
};

export default function () {
  const health = http.get(`${BASE}/api/health`);
  check(health, { 'health is ok': (r) => r.status === 200 && r.json('status') === 'ok' });
  studentJourney();
  // admin ke bhari raaste (insights sab students par chalta hai)
  const h = { headers: { Authorization: `Bearer ${admin[0].token}` } };
  for (const path of ['/api/admin/insights', '/api/admin/students', '/api/admin/stats']) {
    const r = http.get(`${BASE}${path}`, { ...h, tags: { name: path } });
    failures.add(!check(r, { [`${path} is 200`]: (x) => x.status === 200 }));
  }
}
