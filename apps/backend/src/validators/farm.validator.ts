import { z } from 'zod';

export const createFarmSchema = z.object({
    name: z.string().min(1, 'Farm name is required').max(100),
    location: z.string().optional(),
});

export const updateFarmSchema = createFarmSchema.partial();

export const createCropSchema = z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    plantedAt: z.string().datetime().optional(),
    expectedHarvest: z.string().datetime().optional(),
});
