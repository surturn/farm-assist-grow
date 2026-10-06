import { Request, Response } from 'express';
import * as scanService from '../services/scan.service';
import { userCanAccessFarm } from '../services/farmAccess.service';
import { parseImageDataUrl } from '../services/imageStore.service';

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
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only the image and farm are accepted. Any diagnosis fields in the body
    // are ignored: the server is the only source of a diagnosis.
    const { imageBase64, farmId } = req.body ?? {};

    if (farmId && !(await userCanAccessFarm(userId, farmId))) {
        return res.status(403).json({ error: 'You do not have access to this farm' });
    }

    const image = parseImageDataUrl(imageBase64);
    if ('error' in image) {
        return res.status(400).json({ error: image.error });
    }

    try {
        const { scan, analysis } = await scanService.diagnoseAndRecord(
            { userId },
            { farmId, bytes: image.bytes, mimeType: image.mimeType }
        );
        return res.status(201).json({ scan, analysis });
    } catch (error: any) {
        console.error('Diagnosis Error:', error);
        return res.status(502).json({ error: 'Diagnosis failed. Please try again.' });
    }
};

export const verifyScan = async (req: Request, res: Response): Promise<any> => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { correct, label } = req.body ?? {};
    if (typeof correct !== 'boolean') {
        return res.status(400).json({ error: '"correct" must be true or false' });
    }
    try {
        const scan = await scanService.verifyScan(userId, String(req.params.id), {
            correct,
            label: typeof label === 'string' ? label : undefined,
        });
        if (!scan) return res.status(404).json({ error: 'Scan not found' });
        return res.status(200).json(scan);
    } catch (error: any) {
        console.error('Verify Scan Error:', error);
        return res.status(500).json({ error: 'Failed to verify scan' });
    }
};
