import Redis from "ioredis";
import { env } from "@/config/env";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
});

export async function getOrSetCache<T>(key: string, ttlSeconds: number, resolver: () => Promise<T>) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const fresh = await resolver();
  await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
  return fresh;
}
