import mongoose from 'mongoose';

// Dashboard ke "Recent activity" aur XP chart ke liye: har lesson complete aur har quiz attempt ek entry.
const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['lesson', 'quiz'], required: true },
  languageSlug: { type: String, required: true },
  title: { type: String, required: true },
  detail: { type: String, default: '' },
  xp: { type: Number, default: 0 },
  day: { type: String, required: true }, // user ka din, "YYYY-MM-DD"
  at: { type: Date, default: Date.now },
});

activitySchema.index({ user: 1, day: 1 });
activitySchema.index({ user: 1, at: -1 });
activitySchema.index({ at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 din baad khud delete

export default mongoose.model('Activity', activitySchema);
