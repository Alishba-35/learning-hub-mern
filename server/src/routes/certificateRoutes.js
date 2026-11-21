import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { issue, listMine, pdf, verify } from '../controllers/certificateController.js';

const router = Router();

// Verify aur PDF public hain (koi bhi code se check kare), is liye IP par had: code andaze se na dhoonde ja sakein
const publicLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests, please try again soon' } });
const issueLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests, please try again soon' } });

router.get('/verify/:code', publicLimiter, verify);
router.get('/:code/pdf', publicLimiter, pdf);
router.get('/', requireAuth, listMine);
router.post('/:slug', requireAuth, issueLimiter, issue);

export default router;
