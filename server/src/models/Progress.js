import mongoose from 'mongoose';

// Ek user ka ek language mein progress: kaun se lessons mukammal, aakhri lesson, aur code ke drafts.
const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    languageSlug: { type: String, required: true },
    completed: { type: [String], default: [] },
    lastTopic: { type: String, default: '' },
    // key: "<topic>__<playgroundIndex>"  ->  { code, updatedAt }
    drafts: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

progressSchema.index({ user: 1, languageSlug: 1 }, { unique: true });

export default mongoose.model('Progress', progressSchema);
