import Redis from 'ioredis';

/**
 * REDIS CONFIGURATION:
 * 
 * In production, ensure REDIS_URL is provided in your environment variables.
 * In development without REDIS_URL, this will attempt to fallback to localhost:6379 securely.
 * 
 * To run Redis locally for development:
 *   # Linux/Mac via Docker: docker run --name farmassist-redis -p 6379:6379 -d redis
 *   # Windows: Use WSL2 with the above docker command, or Memurai.
 * 
 * FALLBACK BEHAVIOR:
 * If Redis is unavailable, this service will catch the error and prevent a fatal backend crash. 
 * AI image hashing will silently bypass cache and call OpenAI synchronously instead of crashing the server.
 */

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        // Prevent infinite reconnection loops from crashing dev servers
        const delay = Math.min(times * 50, 2000);
        if (times > 5) {
            console.warn('Redis is unavailable: Running in degraded mode without cache.');
            return null; // Stop retrying, fail gracefully
        }
        return delay;
    }
});

redis.on('error', (err) => {
    // Only log once to avoid terminal spam if it completely fails
    if (redis.status !== 'end') {
        console.warn('Redis connection issue caught gracefully. Cache mechanisms may be bypassed. Details: ' + err.message);
    }
});

redis.on('connect', () => {
    console.log('Connected to Redis successfully');
});
