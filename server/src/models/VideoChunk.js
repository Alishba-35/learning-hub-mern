import mongoose from 'mongoose';

// Upload ki hui video ka ek tukda (2 MB tak). Poori file in tukdon ko index ke order mein jor kar banti hai.
// Tukde isliye ke ek Mongo document 16 MB se bara nahi ho sakta, aur proxy badi requests rok dete hain.
const videoChunkSchema = new mongoose.Schema({
  video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  index: { type: Number, required: true, min: 0 },
  data: { type: Buffer, required: true },
});

videoChunkSchema.index({ video: 1, index: 1 }, { unique: true });

export default mongoose.model('VideoChunk', videoChunkSchema);
