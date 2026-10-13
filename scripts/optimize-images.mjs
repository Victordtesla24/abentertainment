#!/usr/bin/env node

/**
 * Build-time image optimisation for the static export.
 *
 * Next.js image optimisation is disabled (output: 'export'), so responsive
 * variants are generated here and served as plain files. For every source image
 * (jpg/jpeg/png) that matches a profile in scripts/image-profiles.mjs this writes
 * <name>-<width>w.avif, <name>-<width>w.webp and a legacy fallback
 * <name>-<width>w.jpg (or .png when the artwork has transparency) for each
 * nominal width. OptimizedImage builds its <picture> markup from the same plan.
 *
 * Idempotent: existing outputs are left untouched, so the generated files can be
 * committed and only new sources cost time. Any failure aborts the build — a
 * missing variant would otherwise ship as a broken image.
 *
 * Usage:
 *   node scripts/optimize-images.mjs
 */

import { readdir, access, rename, unlink } from 'node:fs/promises';
import { join, extname, relative, sep } from 'node:path';
import sharp from 'sharp';
import { MODERN_FORMATS, isVariantFile, profileFor, variantPath } from './image-profiles.mjs';

const IMAGES_DIR = join(process.cwd(), 'public', 'images');
const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
/** Site background — used to flatten transparent artwork when the fallback is JPEG. */
const FLATTEN_BACKGROUND = '#0A0A0A';

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** @param {import('sharp').Sharp} pipeline */
function encode(pipeline, format, hasAlpha) {
  switch (format) {
    case 'avif':
      return pipeline.avif({ quality: 50, effort: 5 });
    case 'webp':
      return pipeline.webp({ quality: 78, effort: 5 });
    case 'jpg':
      return (hasAlpha ? pipeline.flatten({ background: FLATTEN_BACKGROUND }) : pipeline).jpeg({
        quality: 80,
        mozjpeg: true,
        progressive: true,
      });
    case 'png':
      return pipeline.png({ compressionLevel: 9, palette: true, quality: 85, effort: 7 });
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}

async function generateVariants(sourcePath, relPath, profile) {
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width) throw new Error(`Cannot read dimensions of ${relPath}`);

  const formats = [...MODERN_FORMATS, profile.fallback];
  let created = 0;

  for (const width of profile.widths) {
    for (const format of formats) {
      const outPath = join(IMAGES_DIR, variantPath(relPath, width, format));
      if (await exists(outPath)) continue;

      // Never upscale: a source narrower than the nominal width keeps its own resolution.
      const pipeline = sharp(sourcePath).rotate().resize({ width: Math.min(width, metadata.width), withoutEnlargement: true });
      // Write-then-rename: an interrupted run can never leave a truncated file that the
      // "already exists" check above would accept as finished.
      const partialPath = `${outPath}.partial`;
      await encode(pipeline, format, Boolean(metadata.hasAlpha)).toFile(partialPath);
      await rename(partialPath, outPath);
      created++;
      console.log(`  + ${variantPath(relPath, width, format)}`);
    }
  }
  return created;
}

async function main() {
  console.log('Optimizing images for static export...\n');

  let sources = 0;
  let created = 0;

  try {
    for await (const filePath of walk(IMAGES_DIR)) {
      if (filePath.endsWith('.partial')) {
        await unlink(filePath); // debris from an interrupted run
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(extname(filePath).toLowerCase())) continue;
      const relPath = relative(IMAGES_DIR, filePath).split(sep).join('/');
      if (isVariantFile(relPath)) continue;
      const profile = profileFor(relPath);
      if (!profile) continue;
      sources++;
      created += await generateVariants(filePath, relPath, profile);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('  No public/images/ directory found - skipping.\n');
      return;
    }
    throw err;
  }

  console.log(`\nDone: ${sources} source images checked, ${created} variants created.\n`);
}

main().catch((err) => {
  console.error('Image optimization failed:', err);
  process.exit(1);
});
