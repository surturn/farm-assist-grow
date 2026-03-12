import { Request, Response } from 'express';
import { dbAdmin } from '../config/firebase';

export const getProductsForDisease = async (req: Request, res: Response): Promise<any> => {
    try {
        const { disease } = req.query;
        if (!disease || typeof disease !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid disease parameter' });
        }
        
        const productsSnapshot = await dbAdmin.collection('products')
            .where('targetPests', 'array-contains', disease)
            .limit(10)
            .get();
        
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(products);
    } catch (error: any) {
        console.error('Fetch products error:', error);
        return res.status(500).json({ error: 'Failed to fetch products', details: error.message });
    }
};
