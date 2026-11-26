// Load test ke liye tayyari:  node scripts/loadtestPrepare.js [users=200]
// - nakli students banata hai (loadtestN@loadtest.local) seedha database mein (har ek ka password ek hi hash)
// - har ke liye access token banata hai (3 ghante), aur lessons/quizzes ki list likhta hai
// Output: ../loadtest/data/users.json aur catalog.json (k6 scripts yahi parhte hain)
// Hifazat: sirf apne computer ke database par chalta hai. Asli (Atlas) database par load test mat karein.
import { mkdirSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import Language from '../src/models/Language.js';
import Quiz from '../src/models/Quiz.js';
import Topic from '../src/models/Topic.js';
import User from '../src/models/User.js';
import UserStats from '../src/models/UserStats.js';

const count = Math.min(Number(process.argv[2]) || 200, 5000);
const PASSWORD = 'LoadTest#12345';
const out = new URL('../../loadtest/data/', import.meta.url);

const local = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(env.mongoUri);
if (!local && !process.argv.includes('--allow-remote')) {
  console.error('Refusing to run: MONGO_URI is not a local database.\nLoad testing a shared/production database (Atlas) can fill it with fake users and hit its free-tier limits.\nUse a local MongoDB, or add --allow-remote if you are sure.');
  process.exit(1);
}

try {
  await connectDB();
  mkdirSync(out, { recursive: true });

  const old = await User.find({ email: /^loadtest\d+@loadtest\.local$/ }).select('_id').lean();
  if (old.length) {
    await UserStats.deleteMany({ user: { $in: old.map((u) => u._id) } });
    await User.deleteMany({ _id: { $in: old.map((u) => u._id) } });
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12); // production jaisa cost, ek hi baar
  const docs = Array.from({ length: count }, (_, i) => ({
    name: `Load Test ${i + 1}`,
    email: `loadtest${i + 1}@loadtest.local`,
    passwordHash,
    role: i === 0 ? 'admin' : 'student',
  }));
  const users = await User.insertMany(docs);
  const token = (u) => jwt.sign({ sub: u.id, role: u.role }, env.jwtAccessSecret, { expiresIn: '3h' });
  writeFileSync(new URL('users.json', out), JSON.stringify({ password: PASSWORD, users: users.map((u) => ({ email: u.email, role: u.role, token: token(u) })) }));

  const [languages, topics, quizzes] = await Promise.all([
    Language.find().sort('order').select('slug -_id').lean(),
    Topic.find().sort({ languageSlug: 1, order: 1 }).select('languageSlug slug -_id').lean(),
    Quiz.find().select('languageSlug slug questions.id -_id').lean(),
  ]);
  const catalog = languages.map((l) => ({
    slug: l.slug,
    topics: topics.filter((t) => t.languageSlug === l.slug).map((t) => t.slug),
    quizzes: quizzes.filter((q) => q.languageSlug === l.slug).map((q) => ({ slug: q.slug, questionIds: q.questions.map((x) => x.id) })),
  }));
  writeFileSync(new URL('catalog.json', out), JSON.stringify(catalog));
  console.log(`Ready: ${users.length} test users (1 admin), ${catalog.length} languages, ${topics.length} lessons.`);
} catch (err) {
  console.error('Prepare failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
