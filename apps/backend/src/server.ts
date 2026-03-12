import app from './app';
import { env } from './config/env';

const startServer = () => {
    const PORT = env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${env.NODE_ENV}`);
    });

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
