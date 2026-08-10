import { Request, Response, NextFunction } from 'express';
import { authAdmin } from '@farmassist/firebase-admin';
import { prisma } from '@farmassist/database';

// Extend Express Request to include unified user details
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string; // Firebase UID & Prisma User ID
                email?: string;
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
            where: { id: decodedToken.uid }
        });

        // Attach to request context
        req.user = {
            id: decodedToken.uid,
            email: decodedToken.email,
        };

        if (!dbUser) {
            console.warn(`Authenticated Firebase User ${decodedToken.uid} missing from local PostgreSQL Database. Re-creating...`);
            
            // Create user
            const newUser = await prisma.user.create({
                data: {
                    id: decodedToken.uid,
                    email: decodedToken.email || `${decodedToken.uid}@placeholder.email`,
                    firstName: decodedToken.name?.split(' ')[0] || 'New',
                    lastName: decodedToken.name?.split(' ').slice(1).join(' ') || 'Farmer',
                    phone: decodedToken.phone_number || null,
                }
            });

            // Automatically create a default Farm Tenant for them
            await prisma.tenant.create({
                data: {
                    name: 'My Personal Farm',
                    type: 'FARM',
                    members: {
                        create: {
                            userId: newUser.id,
                            role: 'OWNER'
                        }
                    },
                    farms: {
                        create: {
                            name: 'Main Field',
                            location: 'Kenya'
                        }
                    }
                }
            });
        }

        next();
    } catch (error) {
        const code = (error as any)?.code;
        console.error('Auth verification failed:', {
            message: error instanceof Error ? error.message : error,
            code,
        });

        if (code?.startsWith?.('P')) {
            return res.status(500).json({ error: 'Authentication service database is not ready' });
        }

        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
