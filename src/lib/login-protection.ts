/**
 * Login protection — disabled.
 * No lockout or rate limiting is applied. All login attempts are always allowed.
 */

/**
 * Always allows the login attempt. No lockout is applied.
 */
export function checkLoginAllowed(
  _ip: string,
  _username: string
): { allowed: true } {
  return { allowed: true };
}

/**
 * No-op — lockout is disabled.
 */
export function recordFailedAttempt(_ip: string, _username: string): void {
  // intentionally empty
}

/**
 * No-op — lockout is disabled.
 */
export function clearFailedAttempts(_ip: string, _username: string): void {
  // intentionally empty
}
