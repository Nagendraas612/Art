/**
 * Shared sliding-window rate limiter.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are configured (shared across all serverless instances — the correct
 * production behavior). Otherwise falls back to the original in-memory
 * sliding window (adequate for single-instance dev).
 *
 * Call sites use `await checkRateLimit(...)` and never change regardless of
 * which backend is active.
 */

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();

/** Prune stale buckets so the map cannot grow without bound. */
function gc(now: number, windowMs: number) {
  if (store.size < 10_000) return;
  for (const [key, bucket] of store) {
    const fresh = bucket.hits.filter((t) => now - t < windowMs);
    if (fresh.length === 0) store.delete(key);
    else bucket.hits = fresh;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** ms until the caller may retry, when denied. */
  retryAfterMs: number;
}

const upstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

/**
 * The single client-IP extractor every rate limit must use. Proxies APPEND
 * to X-Forwarded-For, so the leftmost entry is client-claimed and trivially
 * spoofable — every IP-keyed limit that trusted [0] could be bypassed by
 * rotating a fake header per request. Vercel's edge appends the true
 * connecting IP last, so the LAST entry is the one the client can't forge.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

// Set once the in-memory fallback warning has been logged, so production
// logs get exactly one line instead of one per request.
let fallbackWarned = false;

// Lazily created per (limit, window) — Upstash Ratelimit instances are bound
// to one limit/window pair. Typed loosely because the class comes from a
// dynamic import.
const upstashLimiters = new Map<string, { limit: (key: string) => Promise<{ success: boolean }> }>();

async function checkUpstash(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  if (!upstashConfigured) return null;
  try {
    const cacheKey = `${limit}:${windowMs}`;
    let rl = upstashLimiters.get(cacheKey);
    if (!rl) {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const { Redis } = await import("@upstash/redis");
      rl = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(
          limit,
          `${Math.max(1, Math.round(windowMs / 1000))} s`
        ),
        analytics: false,
        prefix: "kb-ratelimit",
      });
      upstashLimiters.set(cacheKey, rl);
    }
    const { success } = await rl.limit(key);
    return success
      ? { allowed: true, retryAfterMs: 0 }
      : { allowed: false, retryAfterMs: windowMs };
  } catch (err) {
    // Never fail open or closed on Redis trouble — degrade to memory.
    console.error("[rate-limit] Upstash error, falling back to memory:", err);
    return null;
  }
}

function checkMemory(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  gc(now, windowMs);

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    store.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
  }

  bucket.hits.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Sliding-window check: at most `limit` events per `windowMs` per key.
 * Key should be namespaced, e.g. `msg:<userId>` or `search:<ip>`.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const upstash = await checkUpstash(key, limit, windowMs);
  if (upstash) return upstash;
  // The in-memory fallback is per serverless instance — in production it
  // silently weakens every rate limit. Log once so a missing Upstash
  // config is visible in Vercel logs instead of invisible.
  if (process.env.VERCEL_ENV === "production" && !fallbackWarned) {
    fallbackWarned = true;
    console.warn(
      "[rate-limit] Upstash Redis is not configured; using in-memory rate limiting. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for shared limits."
    );
  }
  return checkMemory(key, limit, windowMs);
}

/** Client-facing message when the limiter denies a request (wrap in `{ error: ... }`). */
export function rateLimitExceeded(retryAfterMs: number): string {
  const secs = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `Too many requests. Please wait ${secs} second${secs === 1 ? "" : "s"} and try again.`;
}
