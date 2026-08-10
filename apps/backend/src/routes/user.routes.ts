import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadAvatar, updateProfile } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Configure multer for memory storage and size limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB strict limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow specific web image formats
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// PATCH /api/v1/users/profile
router.patch('/profile', requireAuth, updateProfile);

// POST /api/v1/users/avatar
// Wrap multer in error handler so file size/type errors return 400 instead of 500
router.post('/avatar', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  upload.single('avatar')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific error (e.g. file too large)
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // Custom filter error (e.g. invalid file type)
      return res.status(400).json({ error: err.message });
    }
    // No multer error, proceed to controller
    uploadAvatar(req, res);
  });
});

export default router;
