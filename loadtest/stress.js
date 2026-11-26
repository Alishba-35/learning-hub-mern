// Stress test: bojh barhate jao jab tak server toot na jaye. Maqsad: breaking point aur toot'te waqt behaviour dekhna.
// Sochne ka waqt 0 hai, is liye har VU asli student se bohat zyada bojh dalta hai.
//   k6 run loadtest/stress.js          (MAX=400 se upar tak jane ke liye MAX=800)
import { studentJourney, baseThresholds } from './lib.js';

const MAX = Number(__ENV.MAX || 400);
const STEP = __ENV.STEP || '1m'; // har seedhi ka waqt
export const options = {
  stages: [
    { duration: STEP, target: Math.round(MAX * 0.25) },
    { duration: STEP, target: Math.round(MAX * 0.5) },
    { duration: STEP, target: Math.round(MAX * 0.75) },
    { duration: STEP, target: MAX },
    { duration: STEP, target: MAX }, // is bojh par qayam
    { duration: STEP, target: 0 }, // recovery: bojh hatne ke baad server theek hota hai ya nahi
  ],
  thresholds: { ...baseThresholds, http_req_duration: ['p(95)<2000'] },
};
export default function () {
  studentJourney();
}
