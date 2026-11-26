import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema } from '../validators/authSchemas.js';
import { register, login, refresh, logout, me, forgotPassword, resetPassword, updateProfile } from '../controllers/authController.js';

const tooMany = { message: 'Too many attempts, please try again later' };
const common = { windowMs: 15 * 60 * 1000, standardHeaders: 'draft-7', legacyHeaders: false, message: tooMany };

// Login ki hadd IP + email ke joray par hai, sirf IP par nahi. College/lab ke WiFi par poori class ka ek hi public IP hota hai:
// pehle 20 logins/15 min per IP ka matlab tha ke 21wan student (aur baqi sab) 15 minute ke liye bahar. Ab har account ko 10 koshishein
// (ghalat password andaza lagane se bachao), aur poore IP par ek bari hadd (bots/mass attack ke liye).
const emailOf = (req) => String(req.body?.email ?? '').trim().toLowerCase().slice(0, 254);
const loginPerAccount = rateLimit({ ...common, limit: 10, keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${emailOf(req)}` });
const loginPerIp = rateLimit({ ...common, limit: 300, keyGenerator: (req) => ipKeyGenerator(req.ip) });
// Naye account: ek lab mein poori class ek saath sign up kar sakti hai
const registerLimiter = rateLimit({ ...common, limit: 60, keyGenerator: (req) => ipKeyGenerator(req.ip) });

// OTP wale raaste zyada sakht: email bhejna aur OTP andaza lagana dono rokne ke liye
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in a few minutes' },
});

const router = Router();
router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginPerIp, loginPerAccount, validate(loginSchema), login);
router.post('/forgot-password', resetLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', resetLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.patch('/profile', requireAuth, validate(updateProfileSchema), updateProfile);

export default router;
