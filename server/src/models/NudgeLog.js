import mongoose from 'mongoose';

// Kis student ko kab nudge email gayi: taake kisi ko hafte mein ek se zyada na jaye (ek click ho ya automatic).
const nudgeLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  group: { type: String, enum: ['inactive', 'neverStarted', 'streakBroken'], required: true },
  auto: { type: Boolean, default: false }, // true = roz wali automatic email
  sentAt: { type: Date, default: Date.now, index: { expireAfterSeconds: 60 * 24 * 3600 } }, // 60 din baad khud mit jati hai
});

export default mongoose.model('NudgeLog', nudgeLogSchema);
