// Scalability test: bojh ki seedhi (25 -> 50 -> 100 -> 200 VUs), har seedhi 1 minute. Dekhte hain ke users double karne par
// throughput (requests/sec) kitna barhta hai aur response time kitna. Achi scalability: throughput lagbhag double, latency lagbhag wahi.
//   k6 run loadtest/scalability.js
import { studentJourney } from './lib.js';

const steps = [25, 50, 100, 200];
export const options = {
  scenarios: Object.fromEntries(
    steps.map((n, i) => [`vus_${n}`, { executor: 'constant-vus', vus: n, duration: '1m', startTime: `${i * 70}s`, tags: { step: `${n}vu` }, exec: 'journey' }])
  ),
  thresholds: Object.fromEntries(steps.flatMap((n) => [[`http_req_duration{step:${n}vu}`, ['p(95)<5000']], [`http_reqs{step:${n}vu}`, ['count>=0']], [`http_req_failed{step:${n}vu}`, ['rate<0.05']]])),
};
export function journey() {
  studentJourney();
}
