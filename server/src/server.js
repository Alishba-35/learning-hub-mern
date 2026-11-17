import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { ensureSeeded } from './seed/seedData.js';

try {
  await connectDB();
  // Lessons kam hon to khud daal deta hai (band karne ke liye AUTO_SEED=false). Fail ho to server phir bhi chalta hai.
  if (env.autoSeed) await ensureSeeded(console.log).catch((err) => console.error('Auto-seed failed:', err.message));
  app.listen(env.port, () => console.log(`API running on http://localhost:${env.port}`));
} catch (err) {
  console.error('Failed to start server:', err.message);
  process.exit(1);
}
