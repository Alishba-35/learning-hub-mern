import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import RefreshToken from '../models/RefreshToken.js';

export const REFRESH_COOKIE = 'refreshToken';
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 din
const SESSION_MS = 24 * 60 * 60 * 1000; // 1 din (remember na ho to)

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

const cookieBase = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
  path: '/api/auth',
};

export const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn: '15m' });

export async function startRefreshSession(res, userId, remember) {
  const token = crypto.randomBytes(48).toString('hex');
  const ms = remember ? REMEMBER_MS : SESSION_MS;
  await RefreshToken.create({
    user: userId,
    tokenHash: hash(token),
    remember,
    expiresAt: new Date(Date.now() + ms),
  });
  // remember false ho to maxAge nahi: browser band hote hi cookie khatam
  res.cookie(REFRESH_COOKIE, token, remember ? { ...cookieBase, maxAge: ms } : cookieBase);
}

export const findRefreshToken = (token) => RefreshToken.findOne({ tokenHash: hash(token) });
export const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, cookieBase);
