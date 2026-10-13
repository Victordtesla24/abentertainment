/**
 * Single source of truth for the responsive image variants of public/images.
 *
 * scripts/optimize-images.mjs generates the files described here at build time and
 * src/components/ui/OptimizedImage.tsx builds its <picture> markup from the same
 * plan, so the markup can never reference a variant that was not generated.
 * (A <source> that 404s does not fall back to the next <source>, so drift between
 * the two would produce broken images.)
 *
 * Paths are relative to public/images, use forward slashes, and are matched against
 * the SOURCE image (jpg/jpeg/png). Anything that does not match a profile — admin
 * uploads, remote URLs, files in other folders — is rendered as a plain <img>.
 *
 * Variant file names: <name>-<width>w.<avif|webp|fallback>. The width in the name is
 * nominal: variants are never upscaled, so for a source narrower than the nominal
 * width the file simply holds the source resolution.
 */

/** @typedef {{ id: string, match: RegExp, widths: readonly number[], fallback: 'jpg' | 'png' }} ImageProfile */

/** @type {readonly ImageProfile[]} */
export const IMAGE_PROFILES = [
  // Brand mark: alpha channel, so the legacy-format fallback stays PNG.
  { id: 'logo', match: /^AB_Logo_transparent\.png$/, widths: [64, 128, 256], fallback: 'png' },
  // Full-bleed page banners (PageHero).
  { id: 'banner', match: /^heroes\/[^/]+\.(?:png|jpe?g)$/i, widths: [640, 1024, 1536], fallback: 'jpg' },
  // Home hero slideshow.
  { id: 'slide', match: /^hero-[^/]+\.(?:png|jpe?g)$/i, widths: [640, 1024, 1536, 1920], fallback: 'jpg' },
  // Timeline chapter art and the video poster.
  { id: 'chapter', match: /^timeline\/[^/]+\.(?:png|jpe?g)$/i, widths: [640, 1024, 1376], fallback: 'jpg' },
  // Event posters (cards, detail page).
  { id: 'poster', match: /^events\/[^/]+\.(?:png|jpe?g)$/i, widths: [480, 640, 940], fallback: 'jpg' },
  // Gallery photography.
  { id: 'photo', match: /^gallery\/[^/]+\.(?:png|jpe?g)$/i, widths: [480, 640, 1024], fallback: 'jpg' },
  // Team portraits.
  { id: 'portrait', match: /^team\/[^/]+\.(?:png|jpe?g)$/i, widths: [160, 320, 480], fallback: 'jpg' },
];

/** Generated file extensions, in <picture> source order. */
export const MODERN_FORMATS = /** @type {const} */ (['avif', 'webp']);

/**
 * @param {string} relPath path relative to public/images, e.g. "heroes/events-hero.png"
 * @returns {ImageProfile | null}
 */
export function profileFor(relPath) {
  return IMAGE_PROFILES.find((profile) => profile.match.test(relPath)) ?? null;
}

/**
 * Variant path (relative to public/images) for a source, width and format.
 * @param {string} relPath
 * @param {number} width
 * @param {string} format
 */
export function variantPath(relPath, width, format) {
  return relPath.replace(/\.[^./]+$/, '') + '-' + width + 'w.' + format;
}

/** True for generated variants so the optimiser never treats them as sources. */
export function isVariantFile(relPath) {
  return /-\d+w\.(?:avif|webp|jpe?g|png)$/i.test(relPath);
}
