import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../cache/redis';

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
        if (!redisClient || !redisClient.isOpen) {
            // Pass through if Redis is disabled/down
            return next();
        }

        try {
            // Use IP as identifier if auth is not yet processed, otherwise UID
            const identifier = req.user?.uid || req.ip || 'unknown';
            const key = `rate-limit:${req.originalUrl}:${identifier}`;

            const requests = await redisClient.incr(key);

            if (requests === 1) {
                // First request in this window, set expiry
                await redisClient.expire(key, options.windowSeconds);
            } else {
                // Ensure TTL exists in case of race condition
                const ttl = await redisClient.ttl(key);
                if (ttl === -1) {
                    await redisClient.expire(key, options.windowSeconds);
                }
            }

            const ttl = await redisClient.ttl(key);

            // Set headers indicating rate limit
            res.setHeader('X-RateLimit-Limit', options.maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - requests));
            res.setHeader('X-RateLimit-Reset', Date.now() + ttl * 1000);

            if (requests > options.maxRequests) {
                return res.status(429).json({
                    error: 'Too Many Requests',
                    retryAfter: ttl
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
