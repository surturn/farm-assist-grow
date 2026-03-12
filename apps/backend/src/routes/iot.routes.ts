import { Router } from 'express';
import { ingestTelemetry } from '../controllers/iot.controller';

const router = Router();

// Endpoint for devices to push telemetry
// In a real app, you would use a strict API key or device cert middleware here
router.post('/telemetry', ingestTelemetry);

export default router;
