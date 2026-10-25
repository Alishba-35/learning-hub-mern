import mongoose from 'mongoose';

const userStatsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    xp: { type: Number, default: 0, min: 0 },
    streak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastActiveDay: { type: String, default: '' }, // "YYYY-MM-DD"
  },
  { timestamps: true }
);

export default mongoose.model('UserStats', userStatsSchema);
