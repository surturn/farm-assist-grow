import { Router } from 'express';
import { analyzeCrop, getAnalysisStatus } from '../controllers/crop.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Rate limiting is heavier here to prevent API abuse
router.use(rateLimiter({ windowSeconds: 3600, maxRequests: 20 }));

// Only allow authenticated users to perform analysis
router.post('/analyze', requireAuth, analyzeCrop);
router.get('/analyze/:jobId', requireAuth, getAnalysisStatus);

export default router;
