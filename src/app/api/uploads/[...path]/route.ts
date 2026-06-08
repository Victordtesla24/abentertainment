export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname, normalize } from 'path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filePath = normalize(segments.join('/'));

  // Prevent directory traversal
  if (filePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
  }

  const fullPath = join(process.env.REPO_ROOT || process.cwd(), 'public', 'uploads', filePath);

  try {
    const buffer = await readFile(fullPath);
    const headers: Record<string, string> = {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Never let the browser MIME-sniff an uploaded file into something
      // executable regardless of its declared type.
      'X-Content-Type-Options': 'nosniff',
    };
    // SVGs are XML and can carry <script>/onload — served same-origin they
    // would otherwise be a stored-XSS vector when navigated to directly.
    // Sandbox + CSP neutralises any embedded script while still rendering the
    // image inline (and as the src of an <img>, which never executes script).
    if (ext === '.svg') {
      headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
      headers['Content-Disposition'] = 'inline';
    }
    return new NextResponse(buffer, { headers });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
