import { Router } from 'express';
import { getFarmNotes, createFarmNote } from '../controllers/farmNote.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

router.use(requireAuth);
router.use(rateLimiter({ windowSeconds: 60, maxRequests: 100 }));

router.get('/', getFarmNotes);
router.post('/', createFarmNote);

export default router;
