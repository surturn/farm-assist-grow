import { Request, Response } from 'express';
import { analyzeCropImage } from '../services/ai.service';
import { prisma } from '../db/prisma';

export const analyzeCrop = async (req: Request, res: Response) => {
    try {
        const { imageBase64, farmId } = req.body;

        if (!imageBase64 || !imageBase64.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid or missing image data (must be base64)' });
        }

        const analysisResult = await analyzeCropImage(imageBase64, farmId);

        // If farmId is provided, you could optionally save the result as a Task/Notification
        if (farmId) {
            // await prisma.task.create({ ... })
        }

        return res.status(200).json(analysisResult);
    } catch (error: any) {
        console.error('Crop Analysis Controller Error:', error);
        res.status(500).json({ error: 'Failed to analyze crop', details: error.message });
    }
};
