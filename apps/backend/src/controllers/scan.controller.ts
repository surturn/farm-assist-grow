import { Request, Response } from 'express';
import * as scanService from '../services/scan.service';
import { userCanAccessFarm } from '../services/farmAccess.service';
import { parseImageDataUrl } from '../services/imageStore.service';
import { startDiagnosis, answerQuestion } from '../conversation/diagnosis';
import { realDeps } from '../conversation/deps';
import { checkImage } from '../conversation/filter';
import { StaleAnswerError } from '../conversation/types';

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

const langFor = async (userId: string) => {
    const { prisma } = require('@farmassist/database');
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferredLanguage: true } });
    return u?.preferredLanguage === 'sw' ? 'sw' : 'en';
};

export const createScan = async (req: Request, res: Response): Promise<any> => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { imageBase64, farmId } = req.body ?? {};
    if (farmId !== undefined && typeof farmId !== 'string') return res.status(400).json({ error: 'farmId must be a string' });
    if (farmId && !(await userCanAccessFarm(userId, farmId))) return res.status(403).json({ error: 'You do not have access to this farm' });

    const image = parseImageDataUrl(imageBase64);
    if ('error' in image) return res.status(400).json({ error: image.error });
    const quality = await checkImage(image.bytes);
    if (quality !== 'ok') return res.status(400).json({ error: quality === 'too_small' ? 'Photo is too small. Use at least 224 pixels on the short side.' : "We couldn't read that image." });

    try {
        const step = await startDiagnosis(realDeps(), { userId, farmId }, image, await langFor(userId));
        return res.status(201).json({ step });
    } catch (error) {
        console.error('Diagnosis Error:', error);
        return res.status(502).json({ error: 'Diagnosis failed. Please try again.' });
    }
};

export const answerScan = async (req: Request, res: Response): Promise<any> => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { questionId, optionId } = req.body ?? {};
    if (typeof questionId !== 'string' || typeof optionId !== 'string') return res.status(400).json({ error: 'questionId and optionId are required' });
    try {
        const step = await answerQuestion(realDeps(), { userId }, String(req.params.id), questionId, optionId, await langFor(userId));
        return res.status(200).json({ step });
    } catch (error) {
        if (error instanceof StaleAnswerError) return res.status(409).json({ error: 'expired' });
        console.error('Answer Error:', error);
        return res.status(500).json({ error: 'Failed to record your answer' });
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
