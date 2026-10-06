import { Router } from 'express';
import { getScans, createScan, verifyScan } from '../controllers/scan.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

router.get('/', requireAuth, getScans);
// Each POST is a paid model call; same budget /crops/analyze had.
router.post('/', requireAuth, rateLimiter({ windowSeconds: 3600, maxRequests: 20 }), createScan);
router.patch('/:id/verify', requireAuth, verifyScan);

export default router;
