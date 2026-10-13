/**
 * Small helpers shared by the newsletter routes (the public signup and the admin list).
 *
 * Nothing here ever logs a whole address: failures are logged with the error's name and code
 * (never its message, which for a malformed JSON file can quote part of the file) and with the
 * address masked.
 */

/** "jane.doe@example.com" -> "j***@example.com": enough to recognise a record in a log, not to contact anyone. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** The error's name and code only, safe to log: its message may contain personal data. */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    return code ? `${err.name} ${code}` : err.name;
  }
  return 'unknown error';
}

/**
 * The page a visitor subscribed from, as sent by the footer form: a site-relative path such as
 * "/about/". Anything else (another shape, an absolute URL, odd characters, too long) is dropped to
 * an empty string, and a query string or fragment is cut off, so the stored value is always inert.
 */
export function sanitizeSourcePath(value: unknown): string {
  if (typeof value !== 'string') return '';
  const path = value.split(/[?#]/)[0];
  return /^\/[A-Za-z0-9/_.~%-]{0,199}$/.test(path) ? path : '';
}

/** The first address of x-forwarded-for (set by the host proxy), else x-real-ip, else "unknown". */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
