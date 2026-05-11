import { NextResponse } from "next/server";
import Redis from "ioredis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!redis) {
    redis = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  }
  return redis;
}

/**
 * Fixed window rate limit. Without REDIS_URL, allows all traffic (dev-friendly).
 */
export async function rateLimitResponse(
  routeKey: string,
  identifier: string,
  limit: number,
  windowSec: number,
): Promise<NextResponse | null> {
  const r = getRedis();
  if (!r) return null;

  const key = `swarsales:rl:${routeKey}:${identifier}`;
  try {
    const n = await r.incr(key);
    if (n === 1) await r.expire(key, windowSec);
    if (n > limit) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  } catch {
    return null;
  }
  return null;
}
