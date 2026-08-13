// Redis L2 cache (shared across all 8 PM2 workers).
// Best-effort: every operation swallows errors so the redirect path
// never fails because of Redis. L1 in-memory cache stays as the
// short-lived hot path; Redis is the cross-worker source of truth.

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let client: Redis | null = null;
let disabled = false;
let lastErrLog = 0;

function dropClient(): void {
  const stale = client;
  client = null;
  if (!stale) return;
  try {
    stale.disconnect(false);
  } catch {
    // Best-effort cleanup only.
  }
}

function isTransientWriteError(err: unknown): boolean {
  const message = ((err as Error)?.message || String(err)).toLowerCase();
  return (
    message.includes("stream isn't writeable") ||
    message.includes("connection is closed") ||
    message.includes("connection closed")
  );
}

function handleRedisErr(label: string, err: unknown): void {
  if (isTransientWriteError(err)) {
    dropClient();
    return;
  }
  logErr(label, err);
}

function logErr(label: string, err: unknown) {
  // Redis is a best-effort cache. These happen during reconnect races with
  // enableOfflineQueue=false and should be treated as cache misses, not app errors.
  if (isTransientWriteError(err)) return;
  const now = Date.now();
  if (now - lastErrLog < 30_000) return; // throttle
  lastErrLog = now;
  console.warn(`[redis-cache][${label}]`, (err as Error)?.message || err);
}

function getClient(): Redis | null {
  if (disabled) return null;
  if (client) return client;
  try {
    client = new Redis(REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 500,
      enableOfflineQueue: false,
      enableAutoPipelining: true,
      retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 3000)),
      reconnectOnError: () => true,
    });
    client.on("error", (err) => logErr("conn", err));
    client.on("end", () => {
      client = null;
    });
    client.on("close", () => {
      client = null;
    });
    return client;
  } catch (err) {
    logErr("init", err);
    disabled = true;
    return null;
  }
}

// Only return client when socket is actually ready to write. Prevents
// the "Stream isn't writeable and enableOfflineQueue options is false"
// noise during reconnect windows — we silently treat those as cache-miss.
function getReadyClient(): Redis | null {
  const c = getClient();
  if (!c) return null;
  if (c.status !== "ready") return null;
  const stream = (c as unknown as { connector?: { stream?: NodeJS.WritableStream & { destroyed?: boolean; writableEnded?: boolean } } }).connector?.stream;
  if (!stream || stream.destroyed || stream.writableEnded || !stream.writable) {
    dropClient();
    return null;
  }
  return c;
}

// Eagerly init on first import so the connection is warm.
getClient();

export async function redisGet<T = unknown>(key: string): Promise<T | null> {
  const c = getReadyClient();
  if (!c) return null;
  try {
    const raw = await c.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    handleRedisErr("get", err);
    return null;
  }
}

export async function redisSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  const c = getReadyClient();
  if (!c) return;
  try {
    // PX = TTL in milliseconds
    await c.set(key, JSON.stringify(value), "PX", Math.max(1000, ttlMs));
  } catch (err) {
    handleRedisErr("set", err);
  }
}

export async function redisDel(...keys: string[]): Promise<void> {
  const c = getReadyClient();
  if (!c || keys.length === 0) return;
  try {
    await c.del(...keys);
  } catch (err) {
    handleRedisErr("del", err);
  }
}

// Fire-and-forget set — caller does not await, errors logged internally.
export function redisSetAsync(key: string, value: unknown, ttlMs: number): void {
  void redisSet(key, value, ttlMs);
}

// Add a member to a set with TTL, return new set cardinality.
// Used for multi-link velocity tracking: SADD ip→{codes...} EXPIRE 1h.
// Returns 0 on Redis failure (fail-open: never block real users due to outage).
export async function redisSAddWithTTL(
  key: string,
  member: string,
  ttlSec: number,
): Promise<number> {
  const c = getReadyClient();
  if (!c) return 0;
  try {
    const pipeline = c.multi();
    pipeline.sadd(key, member);
    pipeline.expire(key, ttlSec);
    pipeline.scard(key);
    const results = await pipeline.exec();
    if (!results) return 0;
    const card = results[2]?.[1];
    return typeof card === "number" ? card : 0;
  } catch (err) {
    handleRedisErr("sadd", err);
    return 0;
  }
}
