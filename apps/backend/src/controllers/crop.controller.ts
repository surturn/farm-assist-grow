import { Request, Response } from 'express';
import { analyzeCropImage } from '@farmassist/ai';
import { prisma } from '@farmassist/database';
import { redis } from '@farmassist/redis';
import { aiQueue } from '@farmassist/queue';
import crypto from 'crypto';

export const analyzeCrop = async (req: Request, res: Response): Promise<any> => {
    try {
        const { imageBase64, farmId } = req.body;

        if (!imageBase64 || !imageBase64.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid or missing image data (must be base64)' });
        }

        const imageHash = crypto.createHash('sha256').update(imageBase64).digest('hex');
        const cacheKey = `crop_analysis:${imageHash}`;

        if (redis.status === 'ready') {
            const cachedResult = await redis.get(cacheKey);
            if (cachedResult) {
                return res.status(200).json(JSON.parse(cachedResult));
            }
        }

        // We push to the BullMQ queue
        const job = await aiQueue.add('analyze-crop', { imageBase64, farmId });

        return res.status(202).json({
            message: "Analysis started",
            jobId: job.id
        });
    } catch (error: any) {
        console.error('Crop Analysis Controller Error:', error);
        res.status(500).json({ error: 'Failed to analyze crop', details: error.message });
    }
};

export const getAnalysisStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const { jobId } = req.params;
        const job = await aiQueue.getJob(jobId);
        
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }
        
        const state = await job.getState();
        const progress = job.progress;
        const reason = job.failedReason;
        const result = job.returnvalue;

        return res.status(200).json({
            jobId,
            state,
            progress,
            reason,
            result
        });
    } catch (error: any) {
        console.error('Job Status Controller Error:', error);
        res.status(500).json({ error: 'Failed to fetch job status' });
    }
};
