import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listMine } from '../controllers/announcementController.js';

// Student/teacher/admin: sirf apne announcements padh sakte hain
const router = Router();
router.get('/', requireAuth, listMine);

export default router;
