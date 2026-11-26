// Spike test: achanak bohat zyada log (jaise class mein sab ne ek saath link khola), phir wapas kam.
//   k6 run loadtest/spike.js
import { studentJourney, baseThresholds } from './lib.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '10s', target: Number(__ENV.PEAK || 300) }, // achanak
    { duration: '1m', target: Number(__ENV.PEAK || 300) },
    { duration: '10s', target: 10 },
    { duration: '1m', target: 10 }, // recovery
  ],
  thresholds: { ...baseThresholds, http_req_duration: ['p(95)<3000'] },
};
export default studentJourney;
