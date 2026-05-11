import Redis from "ioredis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!redis) redis = new Redis(url, { maxRetriesPerRequest: 2 });
  return redis;
}

type OrgSettings = Record<string, unknown>;

export function getMaxVoiceSessionsPerDay(settings: OrgSettings | null | undefined): number | null {
  const raw = settings?.maxVoiceSessionsPerDay;
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), 1_000_000);
}

/** Explicit limit, or free-plan default from env (fallback 30). Pro/enterprise → unlimited unless capped. */
export function resolveVoiceSessionDailyLimit(settings: OrgSettings | null | undefined): number | null {
  const explicit = getMaxVoiceSessionsPerDay(settings);
  if (explicit != null) return explicit;
  const plan = settings?.plan;
  if (plan === "free") {
    const env = process.env.SWARSALES_DEFAULT_FREE_VOICE_SESSIONS_PER_DAY;
    if (env) {
      const n = parseInt(env, 10);
      if (Number.isFinite(n) && n > 0) return Math.min(n, 1_000_000);
    }
    return 30;
  }
  return null;
}

/** Returns false if quota exceeded (and does not increment). */
export async function tryConsumeVoiceSessionQuota(orgId: string, maxPerDay: number | null): Promise<boolean> {
  if (maxPerDay == null) return true;
  const r = getRedis();
  if (!r) return true;

  const day = new Date().toISOString().slice(0, 10);
  const key = `swarsales:quota:voice:${orgId}:${day}`;
  try {
    const n = await r.incr(key);
    if (n === 1) await r.expire(key, 172800);
    if (n > maxPerDay) {
      await r.decr(key);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}
