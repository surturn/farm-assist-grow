import { Request, Response } from 'express';
import { prisma } from '@farmassist/database';
import { createFarmSchema } from '../validators/farm.validator';

export const getFarms = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'User not found' });

        const farms = await prisma.farm.findMany({
            where: {
                tenant: {
                    members: {
                        some: { userId }
                    }
                }
            },
            include: {
                _count: {
                    select: { crops: true, tasks: true, scans: true, notes: true }
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

        // When a user creates a farm, they are creating a new Farm Tenant as well
        const farm = await prisma.farm.create({
            data: {
                name: validatedData.name,
                location: validatedData.location,
                tenant: {
                    create: {
                        name: `${validatedData.name} Tenant`,
                        type: 'FARM',
                        members: {
                            create: {
                                userId,
                                role: 'OWNER'
                            }
                        }
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
