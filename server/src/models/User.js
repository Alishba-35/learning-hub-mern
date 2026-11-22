import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
    purpose: { type: String, trim: true, maxlength: 200, default: '' },
    // Profile photo: chhoti (256px) tasveer data URL ki shakal mein. select:false, taake lists mein bhari tasveerein na aayen; sirf login/me mein '+avatar' se aati hai
    avatar: { type: String, default: '', select: false, maxlength: 130000 },
    // Admin kisi account ko suspend kar sakta hai: login aur session refresh dono band
    disabled: { type: Boolean, default: false },
    disabledReason: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return { id: this.id, name: this.name, email: this.email, role: this.role, purpose: this.purpose, avatar: this.avatar || '' };
};

export default mongoose.model('User', userSchema);
