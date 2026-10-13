export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { writeFile, mkdir } from 'fs/promises';
import { randomBytes } from 'crypto';
import { join, basename, normalize, extname, resolve, sep } from 'path';


const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

// Sponsor logos are small brand marks shown at about 40px, so uploads into the
// sponsors folder get a tighter policy than the general 20 MB image uploads:
// only PNG, JPEG, WebP and SVG, and at most 2 MB.
const SPONSOR_FOLDER = 'sponsors';
const SPONSOR_ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
const SPONSOR_MAX_SIZE_BYTES = 2 * 1024 * 1024;

/** True when `dir` is the folder `root` itself or anywhere beneath it (compared case-insensitively). */
function isWithinFolder(dir: string, root: string): boolean {
  const target = resolve(dir).toLowerCase();
  const base = resolve(root).toLowerCase();
  return target === base || target.startsWith(base + sep);
}

/**
 * Create `safeName` in `dir` under a timestamp prefix, never overwriting an
 * existing file: the exclusive create fails with EEXIST on a collision and the
 * next attempt adds a random token. Returns the name that was written.
 */
async function writeUniqueFile(dir: string, safeName: string, data: Buffer): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const prefix = attempt === 0 ? `${Date.now()}` : `${Date.now()}-${randomBytes(3).toString('hex')}`;
    const finalName = `${prefix}-${safeName}`;
    try {
      await writeFile(join(dir, finalName), data, { flag: 'wx' });
      return finalName;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  throw new Error('Could not allocate a unique upload file name');
}

/**
 * True when the bytes are an SVG document: an optional XML declaration, comments
 * and doctype (design tools such as Illustrator write all three), then an <svg>
 * root element.
 */
function isSvgDocument(buffer: Buffer): boolean {
  let head = buffer.toString('utf-8', 0, Math.min(buffer.length, 8192)).replace(/^\uFEFF/, '');
  const prolog = /^\s*(?:<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|<!doctype[^>[]*(?:\[[\s\S]*?\])?\s*>)/i;
  for (let match = prolog.exec(head); match; match = prolog.exec(head)) {
    head = head.slice(match[0].length);
  }
  return /^\s*<svg[\s>]/i.test(head);
}

/**
 * An SVG is markup, and a browser that opens one directly runs any script inside
 * it. A logo needs no scripts, event handlers, script URLs or embedded documents,
 * so such files are refused. This is defence in depth: uploads are also served
 * with a sandboxing Content-Security-Policy, which any proxy in front of the app
 * has to pass through.
 */
const UNSAFE_SVG_PATTERNS = [
  /<\s*script\b/i,
  /\son[a-z]+\s*=/i,
  /javascript\s*:/i,
  /<\s*(?:iframe|object|embed|foreignObject)\b/i,
  /<!ENTITY/i,
];

function isInertSvg(buffer: Buffer): boolean {
  const text = buffer.toString('utf-8');
  return !UNSAFE_SVG_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Sniff the actual image type from the file's magic bytes. The extension
 * allowlist alone is spoofable — a caller could base64 an HTML/JS payload and
 * name it `.png`. We require the decoded bytes to actually be the image kind the
 * extension claims, so a non-image can never be written into public/uploads and
 * later served. Returns the detected kind, or null if it is not a known image.
 */
function sniffImageKind(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return 'gif';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(buffer.toString('ascii', 8, 32))) return 'avif';
  // SVG is text-based: accept only if it really is an SVG document.
  if (isSvgDocument(buffer)) return 'svg';
  return null;
}

// Map each allowed extension to the magic-byte kind it must match.
const EXT_TO_KIND: Record<string, string> = {
  '.jpg': 'jpg', '.jpeg': 'jpg', '.png': 'png', '.gif': 'gif',
  '.webp': 'webp', '.avif': 'avif', '.svg': 'svg',
};

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json() as { filename?: string; mimeType?: string; data?: string; folder?: string };
    const { filename, data: b64, folder = 'general' } = body;

    if (!filename || !b64) {
      return NextResponse.json({ error: 'filename and data required' }, { status: 400 });
    }
    if (typeof filename !== 'string' || typeof b64 !== 'string' || typeof folder !== 'string') {
      return NextResponse.json({ error: 'filename, data and folder must be text' }, { status: 400 });
    }

    const uploadsRoot = join(process.env.REPO_ROOT || process.cwd(), 'public', 'uploads');
    const safeFolder = normalize(folder).replace(/^(\.\.[/\\])+/, '').replace(/[^a-zA-Z0-9._\-/]/g, '_') || 'general';
    const uploadDir = join(uploadsRoot, safeFolder);
    if (!uploadDir.startsWith(uploadsRoot)) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
    }

    const isSponsorLogo = isWithinFolder(uploadDir, join(uploadsRoot, SPONSOR_FOLDER));
    const allowedExts = isSponsorLogo ? SPONSOR_ALLOWED_EXTS : ALLOWED_EXTS;
    const maxSizeBytes = isSponsorLogo ? SPONSOR_MAX_SIZE_BYTES : MAX_SIZE_BYTES;

    const ext = extname(filename).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: isSponsorLogo ? 'Logo must be a PNG, JPG, WebP or SVG file' : 'File type not allowed' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length > maxSizeBytes) {
      return NextResponse.json(
        { error: `File too large (max ${maxSizeBytes / (1024 * 1024)} MB)` },
        { status: 400 },
      );
    }

    // Verify the bytes actually are the image type the extension claims — the
    // extension allowlist alone is trivially spoofable.
    if (sniffImageKind(buffer) !== EXT_TO_KIND[ext]) {
      return NextResponse.json({ error: 'File content does not match an allowed image type' }, { status: 400 });
    }
    if (EXT_TO_KIND[ext] === 'svg' && !isInertSvg(buffer)) {
      return NextResponse.json({ error: 'SVG files must not contain scripts, event handlers or embedded content' }, { status: 400 });
    }

    // Sanitise the name (basename strips any path, the character class strips
    // everything but [A-Za-z0-9._-]) and cap the stem so the final name fits
    // comfortably within filesystem limits.
    const sanitised = basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safe = `${sanitised.slice(0, sanitised.length - ext.length).slice(0, 100)}${sanitised.slice(sanitised.length - ext.length)}`;
    await mkdir(uploadDir, { recursive: true });
    const finalName = await writeUniqueFile(uploadDir, safe, buffer);

    return NextResponse.json({ url: `/api/uploads/${safeFolder}/${finalName}`, filename: finalName });
  } catch (err) {
    console.error('[api/admin/upload] upload failed:', err);
    // Say what an operator can act on without exposing paths or internals.
    const code = (err as NodeJS.ErrnoException).code;
    const message =
      code === 'EACCES' || code === 'EPERM' || code === 'EROFS'
        ? 'The server cannot write to the uploads folder'
        : code === 'ENOSPC'
          ? 'The server is out of disk space'
          : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
