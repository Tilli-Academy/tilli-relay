import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is required");
  }
  return new Redis(url);
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
