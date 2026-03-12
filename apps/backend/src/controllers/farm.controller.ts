import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { createFarmSchema } from '../validators/farm.validator';

export const getFarms = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'User not found' });

        const farms = await prisma.farm.findMany({
            where: {
                members: {
                    some: { userId }
                }
            },
            include: {
                _count: {
                    select: { crops: true, members: true, tasks: true }
                }
            }
        });

        res.json(farms);
    } catch (error) {
        console.error('Error fetching farms:', error);
        res.status(500).json({ error: 'Failed to fetch farms' });
    }
};

export const createFarm = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'User not found' });

        const validatedData = createFarmSchema.parse(req.body);

        const farm = await prisma.farm.create({
            data: {
                name: validatedData.name,
                location: validatedData.location,
                members: {
                    create: {
                        userId,
                        role: 'OWNER'
                    }
                }
            }
        });

        res.status(201).json(farm);
    } catch (error) {
        console.error('Error creating farm:', error);
        res.status(400).json({ error: 'Invalid input or server error' });
    }
};
