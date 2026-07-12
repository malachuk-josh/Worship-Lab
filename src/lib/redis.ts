import { Redis } from "@upstash/redis";

// Lazily construct the client so that importing this module during the build
// (before env vars are read at request time) never throws.
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
  }
  return client;
}
