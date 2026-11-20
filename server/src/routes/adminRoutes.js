import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { announcementSchema, roleSchema, suspensionSchema, videoStatusSchema } from '../validators/adminSchemas.js';
import { deleteStudent, exportStudents, getStats, getStudent, listStudents, listVideos, setRole, setSuspension, setVideoStatus } from '../controllers/adminController.js';
import { create as createAnnouncement, listAll as listAnnouncements, remove as removeAnnouncement } from '../controllers/announcementController.js';
import { getInsights } from '../controllers/insightsController.js';
import { removeVideo } from '../controllers/videoController.js';

// Sirf admin. Role token se aata hai, lekin har request par server hi check karta hai (frontend par bharosa nahi).
const router = Router();
router.use(requireAuth, requireRole('admin'));
router.get('/stats', getStats);
router.get('/insights', getInsights);
router.get('/students', listStudents);
router.get('/students/export.csv', exportStudents); // /:id se pehle, warna "export.csv" id ban jata
router.get('/students/:id', getStudent);
router.patch('/students/:id/suspension', validate(suspensionSchema), setSuspension);
router.patch('/students/:id/role', validate(roleSchema), setRole);
router.delete('/students/:id', deleteStudent);
router.get('/announcements', listAnnouncements);
router.post('/announcements', validate(announcementSchema), createAnnouncement);
router.delete('/announcements/:id', removeAnnouncement);
router.get('/videos', listVideos);
router.patch('/videos/:id/status', validate(videoStatusSchema), setVideoStatus);
router.delete('/videos/:id', removeVideo);

export default router;
