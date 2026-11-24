import mongoose from 'mongoose';

// Chhoti chhoti settings (key -> value), jaise automatic emails on/off
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} },
});

export default mongoose.model('Setting', settingSchema);
