export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { logAdminAction } from '@/lib/audit';
import { clientIp } from '@/lib/newsletter';
import { fail, ok, readJsonObject, storeFailure } from '@/lib/email/api';
import { getEmailSettings, parseSettingsPatch, updateEmailSettings } from '@/lib/email/store';

/** Admin email settings: fix-loop rounds, the quality threshold, the hourly send cap, allowed link domains, review model. */

export const GET = withAuth(async () => {
  try {
    return ok({ settings: await getEmailSettings() });
  } catch (err) {
    return storeFailure(err, 'read settings');
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return fail('Invalid request', 400);
  try {
    const settings = await updateEmailSettings(parseSettingsPatch(body));
    try {
      logAdminAction('admin', 'EMAIL_SETTINGS_UPDATE', '/api/admin/newsletter/settings', clientIp(request.headers), { keys: Object.keys(body) });
    } catch { /* audit must not block the operation */ }
    return ok({ settings });
  } catch (err) {
    return storeFailure(err, 'update settings');
  }
});
