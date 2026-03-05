import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';

// We import these just to ensure they instantiate
import './config/firebase';
import './cache/redis';
import './db/prisma';

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

app.use('/api/v1/farms', farmRoutes);
app.use('/api/v1/crops', cropRoutes);


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
