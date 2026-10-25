import mongoose from 'mongoose';

// Ek lesson chhote "blocks" ka silsila hai:
//   html       -> text, tables, images (client par sanitize hota hai)
//   demo       -> code + pehle se likha hua output (C++ "Run demo")
//   playground -> code jo user browser mein edit karke chala sakta hai (JavaScript)
const blockSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['html', 'demo', 'playground'], required: true },
    html: String,
    code: String,
    output: String,
    language: String,
  },
  { _id: false }
);

const topicSchema = new mongoose.Schema(
  {
    languageSlug: { type: String, required: true, lowercase: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    section: { type: String, default: '', trim: true }, // sidebar mein group ka naam (jaise "Fundamentals")
    order: { type: Number, required: true },
    blocks: { type: [blockSchema], default: [] },
    styles: { type: String, default: '' }, // lesson ke demos ki scoped CSS
  },
  { timestamps: true }
);

topicSchema.index({ languageSlug: 1, slug: 1 }, { unique: true });
topicSchema.index({ languageSlug: 1, order: 1 });

export default mongoose.model('Topic', topicSchema);
