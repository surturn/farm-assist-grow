import app from './app';
import { env, isWhatsAppConfigured } from './config/env';
import { startInboundWorker } from './channels/whatsapp/inbound.worker';

const startServer = () => {
    const PORT = env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${env.NODE_ENV}`);
    });

    // Started here rather than at import time, so importing the app in a test
    // does not open a queue consumer against the developer's Redis.
    if (isWhatsAppConfigured()) {
        startInboundWorker();
        console.log('WhatsApp inbound worker started');
    } else {
        console.warn('WhatsApp channel not configured; inbound worker not started');
    }

    // Handle unhandled Promise rejections and uncaught exceptions safely
    process.on('unhandledRejection', (reason) => {
        console.error('Unhandled Rejection at Promise:', reason);
        // Determine whether to crash process or not
    });

    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception thrown:', err);
        process.exit(1);
    });
};

startServer();
