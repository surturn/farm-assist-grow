import { Request, Response } from 'express';
import { prisma } from '@farmassist/database';

export const getDashboardData = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const farmId = req.query.farmId as string | undefined;
        const scanFilter = { userId, ...(farmId ? { farmId } : {}) };

        const [user, farms, recentScans, totalScans] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { firstName: true, lastName: true, avatarUrl: true, region: true },
            }),
            prisma.farm.findMany({
                where: { tenant: { members: { some: { userId } } } },
                select: { id: true, name: true, location: true },
            }),
            prisma.scan.findMany({ where: scanFilter, orderBy: { createdAt: 'desc' }, take: 5 }),
            prisma.scan.count({ where: scanFilter }),
        ]);

        return res.status(200).json({
            user: { firstName: user?.firstName ?? null, lastName: user?.lastName ?? null, avatarUrl: user?.avatarUrl ?? null },
            userRegion: user?.region || 'Central Kenya',
            farms,
            activeFarmId: farmId || farms[0]?.id || null,
            recentScans,
            totalScans,
        });
    } catch (error: any) {
        console.error('Dashboard Data Error:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
};
