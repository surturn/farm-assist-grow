import { Request, Response } from 'express';
import { prisma } from '@farmassist/database';

export const getTasks = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const farmId = req.query.farmId as string | undefined;

        const tasks = await prisma.task.findMany({
            where: { 
                assignedTo: userId,
                ...(farmId ? { farmId } : {})
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(tasks);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

export const createTask = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { title, description, dueDate, farmId } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const task = await prisma.task.create({
            data: {
                title,
                description,
                dueDate: dueDate ? new Date(dueDate) : null,
                farmId: farmId || null,
                assignedTo: userId,
                status: 'PENDING'
            }
        });

        res.status(201).json(task);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create task' });
    }
};

export const updateTaskStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        // Verify ownership
        const existingTask = await prisma.task.findUnique({ where: { id } });
        if (!existingTask || existingTask.assignedTo !== userId) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = await prisma.task.update({
            where: { id },
            data: { status }
        });

        res.status(200).json(task);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to update task' });
    }
};
