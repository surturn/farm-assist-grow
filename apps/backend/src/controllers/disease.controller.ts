import { Request, Response } from 'express';
import { dbAdmin } from '@farmassist/firebase-admin';

export const getAllDiseases = async (req: Request, res: Response): Promise<any> => {
    try {
        const snapshot = await dbAdmin.collection('diseases').get();
        const diseases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(diseases);
    } catch (error: any) {
        console.error('Fetch diseases error:', error);
        return res.status(500).json({ error: 'Failed to fetch diseases', details: error.message });
    }
};
