import { Router } from 'express';
import { getFarms, createFarm } from '../controllers/farm.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Apply rate limiting and auth to all farm routes
router.use(requireAuth);
router.use(rateLimiter({ windowSeconds: 60, maxRequests: 100 }));

router.get('/', getFarms);
router.post('/', createFarm);

export default router;
