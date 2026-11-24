import crypto from 'crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { MailNotConfiguredError } from '../utils/mailer.js';
import { runAutoNudges } from '../utils/nudges.js';

const router = Router();

// Vercel Cron roz is raaste ko "Authorization: Bearer <CRON_SECRET>" ke saath chalata hai. Secret na ho ya ghalat ho to kuch nahi chalta.
function requireCron(req, res, next) {
  const sent = Buffer.from(req.get('authorization') || '');
  const want = Buffer.from(`Bearer ${env.cronSecret}`);
  if (!env.cronSecret || sent.length !== want.length || !crypto.timingSafeEqual(sent, want)) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

router.get('/nudges', requireCron, async (req, res) => {
  try {
    res.json(await runAutoNudges());
  } catch (err) {
    if (err instanceof MailNotConfiguredError) return res.status(503).json({ message: 'SMTP is not set up' });
    throw err;
  }
});

export default router;
