import { Router } from 'express';
import { getScans, createScan, verifyScan, answerScan } from '../controllers/scan.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

router.get('/', requireAuth, getScans);
// Each POST is a paid model call: 20 per user per hour.
router.post('/', requireAuth, rateLimiter({ windowSeconds: 3600, maxRequests: 20 }), createScan);
router.post('/:id/answer', requireAuth, answerScan);
router.patch('/:id/verify', requireAuth, verifyScan);

export default router;
