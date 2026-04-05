import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isStaticExport = process.env.NEXT_EXPORT === 'true';
// Explicit workspace root for Turbopack — without this, Turbopack walks upward
// from the launch directory, finds the stray /Users/vics-macbook-pro/claude/General-Work/
// package.json + package-lock.json, and tries to resolve EVERY package (tailwindcss,
// postcss, etc.) from a non-existent parent node_modules — crashing the dev server
// with "Can't resolve 'tailwindcss' in '/Users/vics-macbook-pro/claude/General-Work'".
//
// Anchored to this file's directory (NOT process.cwd()) because the latter depends
// on the launch directory, while this config file always lives at the repo root.
// See: https://github.com/vercel/next.js/issues/82356 (findRootLockFile walks up)
//      https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
const repoRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Static export for Hostinger shared hosting (trailingSlash needed for static HTML paths)
  // Standalone output for VPS/Docker server mode (no trailingSlash to avoid 308 on API routes)
  ...(isStaticExport
    ? { output: 'export', trailingSlash: true }
    : { output: 'standalone' }),
  turbopack: {
    root: repoRoot,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['three', 'bcryptjs'],
  experimental: {
    // Inline all CSS to eliminate render-blocking stylesheets
    inlineCss: true,
  },
};

export default nextConfig;
