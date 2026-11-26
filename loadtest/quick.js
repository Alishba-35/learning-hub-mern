// Quick test: ek fixed bojh par chhota sa test (default 50 VUs, 30 second). Code badalne ke baad "pehle/baad" compare karne ke liye.
//   k6 run -e VUS=100 -e THINK=0 loadtest/quick.js
import { studentJourney, baseThresholds } from './lib.js';

export const options = { vus: Number(__ENV.VUS || 50), duration: __ENV.DURATION || '30s', thresholds: baseThresholds };
export default studentJourney;
