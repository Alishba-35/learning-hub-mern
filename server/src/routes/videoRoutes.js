import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createVideoSchema } from '../validators/videoSchemas.js';
import {
  approveVideo,
  createUploadSignature,
  createVideo,
  getConfig,
  listMine,
  listPending,
  listVideos,
  removeVideo,
} from '../controllers/videoController.js';

const perUser = (limit, message) =>
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit,
    keyGenerator: (req) => req.user.id,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message },
  });

const router = Router();
router.use(requireAuth);
router.get('/config', getConfig);
router.get('/mine', listMine);
router.get('/pending', requireRole('teacher', 'admin'), listPending);
router.get('/', listVideos);
router.post('/upload-signature', perUser(20, 'Too many uploads, try again later'), createUploadSignature);
router.post('/', perUser(15, 'You are adding videos too fast, try again later'), validate(createVideoSchema), createVideo);
router.patch('/:id/approve', requireRole('teacher', 'admin'), approveVideo);
router.delete('/:id', removeVideo);

export default router;
