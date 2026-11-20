import mongoose from 'mongoose';

// Har sawal par: kitne students ne pehli koshish mein jawab diya (asked) aur kitno ne ghalat (wrong).
// Sirf pehli koshish gini jati hai, taake dobara dene walon se sawal asaan ya mushkil na dikhe.
const questionStatSchema = new mongoose.Schema(
  {
    languageSlug: { type: String, required: true },
    quizSlug: { type: String, required: true },
    questionId: { type: String, required: true },
    asked: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
  },
  { timestamps: true }
);

questionStatSchema.index({ languageSlug: 1, quizSlug: 1, questionId: 1 }, { unique: true });

export default mongoose.model('QuestionStat', questionStatSchema);
