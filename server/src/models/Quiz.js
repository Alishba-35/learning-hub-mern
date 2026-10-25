import mongoose from 'mongoose';

// type "choice": options + correctIndex (code ho to code-reading sawal)
// type "fill":   code mein "____" ki jagah likhne wala jawab, accepted answers ki list
const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['choice', 'fill'], required: true },
    prompt: { type: String, required: true },
    code: String,
    codeLanguage: String,
    options: [String],
    correctIndex: Number,
    answers: [String],
    caseSensitive: Boolean,
    explanation: { type: String, required: true },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    languageSlug: { type: String, required: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    section: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true }
);

quizSchema.index({ languageSlug: 1, slug: 1 }, { unique: true });

export default mongoose.model('Quiz', quizSchema);
