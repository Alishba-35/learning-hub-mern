// Load test: aam din ka bojh. 5 minute mein 100 students tak, phir kuch der qayam.
//   k6 run loadtest/load.js            (VUS=100 DURATION=5m se badal sakte hain)
import { studentJourney, baseThresholds } from './lib.js';

const VUS = Number(__ENV.VUS || 100);
const HOLD = __ENV.DURATION || '5m';

export const options = {
  stages: [
    { duration: '1m', target: VUS }, // dheere dheere barhao
    { duration: HOLD, target: VUS }, // qayam
    { duration: '30s', target: 0 }, // utaro
  ],
  thresholds: { ...baseThresholds, http_req_duration: ['p(95)<500', 'p(99)<1500'] },
};

export default studentJourney;
