import crypto from 'crypto';
import { env } from '../config/env.js';
import PasswordReset from '../models/PasswordReset.js';
import RefreshToken from '../models/RefreshToken.js';
import User from '../models/User.js';
import { sendMail } from '../utils/mailer.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../utils/password.js';
import { otpEmail } from '../utils/mailTemplates.js';
import {
  signAccessToken,
  startRefreshSession,
  findRefreshToken,
  clearRefreshCookie,
  REFRESH_COOKIE,
} from '../utils/tokens.js';

async function respondWithSession(res, user, remember, status = 200) {
  await startRefreshSession(res, user.id, remember);
  res.status(status).json({ user: user.toSafeJSON(), accessToken: signAccessToken(user) });
}

export async function register(req, res) {
  const { name, email, password, purpose, remember } = req.body;
  if (await User.exists({ email })) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const passwordHash = await hashPassword(password);
  // role hamesha 'student'. Teacher account admin banata hai (self-signup nahi)
  const user = await User.create({ name, email, passwordHash, purpose });
  await respondWithSession(res, user, remember, 201);
}

export async function login(req, res) {
  const { email, password, remember } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +avatar');
  // Email na ho tab bhi hash ka waqt lagta hai (timing attack se bachao)
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyAgainstDummy(password);
  if (!user || !valid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  // Suspend ka message sirf sahi password wale ko milta hai (warna koi email se account ka haal na jaan sake)
  if (user.disabled) {
    return res.status(403).json({ message: 'This account has been suspended. Please contact your teacher or admin.' });
  }
  await respondWithSession(res, user, remember);
}

export async function refresh(req, res) {
  const token = req.cookies[REFRESH_COOKIE];
  const stored = token && (await findRefreshToken(token));
  if (!stored || stored.expiresAt < new Date()) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Session expired' });
  }
  const user = await User.findById(stored.user).select('+avatar');
  await stored.deleteOne(); // purana token ek hi baar chalta hai (rotation)
  if (!user || user.disabled) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Session expired' });
  }
  await respondWithSession(res, user, stored.remember);
}

export async function logout(req, res) {
  const token = req.cookies[REFRESH_COOKIE];
  const stored = token && (await findRefreshToken(token));
  if (stored) await stored.deleteOne();
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req, res) {
  const user = await User.findById(req.user.id).select('+avatar');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user: user.toSafeJSON() });
}

// ---------- Password reset (email par 6 digit OTP) ----------
const OTP_MINUTES = 10;
const RESEND_SECONDS = 60; // dobara bhejne se pehle itna intezar
const MAX_ATTEMPTS = 5; // itni galat koshishon ke baad OTP bekar

const otpHash = (userId, otp) => crypto.createHmac('sha256', env.jwtAccessSecret).update(`${userId}:${otp}`).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function forgotPassword(req, res) {
  // Jawab hamesha ek jaisa: koi email se yeh na jaan sake ke account hai ya nahi
  const reply = { message: `If this email is registered, we sent a 6-digit code to it. It is valid for ${OTP_MINUTES} minutes.`, resendSeconds: RESEND_SECONDS };
  const user = await User.findOne({ email: req.body.email });
  if (!user || user.disabled) return res.json(reply);

  const existing = await PasswordReset.findOne({ user: user._id });
  if (existing && Date.now() - new Date(existing.sentAt).getTime() < RESEND_SECONDS * 1000) return res.json(reply);

  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await PasswordReset.findOneAndUpdate(
    { user: user._id },
    { otpHash: otpHash(user.id, otp), attempts: 0, sentAt: new Date(), expiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000) },
    { upsert: true }
  );
  try {
    await sendMail({ to: user.email, ...otpEmail({ name: user.name, otp, minutes: OTP_MINUTES }) });
  } catch (err) {
    console.error('Could not send the password reset email:', err.message);
    await PasswordReset.deleteOne({ user: user._id });
  }
  res.json(reply);
}

export async function resetPassword(req, res) {
  const { email, otp, password } = req.body;
  const invalid = () => res.status(400).json({ message: 'That code is wrong or has expired. Please request a new one.' });

  const user = await User.findOne({ email });
  if (!user || user.disabled) return invalid();
  const record = await PasswordReset.findOne({ user: user._id });
  if (!record || new Date(record.expiresAt) < new Date()) return invalid();
  if (record.attempts >= MAX_ATTEMPTS) {
    await PasswordReset.deleteOne({ user: user._id });
    return invalid();
  }
  if (!sameHash(otpHash(user.id, otp), record.otpHash)) {
    await PasswordReset.updateOne({ user: user._id }, { $inc: { attempts: 1 } });
    return invalid();
  }

  await User.updateOne({ _id: user._id }, { passwordHash: await hashPassword(password) });
  await PasswordReset.deleteMany({ user: user._id });
  await RefreshToken.deleteMany({ user: user._id }); // purane sab login band
  res.json({ message: 'Password updated. Please log in with your new password.' });
}

// ---------- Profile: naam aur photo ----------
// Data URL ke andar asli tasveer ho (sirf naam "image/jpeg" likhne se kaam nahi chalega)
function looksLikeImage(dataUrl) {
  const b = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1, dataUrl.indexOf(',') + 33), 'base64');
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const webp = b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
  return jpeg || png || webp;
}

export async function updateProfile(req, res) {
  const { name, avatar } = req.body;
  const set = {};
  if (name !== undefined) set.name = name;
  if (avatar !== undefined) {
    if (avatar !== null && !looksLikeImage(avatar)) {
      return res.status(400).json({ message: 'Validation failed', errors: [{ field: 'avatar', message: 'That file is not a valid image' }] });
    }
    set.avatar = avatar ?? '';
  }
  const user = await User.findByIdAndUpdate(req.user.id, { $set: set }, { new: true, runValidators: true }).select('+avatar');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user: user.toSafeJSON() });
}
