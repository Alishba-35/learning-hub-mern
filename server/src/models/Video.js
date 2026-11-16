import mongoose from 'mongoose';

// Short Study ka ek video: ya to YouTube link (youtubeId) ya Cloudinary par upload ki hui file (fileUrl + publicId).
const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    languageSlug: { type: String, trim: true, lowercase: true, default: '' }, // khali = general
    source: { type: String, enum: ['youtube', 'upload'], required: true },
    youtubeId: { type: String },
    fileUrl: { type: String },
    publicId: { type: String },
    // Teacher/admin ka video foran "approved"; student ka "pending" jab tak teacher approve na kare
    status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
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
