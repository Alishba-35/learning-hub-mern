import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
    purpose: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return { id: this.id, name: this.name, email: this.email, role: this.role, purpose: this.purpose };
};

export default mongoose.model('User', userSchema);
