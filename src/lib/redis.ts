/**
 * In-memory rate limiter — replaces Upstash Redis.
 * Uses a sliding window token bucket algorithm stored in-process memory.
 * For production, swap with PostgreSQL or local Redis on VPS.
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_MAX_TOKENS = 20;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

/**
 * Check rate limit for a given identifier (e.g., IP address).
 * Returns whether the request is allowed and when the limit resets.
 */
export async function checkRateLimit(
  identifier: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  windowSeconds: number = DEFAULT_WINDOW_MS / 1000
): Promise<{ allowed: boolean; resetIn: number; remaining: number }> {
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const key = `rl:${identifier}`;

  let entry = store.get(key);

  if (!entry) {
    entry = { tokens: maxTokens, lastRefill: now };
    store.set(key, entry);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - entry.lastRefill;
  const refillRate = maxTokens / windowMs;
  const tokensToAdd = elapsed * refillRate;
  entry.tokens = Math.min(maxTokens, entry.tokens + tokensToAdd);
  entry.lastRefill = now;

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return {
      allowed: true,
      resetIn: Math.ceil((1 / refillRate)),
      remaining: Math.floor(entry.tokens),
    };
  }

  const waitTime = Math.ceil((1 - entry.tokens) / refillRate);
  return {
    allowed: false,
    resetIn: waitTime,
    remaining: 0,
  };
}

// Cleanup stale entries every 5 minutes
if (typeof globalThis !== 'undefined') {
  const CLEANUP_INTERVAL = 5 * 60 * 1000;
  const STALE_THRESHOLD = 10 * 60 * 1000;

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.lastRefill > STALE_THRESHOLD) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL).unref?.();
}
