#!/usr/bin/env node

/**
 * Build-time image optimization for static export (#13).
 *
 * Since Next.js image optimization is disabled (output: 'export'),
 * this script generates responsive WebP variants at build time.
 *
 * Usage:
 *   node scripts/optimize-images.mjs
 *
 * What it does:
 *   - Scans public/images/ for JPG/PNG files
 *   - Generates WebP versions alongside originals
 *   - Creates responsive sizes (640w, 1024w) for hero/event images
 *   - Skips already-optimized files (idempotent)
 */

import { readdir, stat, access } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = join(process.cwd(), 'public', 'images');
const RESPONSIVE_WIDTHS = [640, 1024];
const QUALITY_WEBP = 80;
const QUALITY_AVIF = 50;
const QUALITY_JPEG = 85;
const MAX_FILE_SIZE_KB = 200;

// Directories that benefit from responsive sizes
const RESPONSIVE_DIRS = ['heroes', 'events', 'gallery'];

async function* walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else {
      yield fullPath;
    }
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function optimizeImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return;

  const name = basename(filePath, ext);
  const dir = dirname(filePath);
  const relDir = dir.replace(PUBLIC_DIR, '').replace(/^\//, '');

  // 1. Generate WebP version of original
  const webpPath = join(dir, `${name}.webp`);
  if (!(await fileExists(webpPath))) {
    try {
      await sharp(filePath)
        .webp({ quality: QUALITY_WEBP, effort: 6 })
        .toFile(webpPath);
      console.log(`  ✓ WebP: ${relDir}/${name}.webp`);
    } catch (err) {
      console.warn(`  ✗ Failed WebP for ${name}: ${err.message}`);
    }
  }

  // 1b. Generate AVIF version of original (best compression)
  const avifPath = join(dir, `${name}.avif`);
  if (!(await fileExists(avifPath))) {
    try {
      await sharp(filePath)
        .avif({ quality: QUALITY_AVIF, effort: 5 })
        .toFile(avifPath);
      console.log(`  ✓ AVIF: ${relDir}/${name}.avif`);
    } catch (err) {
      console.warn(`  ✗ Failed AVIF for ${name}: ${err.message}`);
    }
  }

  // 2. Generate responsive sizes for hero/event/gallery images
  const shouldResize = RESPONSIVE_DIRS.some((d) => relDir.startsWith(d));
  if (!shouldResize) return;

  const metadata = await sharp(filePath).metadata();
  if (!metadata.width) return;

  for (const width of RESPONSIVE_WIDTHS) {
    if (width >= metadata.width) continue; // Don't upscale

    const resizedName = `${name}-${width}w`;

    // Resized AVIF (best compression)
    const resizedAvif = join(dir, `${resizedName}.avif`);
    if (!(await fileExists(resizedAvif))) {
      try {
        await sharp(filePath)
          .resize(width)
          .avif({ quality: QUALITY_AVIF, effort: 5 })
          .toFile(resizedAvif);
        console.log(`  ✓ ${width}w AVIF: ${relDir}/${resizedName}.avif`);
      } catch (err) {
        console.warn(`  ✗ Failed ${width}w AVIF for ${name}: ${err.message}`);
      }
    }

    // Resized WebP
    const resizedWebp = join(dir, `${resizedName}.webp`);
    if (!(await fileExists(resizedWebp))) {
      try {
        await sharp(filePath)
          .resize(width)
          .webp({ quality: QUALITY_WEBP, effort: 6 })
          .toFile(resizedWebp);
        console.log(`  ✓ ${width}w WebP: ${relDir}/${resizedName}.webp`);
      } catch (err) {
        console.warn(`  ✗ Failed ${width}w WebP for ${name}: ${err.message}`);
      }
    }

    // Resized JPEG/PNG (fallback)
    const resizedJpeg = join(dir, `${resizedName}${ext}`);
    if (!(await fileExists(resizedJpeg))) {
      try {
        await sharp(filePath)
          .resize(width)
          .jpeg({ quality: QUALITY_JPEG })
          .toFile(resizedJpeg);
        console.log(`  ✓ ${width}w JPEG: ${relDir}/${resizedName}${ext}`);
      } catch (err) {
        console.warn(`  ✗ Failed ${width}w JPEG for ${name}: ${err.message}`);
      }
    }
  }
}

async function main() {
  console.log('🖼  Optimizing images for static export...\n');

  let count = 0;
  try {
    for await (const filePath of walkDir(PUBLIC_DIR)) {
      const ext = extname(filePath).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        // Skip already-generated responsive variants
        if (/-\d+w\.(jpg|jpeg|png|webp|avif)$/.test(filePath)) continue;
        // Skip AVIF files (they are generated, not source)
        if (extname(filePath).toLowerCase() === '.avif') continue;
        await optimizeImage(filePath);
        count++;
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('  No public/images/ directory found — skipping.\n');
      return;
    }
    throw err;
  }

  console.log(`\n✅ Processed ${count} source images.\n`);
}

main().catch((err) => {
  console.error('Image optimization failed:', err);
  process.exit(1);
});
