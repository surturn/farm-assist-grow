import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getNotifications);
router.put('/:id/read', requireAuth, markAsRead);
router.post('/mark-all-read', requireAuth, markAllAsRead);

export default router;
