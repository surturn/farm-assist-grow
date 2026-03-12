import { Request, Response } from 'express';
import { dbAdmin } from '../config/firebase';
import * as admin from 'firebase-admin';

export const getScans = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const limitQuery = req.query.limit ? parseInt(req.query.limit as string) : 50;

        const scansSnapshot = await dbAdmin.collection('scans')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limitQuery)
            .get();
        
        const scans = scansSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        return res.status(200).json(scans);
    } catch (error: any) {
        console.error('Get Scans Error:', error);
        return res.status(500).json({ error: 'Failed to fetch scans', details: error.message });
    }
};

export const createScan = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const scanData = req.body;
        
        const docRef = await dbAdmin.collection('scans').add({
            ...scanData,
            userId,
            createdAt: admin.firestore.Timestamp.now()
        });

        return res.status(201).json({ id: docRef.id, ...scanData });
    } catch (error: any) {
        console.error('Create Scan Error:', error);
        return res.status(500).json({ error: 'Failed to create scan', details: error.message });
    }
};
