interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

const failedAttempts = new Map<string, AttemptRecord>();

const FREE_ATTEMPTS = 3;
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const SLIDING_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_BACKOFF_S = 30;

function getKey(ip: string, username: string): string {
  return `${ip}:${username}`;
}

function pruneStaleEntry(key: string, record: AttemptRecord): boolean {
  const elapsed = Date.now() - record.firstAttempt;
  if (elapsed > SLIDING_WINDOW_MS) {
    failedAttempts.delete(key);
    return true;
  }
  return false;
}

/**
 * Check whether a login attempt is allowed.
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }.
 */
export function checkLoginAllowed(
  ip: string,
  username: string
): { allowed: true } | { allowed: false; retryAfter: number } {
  const key = getKey(ip, username);
  const record = failedAttempts.get(key);

  if (!record) {
    return { allowed: true };
  }

  // Prune if outside sliding window
  if (pruneStaleEntry(key, record)) {
    return { allowed: true };
  }

  // Hard lockout at threshold
  if (record.count >= LOCKOUT_THRESHOLD) {
    const lockoutEnd = record.lastAttempt + LOCKOUT_DURATION_MS;
    const remaining = lockoutEnd - Date.now();
    if (remaining > 0) {
      return { allowed: false, retryAfter: Math.ceil(remaining / 1000) };
    }
    // Lockout expired -- reset
    failedAttempts.delete(key);
    return { allowed: true };
  }

  // Exponential backoff after free attempts
  if (record.count >= FREE_ATTEMPTS) {
    const exponent = record.count - FREE_ATTEMPTS; // 0, 1, 2, 3, ...
    const backoffS = Math.min(Math.pow(2, exponent), MAX_BACKOFF_S); // 1, 2, 4, 8, ... capped at 30
    const backoffEnd = record.lastAttempt + backoffS * 1000;
    const remaining = backoffEnd - Date.now();
    if (remaining > 0) {
      return { allowed: false, retryAfter: Math.ceil(remaining / 1000) };
    }
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt for a given IP and username.
 */
export function recordFailedAttempt(ip: string, username: string): void {
  const key = getKey(ip, username);
  const existing = failedAttempts.get(key);
  const now = Date.now();

  if (existing) {
    // Prune if outside sliding window and start fresh
    if (now - existing.firstAttempt > SLIDING_WINDOW_MS) {
      failedAttempts.set(key, { count: 1, firstAttempt: now, lastAttempt: now });
    } else {
      existing.count += 1;
      existing.lastAttempt = now;
    }
  } else {
    failedAttempts.set(key, { count: 1, firstAttempt: now, lastAttempt: now });
  }
}

/**
 * Clear failed attempts on successful login.
 */
export function clearFailedAttempts(ip: string, username: string): void {
  const key = getKey(ip, username);
  failedAttempts.delete(key);
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedAttempts) {
    if (now - record.firstAttempt > SLIDING_WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();
