import { Router } from 'express';
import { getProductsForDisease } from '../controllers/product.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getProductsForDisease);

export default router;
