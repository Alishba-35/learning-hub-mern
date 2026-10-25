import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { search } from '../controllers/searchController.js';

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many searches, please slow down' },
});

const router = Router();
router.use(requireAuth);
router.get('/', limiter, search);
export default router;
