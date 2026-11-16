// Kisi user ko teacher/admin banata hai:  npm run role -- user@example.com teacher
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

const [email, role] = process.argv.slice(2);
if (!email || !['student', 'teacher', 'admin'].includes(role)) {
  console.error('Usage: npm run role -- <email> <student|teacher|admin>');
  process.exit(1);
}

try {
  await connectDB();
  const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase() }, { $set: { role } }, { returnDocument: 'after' });
  console.log(user ? `${user.email} is now ${user.role}` : `No user with email ${email}`);
  if (!user) process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
