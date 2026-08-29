import { Request, Response } from 'express';
import * as scanService from '../services/scan.service';
import { userCanAccessFarm } from '../services/farmAccess.service';

export const getScans = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const farmId = req.query.farmId as string | undefined;

        const scans = await scanService.listScansForUser(userId, { limit, farmId });
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

        // Same reasoning as tasks and farm notes: a body-supplied farmId must
        // be checked against the caller's memberships, not trusted.
        if (farmId && !(await userCanAccessFarm(userId, farmId))) {
            return res.status(403).json({ error: 'You do not have access to this farm' });
        }

        const newScan = await scanService.createScan(
            { userId },
            { farmId, imageUrl, diseaseName, confidence, treatment }
        );

        return res.status(201).json(newScan);
    } catch (error: any) {
        console.error('Create Scan Error:', error);
        return res.status(500).json({ error: 'Failed to create scan', details: error.message });
    }
};
