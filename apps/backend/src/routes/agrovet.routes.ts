import { Router } from 'express';
import { getAgrovets, searchProducts } from '../controllers/agrovet.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

// GET /api/v1/agrovets
router.get('/', getAgrovets);

// GET /api/v1/agrovets/products/search?query=...
router.get('/products/search', searchProducts);

export default router;
