/**
 * API configuration — routes requests to the VPS API server
 * when running on static hosting (Hostinger), or to local
 * API routes when running on a Node.js server (localhost).
 */
export function getApiUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isLocal) return path;
  
  // Production: route API calls to VPS
  return 'https://187.77.12.13:8443' + path;
}
