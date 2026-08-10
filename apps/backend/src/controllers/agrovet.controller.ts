import { Request, Response } from 'express';
import { prisma } from '@farmassist/database';

export const getAgrovets = async (req: Request, res: Response): Promise<any> => {
    try {
        const agrovets = await prisma.agrovet.findMany({
            include: { products: true }
        });
        return res.status(200).json(agrovets);
    } catch (error: any) {
        console.error('Get Agrovets Error:', error);
        return res.status(500).json({ error: 'Failed to fetch agrovets' });
    }
};

export const searchProducts = async (req: Request, res: Response): Promise<any> => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const products = await prisma.product.findMany({
            where: {
                name: { contains: query as string, mode: 'insensitive' }
            },
            include: { agrovet: true }
        });

        return res.status(200).json(products);
    } catch (error: any) {
        console.error('Search Products Error:', error);
        return res.status(500).json({ error: 'Failed to search products' });
    }
};

export const reserveProduct = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // MVP Mockup: Just return success for ordering/reserving
        const { productId, type } = req.body; // type = 'RESERVE' | 'ORDER'

        return res.status(200).json({ 
            success: true, 
            message: type === 'RESERVE' ? 'Reserved for pickup' : 'Order placed successfully',
            productId
        });
    } catch (error: any) {
        console.error('Reserve Product Error:', error);
        return res.status(500).json({ error: 'Failed to process order' });
    }
};
