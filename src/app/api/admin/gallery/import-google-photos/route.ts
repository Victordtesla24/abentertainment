export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { withAuth } from '@/lib/with-auth';
import {
  getGalleryImages,
  saveGalleryImages,
  getEvents,
  saveEvents,
  type GalleryImage,
} from '@/lib/data';
import { revalidateGallery, revalidateEvents } from '@/lib/revalidate';

/**
 * Import every photo from a PUBLIC Google Photos shared album into the gallery
 * (optionally attached to an event), so an admin can paste one album link
 * instead of uploading dozens of files by hand.
 *
 * A Google Photos *album* link (https://photos.app.goo.gl/…) is an HTML page,
 * NOT a direct image — pasting it into an image field renders nothing. This
 * route resolves the album server-side, extracts each photo's CDN URL, then
 * DOWNLOADS and RE-HOSTS each image locally (via the same public/uploads
 * convention the upload route uses). Re-hosting is deliberate: Google rotates
 * the lh3 CDN URLs, so hotlinking them would eventually 403 — local copies keep
 * the public site rendering. Persistence goes through saveGalleryImages /
 * saveEvents (which write to the runtime data dir the public APIs read), so the
 * imported photos appear on the live site within one realtime-poll cycle.
 */

const ALLOWED_HOSTS = new Set(['photos.app.goo.gl', 'photos.google.com']);
// A real desktop UA is required — Google serves a stripped JS shell WITHOUT the
// embedded photo URLs to non-browser / minimal user agents.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_PHOTOS = 150; // safety cap so one album can't flood the gallery
const DOWNLOAD_CONCURRENCY = 5;
const WEB_SIZE = '=w2400'; // bounded high-res (orig can be 20MP+); '=s0' = originals
const PER_IMAGE_TIMEOUT_MS = 20_000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // per-image cap (mirrors the upload route's bound)
// Stop scheduling downloads after this so we ALWAYS respond before the 60s
// Hostinger PHP proxy / route maxDuration hard-abort. Otherwise the proxy
// returns a false 502 while the route keeps persisting rows → the admin
// re-imports and creates duplicates.
const IMPORT_DEADLINE_MS = 50_000;

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname);
}

function isAllowedAlbumUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && isAllowedHost(u.hostname);
  } catch {
    return false;
  }
}

