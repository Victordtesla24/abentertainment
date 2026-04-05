#!/usr/bin/env node

/**
 * Copy data files to public/ so they can be fetched client-side.
 * Used by the global search modal (SearchModal.tsx) which needs
 * events data available as a static JSON endpoint.
 */

import { copyFile, mkdir } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const PUBLIC_DATA_DIR = join(process.cwd(), 'public', 'data');

async function main() {
  await mkdir(PUBLIC_DATA_DIR, { recursive: true });

  // Must stay in sync with PUBLIC_MIRRORED in src/lib/data.ts — every file
  // an admin edit touches needs to land in public/data/ before the static
  // export is built, otherwise the deployed site serves stale data.
  const files = [
    'events.json',
    'sponsors.json',
    'gallery.json',
    'videos.json',
    'hero-images.json',
    'timeline.json',
    'testimonials.json',
    'pages.json',
    'settings.json',
  ];

  for (const file of files) {
    try {
      await copyFile(join(DATA_DIR, file), join(PUBLIC_DATA_DIR, file));
      console.log(`  Copied data/${file} → public/data/${file}`);
    } catch {
      console.warn(`  Skipped data/${file} (not found)`);
    }
  }
}

main().catch(console.error);
