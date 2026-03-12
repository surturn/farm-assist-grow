import { Router } from 'express';
import { getAllDiseases } from '../controllers/disease.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getAllDiseases);

export default router;
