import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import {
  signAccessToken,
  startRefreshSession,
  findRefreshToken,
  clearRefreshCookie,
  REFRESH_COOKIE,
} from '../utils/tokens.js';

// Jab email exist hi na kare, tab bhi same time lagay (timing attack se bachao)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

async function respondWithSession(res, user, remember, status = 200) {
  await startRefreshSession(res, user.id, remember);
  res.status(status).json({ user: user.toSafeJSON(), accessToken: signAccessToken(user) });
}

export async function register(req, res) {
  const { name, email, password, purpose, remember } = req.body;
  if (await User.exists({ email })) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  // role hamesha 'student'. Teacher account admin banata hai (self-signup nahi)
  const user = await User.create({ name, email, passwordHash, purpose });
  await respondWithSession(res, user, remember, 201);
}

export async function login(req, res) {
  const { email, password, remember } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) {
    return res.status(401).json({ message: 'Invalid email or password' });
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
  const user = await User.findById(stored.user);
  await stored.deleteOne(); // purana token ek hi baar chalta hai (rotation)
  if (!user) {
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
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user: user.toSafeJSON() });
}
