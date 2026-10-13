export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { logAdminAction } from '@/lib/audit';
import { clientIp } from '@/lib/newsletter';
import { fail, ok, readJsonObject, storeFailure } from '@/lib/email/api';
import { GUIDELINES_MAX_CHARS, GUIDELINES_MIN_CHARS, getBrandGuidelines, parseGuidelinesText, saveBrandGuidelines } from '@/lib/email/store';

/**
 * The written brand-voice guidelines the AI reviewer judges every email against. Editing them raises the
 * version, which voids every template approval until the template is reviewed again under the new rules.
 */

export const GET = withAuth(async () => {
  try {
    return ok({ guidelines: await getBrandGuidelines(), limits: { min: GUIDELINES_MIN_CHARS, max: GUIDELINES_MAX_CHARS } });
  } catch (err) {
    return storeFailure(err, 'read guidelines');
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return fail('Invalid request', 400);
  try {
    const guidelines = await saveBrandGuidelines(parseGuidelinesText(body.text), 'admin');
    try {
      logAdminAction('admin', 'EMAIL_GUIDELINES_UPDATE', '/api/admin/newsletter/guidelines', clientIp(request.headers), { version: guidelines.version });
    } catch { /* audit must not block the operation */ }
    return ok({ guidelines });
  } catch (err) {
    return storeFailure(err, 'update guidelines');
  }
});
