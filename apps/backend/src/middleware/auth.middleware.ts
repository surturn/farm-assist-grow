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

        const idToken = authHeader.split('Bearer ')[1]?.trim();
        if (!idToken) {
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

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

        if (!dbUser) {
            console.warn(`Authenticated Firebase User ${decodedToken.uid} missing from local PostgreSQL Database. Re-creating...`);
            const newUser = await prisma.user.create({
                data: {
                    firebaseUid: decodedToken.uid,
                    email: decodedToken.email || 'unknown@example.com',
                    displayName: decodedToken.name || 'Test User'
                }
            });
            req.user.id = newUser.id;
        }

        next();
    } catch (error) {
        console.error('Auth verification failed. Token validation rejected:', {
            message: error instanceof Error ? error.message : error,
            code: (error as any)?.code,
        });
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
