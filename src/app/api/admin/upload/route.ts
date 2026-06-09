export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { writeFile, mkdir } from 'fs/promises';
import { join, basename, normalize, extname } from 'path';


const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

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
  // SVG is text-based: accept only if it actually opens an XML/SVG document.
  const head = buffer.toString('utf-8', 0, Math.min(buffer.length, 256)).replace(/^﻿/, '').trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) return 'svg';
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

    const ext = extname(filename).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });
    }

    // Verify the bytes actually are the image type the extension claims — the
    // extension allowlist alone is trivially spoofable.
    if (sniffImageKind(buffer) !== EXT_TO_KIND[ext]) {
      return NextResponse.json({ error: 'File content does not match an allowed image type' }, { status: 400 });
    }

    const uploadsRoot = join(process.env.REPO_ROOT || process.cwd(), 'public', 'uploads');
    const safeFolder = normalize(folder).replace(/^(\.\.[/\\])+/, '').replace(/[^a-zA-Z0-9._\-/]/g, '_') || 'general';
    const uploadDir = join(uploadsRoot, safeFolder);
    if (!uploadDir.startsWith(uploadsRoot)) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
    }

    const safe = basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = `${Date.now()}-${safe}`;
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, finalName), buffer);

    return NextResponse.json({ url: `/api/uploads/${safeFolder}/${finalName}`, filename: finalName });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
