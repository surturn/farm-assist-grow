import { Request, Response } from 'express';
import { prisma } from '@farmassist/database';
// In a real app we'd import the aiService here, but keeping it simple for the controller

export const getScans = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const limitQuery = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const farmId = req.query.farmId as string | undefined;

        const scans = await prisma.scan.findMany({
            where: { 
                userId,
                ...(farmId ? { farmId } : {})
            },
            orderBy: { createdAt: 'desc' },
            take: limitQuery
        });

        return res.status(200).json(scans);
    } catch (error: any) {
        console.error('Get Scans Error:', error);
        return res.status(500).json({ error: 'Failed to fetch scans', details: error.message });
    }
};

export const createScan = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { farmId, imageUrl, diseaseName, confidence, treatment } = req.body;
        
        const newScan = await prisma.scan.create({
            data: {
                userId,
                farmId: farmId || null,
                imageUrl,
                diseaseName,
                confidence,
                treatment
            }
        });

        return res.status(201).json(newScan);
    } catch (error: any) {
        console.error('Create Scan Error:', error);
        return res.status(500).json({ error: 'Failed to create scan', details: error.message });
    }
};
