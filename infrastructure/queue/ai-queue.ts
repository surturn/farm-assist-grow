import { Queue, Worker, Job } from 'bullmq';
import { redis } from '@farmassist/redis'; // Updated import
import { analyzeCropImage } from '@farmassist/ai';

export const AI_QUEUE_NAME = 'ai-analysis-queue';

export const aiQueue = new Queue(AI_QUEUE_NAME, { connection: redis as any });

// Process jobs via BullMQ worker
export const aiWorker = new Worker(AI_QUEUE_NAME, async (job: Job) => {
    console.log(`Processing AI job ${job.id} for farm ${job.data.farmId}`);
    try {
        const result = await analyzeCropImage(job.data.imageBase64, job.data.farmId);
        return { success: true, result };
    } catch (error: any) {
        console.error(`AI job ${job.id} failed:`, error.message);
        throw error;
    }
}, { connection: redis as any });

aiWorker.on('completed', job => {
    console.log(`Job ${job.id} has completed!`);
});

aiWorker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} has failed with ${err.message}`);
});
