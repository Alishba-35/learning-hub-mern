import { env } from '../config/env.js';

export const notFound = (req, res) => res.status(404).json({ message: 'Route not found' });

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.code === 11000) {
    const message = err.keyPattern?.email ? 'Email already registered' : 'Please try again';
    return res.status(409).json({ message });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const message = status < 500 || !env.isProd ? err.message : 'Something went wrong';
  res.status(status).json({ message });
}
