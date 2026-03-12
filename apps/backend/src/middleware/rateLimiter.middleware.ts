import { Request, Response, NextFunction } from 'express';
import { redis } from '@farmassist/redis';

interface RateLimitOptions {
    windowSeconds: number;
    maxRequests: number;
}

/**
 * Sliding window rate limiter based on Redis.
 * Falls back to allowing the request if Redis is unavailable.
 */
export const rateLimiter = (options: RateLimitOptions) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (redis.status !== 'ready') {
            // Pass through if Redis is disabled/down
            return next();
        }

        try {
            // Use IP as identifier if auth is not yet processed, otherwise UID
            const identifier = req.user?.uid || req.ip || 'unknown';
            const key = `rate-limit:${req.originalUrl}:${identifier}`;

            const requests = await redis.incr(key);

            if (requests === 1) {
                // First request in this window, set expiry
                await redis.expire(key, options.windowSeconds);
            } else {
                // Ensure TTL exists in case of race condition
                const currentTtl = await redis.ttl(key);
                if (currentTtl === -1) {
                    await redis.expire(key, options.windowSeconds);
                }
            }

            const finalTtl = await redis.ttl(key);

            // Set headers indicating rate limit
            res.setHeader('X-RateLimit-Limit', options.maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - requests));
            res.setHeader('X-RateLimit-Reset', Date.now() + finalTtl * 1000);

            if (requests > options.maxRequests) {
                return res.status(429).json({
                    error: 'Too Many Requests',
                    retryAfter: finalTtl
                });
            }

            next();
        } catch (error) {
            console.error('Rate limiting error:', error);
            // Fail open to avoid blocking legitimate requests on cache failure
            next();
        }
    };
};
