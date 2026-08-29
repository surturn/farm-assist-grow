import { Request, Response } from 'express';
import * as farmNoteService from '../services/farmNote.service';

export const getFarmNotes = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const farmId = req.query.farmId as string | undefined;
        const notes = await farmNoteService.listFarmNotesForUser(userId, { farmId });

        return res.status(200).json(notes);
    } catch (error: any) {
        console.error('Get Farm Notes Error:', error);
        return res.status(500).json({ error: 'Failed to fetch farm notes' });
    }
};

export const createFarmNote = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { farmId, note } = req.body;
        // The column is nullable for voice notes arriving over WhatsApp, but the
        // REST endpoint still writes text against a named farm.
        if (!farmId || !note) {
            return res.status(400).json({ error: 'farmId and note are required' });
        }

        const newNote = await farmNoteService.createFarmNote({ userId }, { farmId, note });
        return res.status(201).json(newNote);
    } catch (error: any) {
        console.error('Create Farm Note Error:', error);
        return res.status(500).json({ error: 'Failed to create farm note' });
    }
};
