import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { completeSchema, draftSchema, lastSchema } from '../validators/progressSchemas.js';
import {
  complete,
  getLanguageProgress,
  getOverview,
  markLast,
  saveDraft,
} from '../controllers/progressController.js';

// Har user ki apni limit (shared lab wifi par ek IP ke bohat students hote hain)
const writeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down' },
});

const router = Router();
router.use(requireAuth);
router.get('/', getOverview);
router.get('/:slug', getLanguageProgress);
router.put('/:slug/last', writeLimiter, validate(lastSchema), markLast);
router.post('/:slug/topics/:topic/complete', writeLimiter, validate(completeSchema), complete);
router.put('/:slug/topics/:topic/drafts/:index', writeLimiter, validate(draftSchema), saveDraft);

export default router;
