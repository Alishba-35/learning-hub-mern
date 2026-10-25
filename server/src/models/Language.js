import mongoose from 'mongoose';

const languageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#334155' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Language', languageSchema);
