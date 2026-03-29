/**
 * API configuration — routes requests through PHP proxy on Hostinger
 * which forwards to VPS Node.js server. This avoids CORS and SSL issues
 * since requests stay on the same domain.
 *
 * Production: /api/chat → /api/chat.php (PHP proxy → VPS:3001)
 * Localhost:   /api/chat → /api/chat (Next.js API route)
 */
export function getApiUrl(path: string): string {
  if (typeof window === 'undefined') return path;

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) return path;

  // Production: append .php to use the PHP proxy
  // Remove trailing slash first, then add .php
  const cleanPath = path.replace(/\/+$/, '');
  return cleanPath + '.php';
}
