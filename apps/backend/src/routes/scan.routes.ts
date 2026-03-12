import { Router } from 'express';
import { getScans, createScan } from '../controllers/scan.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getScans);
router.post('/', requireAuth, createScan);

export default router;
