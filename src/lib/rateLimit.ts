import { redis } from "./redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Sliding window rate limiter using Redis.
 * @param key - Unique key (e.g., "execute:userId" or "login:ip")
 * @param limit - Max requests in window
 * @param windowSec - Window size in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const now = Date.now();
  const windowMs = windowSec * 1000;

  // Remove entries outside the window, add current, and count — all in one pipeline
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
  pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);
  pipeline.zcard(redisKey);
  pipeline.expire(redisKey, windowSec);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) ?? 0;

  if (count > limit) {
    // Get the oldest entry to calculate retry-after
    const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
    const oldestTime = oldest.length >= 2 ? parseInt(oldest[1], 10) : now;
    const retryAfterMs = oldestTime + windowMs - now;
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return { allowed: false, remaining: 0, retryAfterSec };
  }

  return { allowed: true, remaining: limit - count, retryAfterSec: 0 };
}
