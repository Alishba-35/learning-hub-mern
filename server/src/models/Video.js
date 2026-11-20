import mongoose from 'mongoose';

// Short Study ka ek video: ya to YouTube link (youtubeId) ya upload ki hui file (tukde VideoChunk mein).
const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    languageSlug: { type: String, trim: true, lowercase: true, default: '' }, // khali = general
    source: { type: String, enum: ['youtube', 'upload'], required: true },
    youtubeId: { type: String },
    // Upload ki hui file (VideoChunk mein tukdon ki surat mein rakhi hoti hai)
    fileSize: { type: Number, min: 0 },
    mimeType: { type: String },
    chunkCount: { type: Number, min: 1 },
    // "uploading" = file abhi aa rahi hai (kisi ko nazar nahi aati). Teacher/admin ka video foran "approved",
    // student ka "pending" jab tak teacher approve na kare.
    // Admin kisi video ko "rejected" kar sakta hai (irrelevant content). Rejected video sirf uploader aur admin ko nazar aati hai.
    status: { type: String, enum: ['uploading', 'pending', 'approved', 'rejected'], default: 'pending' },
    rejectReason: { type: String, trim: true, maxlength: 200, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = starter video
    uploaderName: { type: String, default: 'Admin' },
  },
  { timestamps: true }
);

videoSchema.index({ status: 1, createdAt: -1 });
videoSchema.index({ languageSlug: 1, status: 1, createdAt: -1 });
videoSchema.index({ uploadedBy: 1, createdAt: -1 });
// Ek YouTube video do baar na aaye
videoSchema.index({ youtubeId: 1 }, { unique: true, partialFilterExpression: { youtubeId: { $type: 'string' } } });

export default mongoose.model('Video', videoSchema);
