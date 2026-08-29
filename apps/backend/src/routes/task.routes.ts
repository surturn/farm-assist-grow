import { Router } from 'express';
import { getTasks, createTask, updateTaskStatus } from '../controllers/task.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getTasks);
router.post('/', createTask);
router.patch('/:id', updateTaskStatus);

export default router;
