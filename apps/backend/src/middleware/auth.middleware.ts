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
            console.warn(`Authenticated Firebase User ${decodedToken.uid} missing from local PostgreSQL Database. Provisioning...`);

            // The user row and their default tenant must land together. Created
            // separately, a failure between the two would leave an account that
            // owns no farm and never gets provisioned again, because the next
            // request finds the user and skips this branch entirely.
            try {
                await prisma.$transaction(async (tx) => {
                    await tx.user.create({
                        data: {
                            id: decodedToken.uid,
                            email: decodedToken.email || `${decodedToken.uid}@placeholder.email`,
                            firstName: decodedToken.name?.split(' ')[0] || 'New',
                            lastName: decodedToken.name?.split(' ').slice(1).join(' ') || 'Farmer',
                            phone: decodedToken.phone_number || null,
                        }
                    });

                    await tx.tenant.create({
                        data: {
                            name: 'My Personal Farm',
                            type: 'FARM',
                            members: {
                                create: {
                                    userId: decodedToken.uid,
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
                });
            } catch (provisionError: any) {
                // Two concurrent first requests race here. The loser hits a unique
                // constraint on the user id, which means the winner has already
                // provisioned this account — a success for our purposes.
                if (provisionError?.code !== 'P2002') throw provisionError;
            }
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