/** Pick a file extension from the download's content-type so a PNG/WebP isn't mislabeled as .jpg (it would break under the nosniff header on the serving route). */
function extFromContentType(contentType: string | null): string {
  switch ((contentType || '').split(';')[0].trim().toLowerCase()) {
    case 'image/png': return '.png';
    case 'image/webp': return '.webp';
    case 'image/gif': return '.gif';
    case 'image/avif': return '.avif';
    default: return '.jpg';
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export const POST = withAuth(async (request: NextRequest) => {
  let body: { albumUrl?: string; eventId?: string; category?: string; setEventCover?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const albumUrl = (body.albumUrl || '').trim();
  const eventId = body.eventId?.trim() || undefined;
  const category = (body.category || 'event').trim() || 'event';

  if (!albumUrl) {
    return NextResponse.json({ error: 'albumUrl is required' }, { status: 400 });
  }
  // SSRF guard: only ever fetch Google Photos hosts, never an arbitrary URL.
  if (!isAllowedAlbumUrl(albumUrl)) {
    return NextResponse.json(
      { error: 'Only public Google Photos album links (photos.app.goo.gl or photos.google.com) are supported.' },
      { status: 400 },
    );
  }

  // 1) Fetch the album page (following the goo.gl shortlink redirect).
  let html: string;
  try {
    const res = await fetch(albumUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    });
    // Re-validate the FINAL host after redirects (the goo.gl shortlink follows to
    // photos.google.com) — the initial allowlist check can't cover a redirect target.
    try {
      if (!isAllowedHost(new URL(res.url).hostname)) {
        return NextResponse.json({ error: 'The album link redirected to an unexpected host.' }, { status: 400 });
      }
    } catch { /* res.url is always parseable */ }
    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Photos returned HTTP ${res.status}. Make sure the album link is public.` },
        { status: 502 },
      );
    }
    html = await res.text();
  } catch {
    return NextResponse.json(
      { error: 'Could not reach Google Photos. Check the link and try again.' },
      { status: 502 },
    );
  }

  // 2) Extract unique photo base URLs + best-effort real dimensions.
  // Regexes are request-local (global regexes carry lastIndex state that would
  // be unsafe to share across concurrent imports).
  // lh3 album-content base URL (size suffix stripped) — a photo's stable identity.
  const baseUrlRe = /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9_-]+/g;
  // `["<baseUrl>…",<width>,<height>` inside the album bootstrap JSON.
  const dimensionRe = /\["(https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9_-]+)[^"]*",(\d+),(\d+)/g;

  const bases = Array.from(new Set(html.match(baseUrlRe) ?? []));
  if (bases.length === 0) {
    return NextResponse.json(
      {
        error:
          'No photos found in that album. The link may be private, expired, or require sign-in — open it in an incognito window to confirm it is publicly shared.',
      },
      { status: 422 },
    );
  }
  const dims = new Map<string, { width: number; height: number }>();
  for (const m of html.matchAll(dimensionRe)) {
    dims.set(m[1], { width: Number(m[2]), height: Number(m[3]) });
  }

  const selected = bases.slice(0, MAX_PHOTOS);

  // 3) Download + re-host each photo locally.
  const uploadsRoot = join(process.env.REPO_ROOT || process.cwd(), 'public', 'uploads');
  const uploadDir = join(uploadsRoot, 'gallery');
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Server could not prepare the upload directory: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 },
    );
  }

  const stamp = Date.now();
  const deadline = stamp + IMPORT_DEADLINE_MS;
  const downloaded = await runWithConcurrency(selected, DOWNLOAD_CONCURRENCY, async (base, i) => {
    // Out of time budget — skip the rest so we respond before the 60s proxy abort.
    if (Date.now() > deadline) return null;
    try {
      const res = await fetch(`${base}${WEB_SIZE}`, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(PER_IMAGE_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      // Bound memory: skip an image that declares (or turns out to be) too large.
      if (Number(res.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
      const filename = `${stamp}-gphotos-${i + 1}${extFromContentType(res.headers.get('content-type'))}`;
      await writeFile(join(uploadDir, filename), buffer);
      const d = dims.get(base);
      return {
        src: `/api/uploads/gallery/${filename}`,
        width: d?.width || 1600,
        height: d?.height || 1067,
      };
    } catch {
      return null;
    }
  });

  const ok = downloaded.filter((d): d is { src: string; width: number; height: number } => d !== null);
  if (ok.length === 0) {
    return NextResponse.json(
      { error: 'Found photos but could not download any of them from Google. Please try again.' },
      { status: 502 },
    );
  }

  // 4) Create gallery rows (one batched write through the proven data path).
  const existing = await getGalleryImages();
  const created: GalleryImage[] = ok.map((d, i) => ({
    id: `img-${stamp}-${i + 1}`,
    src: d.src,
    alt: '',
    eventId,
    category,
    width: d.width,
    height: d.height,
    createdAt: new Date(stamp + i).toISOString(),
  }));
  await saveGalleryImages([...existing, ...created]);
  revalidateGallery();

  // 5) Optionally set the event's cover image if it doesn't have one yet.
  let eventUpdated = false;
  let coverSrc: string | undefined;
  if (eventId && body.setEventCover !== false) {
    const events = await getEvents();
    const idx = events.findIndex((e) => e.id === eventId);
    if (idx !== -1) {
      const ev = events[idx];
      const cover = created[0].src;
      let changed = false;
      if (!ev.image) {
        ev.image = cover;
        changed = true;
      }
      if (!ev.heroImage) {
        ev.heroImage = cover;
        changed = true;
      }
      if (changed) {
        ev.updatedAt = new Date().toISOString();
        events[idx] = ev;
        await saveEvents(events);
        revalidateEvents();
        eventUpdated = true;
        coverSrc = cover;
      }
    }
  }

  return NextResponse.json({
    imported: created.length,
    found: bases.length,
    skipped: selected.length - ok.length,  // photos that failed to download
    truncated: Math.max(0, bases.length - selected.length), // photos beyond MAX_PHOTOS not attempted
    eventUpdated,
    coverSrc,
    images: created,
  });
});
