import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getLanguage, getTopic } from '../controllers/lessonController.js';

const router = Router();
router.use(requireAuth);
router.get('/:slug', getLanguage);
router.get('/:slug/topics/:topic', getTopic);

export default router;
