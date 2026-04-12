export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { writeFile, mkdir } from 'fs/promises';
import { join, basename, normalize, extname } from 'path';


const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

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
