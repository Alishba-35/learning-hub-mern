import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createVideoSchema, startUploadSchema } from '../validators/videoSchemas.js';
import { CHUNK_SIZE } from '../utils/video.js';
import {
  approveVideo,
  completeUpload,
  createVideo,
  getConfig,
  listMine,
  listPending,
  listVideos,
  putChunk,
  removeVideo,
  startUpload,
  streamVideo,
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

// Video chalane ke liye signed link hi kaafi hai (<video> tag login header nahi bhej sakta), is liye ye auth se pehle hai
router.get('/:id/stream', streamVideo);

router.use(requireAuth);
router.get('/config', getConfig);
router.get('/mine', listMine);
router.get('/pending', requireRole('teacher', 'admin'), listPending);
router.get('/', listVideos);
router.post('/', perUser(15, 'You are adding videos too fast, try again later'), validate(createVideoSchema), createVideo);

router.post('/uploads', perUser(15, 'Too many uploads, try again later'), validate(startUploadSchema), startUpload);
router.put(
  '/uploads/:id/:index',
  perUser(1500, 'Too many upload parts, try again later'),
  express.raw({ type: () => true, limit: CHUNK_SIZE }),
  putChunk
);
router.post('/uploads/:id/complete', completeUpload);

router.patch('/:id/approve', requireRole('teacher', 'admin'), approveVideo);
router.delete('/:id', removeVideo);

export default router;
