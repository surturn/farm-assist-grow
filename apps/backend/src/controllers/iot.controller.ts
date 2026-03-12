import { Request, Response } from 'express';
import { dbAdmin } from '@farmassist/firebase-admin';
import * as admin from 'firebase-admin';

export const ingestTelemetry = async (req: Request, res: Response): Promise<any> => {
    try {
        const { deviceId, farmId, soilMoisture, temperature, humidity, timestamp } = req.body;

        if (!deviceId || !farmId) {
            return res.status(400).json({ error: 'Missing deviceId or farmId' });
        }

        // Validate device registration (in a real app, verify ownership)
        const deviceRef = dbAdmin.collection('devices').doc(deviceId);
        const deviceDoc = await deviceRef.get();
        
        if (!deviceDoc.exists) {
           // Optionally auto-register or reject. We'll register for this demo.
           await deviceRef.set({ farmId, registeredAt: admin.firestore.Timestamp.now() });
        }

        // Store reading
        const readingData = {
            deviceId,
            farmId,
            soilMoisture,
            temperature,
            humidity,
            timestamp: timestamp || Date.now(),
            createdAt: admin.firestore.Timestamp.now()
        };

        await dbAdmin.collection('sensorReadings').add(readingData);

        // Optionally generate alert if threshold exceeded
        if (soilMoisture < 30) {
            await dbAdmin.collection('alerts').add({
                farmId,
                deviceId,
                title: 'Low Soil Moisture',
                message: `Device ${deviceId} reported critically low soil moisture (${soilMoisture}%).`,
                severity: 'high',
                createdAt: admin.firestore.Timestamp.now(),
                read: false
            });
        }

        return res.status(201).json({ success: true, message: 'Telemetry processed' });
    } catch (error: any) {
        console.error('IoT Telemetry Error:', error);
        return res.status(500).json({ error: 'Failed to process telemetry', details: error.message });
    }
};
