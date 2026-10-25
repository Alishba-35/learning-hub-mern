import mongoose from 'mongoose';

// Ek user ka ek quiz par record: sab se behtar score, aakhri score, kitni koshishen
const quizResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    languageSlug: { type: String, required: true },
    quizSlug: { type: String, required: true },
    bestScore: { type: Number, default: 0 },
    lastScore: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    lastAt: { type: Date },
  },
  { timestamps: true }
);

quizResultSchema.index({ user: 1, languageSlug: 1, quizSlug: 1 }, { unique: true });

export default mongoose.model('QuizResult', quizResultSchema);
