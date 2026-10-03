/**
 * Shared in-memory sliding-window rate limiter (P8).
 *
 * Per-process memory: adequate for a single-instance deployment.
 * For multi-instance / production scale, replace `store` with a
 * Redis/Upstash adapter behind the same `checkRateLimit` signature —
 * the call sites must not change.
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

/**
 * Sliding-window check: at most `limit` events per `windowMs` per key.
 * Key should be namespaced, e.g. `msg:<userId>` or `search:<ip>`.
 */
export function checkRateLimit(
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

/** Client-facing message when the limiter denies a request (wrap in `{ error: ... }`). */
export function rateLimitExceeded(retryAfterMs: number): string {
  const secs = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `Too many requests. Please wait ${secs} second${secs === 1 ? "" : "s"} and try again.`;
}
