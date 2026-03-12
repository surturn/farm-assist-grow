import { Request, Response, NextFunction } from 'express';
import { authAdmin } from '@farmassist/firebase-admin';
import { prisma } from '@farmassist/database';

// Extend Express Request to include user details
declare global {
    namespace Express {
        interface Request {
            user?: {
                uid: string;
                email?: string;
                id?: string; // Prisma user ID
            };
        }
    }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
        }

        const idToken = authHeader.split('Bearer ')[1];

        // Verify Firebase token
        const decodedToken = await authAdmin.verifyIdToken(idToken);

        // Find associated user in DB
        const dbUser = await prisma.user.findUnique({
            where: { firebaseUid: decodedToken.uid }
        });

        // Attach to request context
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            id: dbUser?.id, // Useful for linking DB operations
        };

        next();
    } catch (error) {
        console.error('Auth verification failed:', error);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
