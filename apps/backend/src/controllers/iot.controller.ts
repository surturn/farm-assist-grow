import { Request, Response } from 'express';
import { dbAdmin } from '@farmassist/firebase-admin';
import * as admin from 'firebase-admin';
import { prisma } from '@farmassist/database';

export const ingestTelemetry = async (req: Request, res: Response): Promise<any> => {
    try {
        const { deviceId, farmId, soilMoisture, temperature, humidity, timestamp } = req.body;

        if (!deviceId || !farmId) {
            return res.status(400).json({ error: 'Missing deviceId or farmId' });
        }

        // Validate device registration in Firestore
        const deviceRef = dbAdmin.collection('devices').doc(deviceId);
        const deviceDoc = await deviceRef.get();
        
        if (!deviceDoc.exists) {
           await deviceRef.set({ farmId, registeredAt: admin.firestore.Timestamp.now() });
        }

        // Store raw reading in Firestore (Time-series / High velocity)
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

        // Alert Evaluation Engine
        if (soilMoisture < 30) {
            // Find the owner of the farm to notify
            const farm = await prisma.farm.findUnique({
                where: { id: farmId },
                include: {
                    tenant: {
                        include: {
                            members: {
                                where: { role: 'OWNER' }
                            }
                        }
                    }
                }
            });

            const ownerId = farm?.tenant?.members?.[0]?.userId;

            if (ownerId) {
                // Write breach directly into PostgreSQL notifications table
                await prisma.notification.create({
                    data: {
                        userId: ownerId,
                        title: 'Low Soil Moisture Alert',
                        message: `Device ${deviceId} on farm '${farm.name}' reported critically low soil moisture (${soilMoisture}%).`,
                        type: 'ALERT'
                    }
                });
            }
        }

        return res.status(201).json({ success: true, message: 'Telemetry processed' });
    } catch (error: any) {
        console.error('IoT Telemetry Error:', error);
        return res.status(500).json({ error: 'Failed to process telemetry', details: error.message });
    }
};
