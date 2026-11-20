import mongoose from 'mongoose';

// Admin ka paigham: sab students ko (everyone) ya chune hue students ko (selected, jaise "reminder").
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    level: { type: String, enum: ['info', 'important'], default: 'info' },
    audience: { type: String, enum: ['everyone', 'selected'], default: 'everyone' },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ recipients: 1 });

export default mongoose.model('Announcement', announcementSchema);
