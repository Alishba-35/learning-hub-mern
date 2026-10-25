import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { submitSchema } from '../validators/quizSchemas.js';
import { getQuiz, listQuizzes, submitQuiz } from '../controllers/quizController.js';

const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many quiz submissions, please slow down' },
});

const router = Router();
router.use(requireAuth);
router.get('/:slug', listQuizzes);
router.get('/:slug/:quizSlug', getQuiz);
router.post('/:slug/:quizSlug/submit', submitLimiter, validate(submitSchema), submitQuiz);

export default router;
