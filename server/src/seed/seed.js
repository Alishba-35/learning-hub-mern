// Lessons ko database mein daalta hai:  npm run seed
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { seedAll } from './seedData.js';

try {
  await connectDB();
  await seedAll(console.log);
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
