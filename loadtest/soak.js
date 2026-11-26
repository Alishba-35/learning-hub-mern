// Soak test: halka bojh lekin lamba waqt (memory leak, connections ka khatam hona, dheere dheere slow hona pakadne ke liye).
//   k6 run loadtest/soak.js            (DURATION=30m default)
import { studentJourney, baseThresholds } from './lib.js';

export const options = {
  stages: [
    { duration: '1m', target: Number(__ENV.VUS || 30) },
    { duration: __ENV.DURATION || '30m', target: Number(__ENV.VUS || 30) },
    { duration: '30s', target: 0 },
  ],
  thresholds: { ...baseThresholds, http_req_duration: ['p(95)<600'] },
};
export default studentJourney;
