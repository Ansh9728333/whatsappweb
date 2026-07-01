import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Singleton pattern for Next.js hot-reload
const globalForRedis = globalThis as unknown as { redis: IORedis | undefined };

export const redis =
  globalForRedis.redis ??
  new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export default redis;
