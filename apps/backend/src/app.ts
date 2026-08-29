import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';

// Initialize the Express App
const app: Express = express();

/**
 * Global Middlewares
 */
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: true, credentials: true })); // Configure strictly for production
// The raw bytes are kept because Meta's webhook signature is an HMAC over the
// body exactly as sent. Re-serialising the parsed object produces different
// bytes for the same document, so the verification would never match.
app.use(express.json({
    limit: '10mb', // Max payload size
    verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
    },
}));
app.use(express.urlencoded({ extended: true }));

/**
 * Health Check Route
 */
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', environment: env.NODE_ENV });
});

/**
 * Import and Use Routes
 */
import farmRoutes from './routes/farm.routes';
import cropRoutes from './routes/crop.routes';
import dashboardRoutes from './routes/dashboard.routes';
import scanRoutes from './routes/scan.routes';
import notificationRoutes from './routes/notification.routes';
import productRoutes from './routes/product.routes';
import diseaseRoutes from './routes/disease.routes';
import iotRoutes from './routes/iot.routes';
import userRoutes from './routes/user.routes';
import taskRoutes from './routes/task.routes';
import farmnoteRoutes from './routes/farmnote.routes';
import agrovetRoutes from './routes/agrovet.routes';
import whatsappWebhookRoutes from './channels/whatsapp/webhook.route';
import path from 'path';

app.use('/api/v1/public', express.static(path.join(__dirname, '../public')));

app.use('/api/v1/farms', farmRoutes);
app.use('/api/v1/crops', cropRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/scans', scanRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/diseases', diseaseRoutes);
app.use('/api/v1/iot', iotRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/farm-notes', farmnoteRoutes);
app.use('/api/v1/agrovets', agrovetRoutes);

// Unauthenticated by design: the caller is Meta, not a logged-in user. The
// HMAC signature check inside the route is what authenticates it.
app.use('/api/v1/channels/whatsapp/webhook', whatsappWebhookRoutes);
/**
 * Global Error Handler Middleware
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[Error]:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    });
});

export default app;
