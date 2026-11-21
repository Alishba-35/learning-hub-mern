import mongoose from 'mongoose';

// Ek student ko ek language ka ek hi certificate. "code" public hai (verify link mein), is liye lamba aur random.
const certificateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    languageSlug: { type: String, required: true },
    languageName: { type: String, required: true },
    studentName: { type: String, required: true }, // jari karte waqt ka naam (baad mein naam badle to bhi certificate wahi rahe)
    code: { type: String, required: true, unique: true },
    lessonCount: { type: Number, default: 0 },
    issuedAt: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

certificateSchema.index({ user: 1, languageSlug: 1 }, { unique: true });

export default mongoose.model('Certificate', certificateSchema);
