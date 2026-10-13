#!/usr/bin/env node

/**
 * Copy data files to public/ so they can be fetched client-side.
 * Used by the global search modal (SearchModal.tsx) which needs
 * events data available as a static JSON endpoint.
 */

import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const PUBLIC_DATA_DIR = join(process.cwd(), 'public', 'data');

// Files whose public copy is a projection of the canonical file rather than a
// byte-for-byte copy. Must mirror serializePublicMirror() in src/lib/data.ts.
const PUBLIC_PROJECTIONS = {
  // Hidden metrics must never reach the publicly-served copy.
  'site-metrics.json': (metrics) => {
    if (!Array.isArray(metrics)) throw new Error('expected a JSON list');
    return metrics
      .filter((metric) => metric && metric.visible !== false)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
};

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
    'site-metrics.json',
    'testimonials.json',
    'pages.json',
    'settings.json',
  ];

  for (const file of files) {
    try {
      const project = PUBLIC_PROJECTIONS[file];
      if (project) {
        const canonical = JSON.parse(await readFile(join(DATA_DIR, file), 'utf-8'));
        await writeFile(join(PUBLIC_DATA_DIR, file), JSON.stringify(project(canonical), null, 2), 'utf-8');
      } else {
        await copyFile(join(DATA_DIR, file), join(PUBLIC_DATA_DIR, file));
      }
      console.log(`  Copied data/${file} → public/data/${file}`);
    } catch (err) {
      const reason = err && err.code === 'ENOENT' ? 'not found' : (err instanceof Error ? err.message : String(err));
      console.warn(`  Skipped data/${file} (${reason})`);
    }
  }
}

main().catch(console.error);
