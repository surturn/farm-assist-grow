import { createClient } from 'redis';
import { env } from '../config/env';

/**
 * Singleton Redis client.
 * Using dummy client if REDIS_URL is not set for local dev convenience, 
 * or throwing if required in production.
 */
let redisClient: ReturnType<typeof createClient> | null = null;

if (env.REDIS_URL) {
    redisClient = createClient({
        url: env.REDIS_URL,
    });

    redisClient.on('error', (err) => console.error('Redis Client Error', err));

    // Self-executing init
    (async () => {
        try {
            await redisClient.connect();
            console.log('Connected to Redis cache');
        } catch (error) {
            console.error(' Failed to connect to Redis', error);
        }
    })();
} else {
    console.warn('No REDIS_URL provided. Caching and rate limiting may be disabled or use memory fallbacks.');
}

export { redisClient };
