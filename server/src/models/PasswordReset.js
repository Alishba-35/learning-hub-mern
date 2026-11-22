import mongoose from 'mongoose';

// Password reset ka OTP: har user ka sirf ek (naya bhejne par purana badal jata hai). OTP khud nahi, sirf uska hash rakha jata hai.
const passwordResetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 }, // galat koshishein
  sentAt: { type: Date, default: Date.now }, // dobara bhejne ke beech ka waqt (cooldown)
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // MongoDB khud mita deta hai
});

export default mongoose.model('PasswordReset', passwordResetSchema);
