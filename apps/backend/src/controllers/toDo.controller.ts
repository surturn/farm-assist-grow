import { Request, Response } from 'express';
import { prisma } from '@farmassist/database';

export const getTasks = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const tasks = await prisma.task.findMany({
            where: { assignee: { id: userId } },
            orderBy: { dueDate: 'asc' }
        });

        return res.status(200).json(tasks);
    } catch (error: any) {
        console.error('Get Tasks Error:', error);
        return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

export const createTask = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { farmId, title, description, dueDate } = req.body;
        if (!farmId || !title) {
            return res.status(400).json({ error: 'farmId and title are required' });
        }

        const newTask = await prisma.task.create({
            data: {
                farmId,
                title,
                description,
                dueDate: dueDate ? new Date(dueDate) : null,
                assignedTo: userId,
                status: 'PENDING'
            }
        });

        return res.status(201).json(newTask);
    } catch (error: any) {
        console.error('Create Task Error:', error);
        return res.status(500).json({ error: 'Failed to create task' });
    }
};

export const completeTask = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const task = await prisma.task.update({
            where: { id },
            data: { status: 'COMPLETED' }
        });
        return res.status(200).json(task);
    } catch (error: any) {
        console.error('Complete Task Error:', error);
        return res.status(500).json({ error: 'Failed to complete task' });
    }
};
