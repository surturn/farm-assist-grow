import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';

// Initialize the Express App
const app: Express = express();

/**
 * Global Middlewares
 */
app.use(helmet());
app.use(cors({ origin: true, credentials: true })); // Configure strictly for production
app.use(express.json({ limit: '10mb' })); // Max payload size
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

app.use('/api/v1/farms', farmRoutes);
app.use('/api/v1/crops', cropRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/scans', scanRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/diseases', diseaseRoutes);
app.use('/api/v1/iot', iotRoutes);


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
