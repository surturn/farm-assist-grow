import { Request, Response } from 'express';
import { analyzeCropImage } from '../services/ai.service';
import { prisma } from '../db/prisma';
import { redisClient } from '../cache/redis';
import crypto from 'crypto';

export const analyzeCrop = async (req: Request, res: Response): Promise<any> => {
    try {
        const { imageBase64, farmId } = req.body;

        if (!imageBase64 || !imageBase64.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid or missing image data (must be base64)' });
        }

        const imageHash = crypto.createHash('sha256').update(imageBase64).digest('hex');
        const cacheKey = `crop_analysis:${imageHash}`;

        if (redisClient) {
            const cachedResult = await redisClient.get(cacheKey);
            if (cachedResult) {
                return res.status(200).json(JSON.parse(cachedResult));
            }
        }

        const analysisResult = await analyzeCropImage(imageBase64, farmId);

        if (redisClient) {
            await redisClient.set(cacheKey, JSON.stringify(analysisResult), { EX: 86400 }); // Cache for 24 hours
        }

        if (farmId) {
            // await prisma.task.create({ ... })
        }

        return res.status(200).json(analysisResult);
    } catch (error: any) {
        console.error('Crop Analysis Controller Error:', error);
        res.status(500).json({ error: 'Failed to analyze crop', details: error.message });
    }
};
