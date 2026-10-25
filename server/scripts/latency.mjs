// Naapta hai: Atlas se kitni door hai aur bcrypt kitna time leta hai.
// Chalane ka tareeqa (server folder se):  node scripts/latency.mjs
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';

const ms = (start) => Math.round(performance.now() - start);

try {
  let t = performance.now();
  await mongoose.connect(env.mongoUri);
  console.log(`Atlas connect (pehli baar): ${ms(t)} ms`);

  const pings = [];
  for (let i = 0; i < 5; i++) {
    t = performance.now();
    await mongoose.connection.db.admin().ping();
    pings.push(ms(t));
  }
  console.log(`Atlas ping x5: ${pings.join(', ')} ms`);

  for (const cost of [10, 12]) {
    t = performance.now();
    await bcrypt.hash('Test@1234', cost);
    console.log(`bcrypt cost ${cost}: ${ms(t)} ms`);
  }
} catch (err) {
  console.log('Error:', err.message);
} finally {
  await mongoose.disconnect();
}
