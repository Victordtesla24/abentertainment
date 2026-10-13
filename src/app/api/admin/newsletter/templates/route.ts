export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { logAdminAction } from '@/lib/audit';
import { clientIp } from '@/lib/newsletter';
import { fail, ok, readJsonObject, storeFailure } from '@/lib/email/api';
import { getLayout } from '@/lib/email/layout';
import {
  MAX_TEMPLATES,
  createEmailTemplate,
  deleteEmailTemplate,
  duplicateEmailTemplate,
  getEmailTemplates,
  updateEmailTemplate,
} from '@/lib/email/store';
import { FIELD_SAVE_LIMITS, WELCOME_TEMPLATE_KEY } from '@/lib/email/types';

/**
 * Admin email templates: list, create, duplicate, edit (an edit of the fields makes a new version) and delete.
 * Reviewing, approving and activating a version are separate endpoints (the quality gate).
 */

function audit(request: NextRequest, action: string, details: Record<string, unknown>) {
  try {
    logAdminAction('admin', action, '/api/admin/newsletter/templates', clientIp(request.headers), details);
  } catch { /* audit must not block the operation */ }
}

export const GET = withAuth(async () => {
  try {
    const layout = getLayout();
    return ok({
      templates: await getEmailTemplates(),
      layout: { id: layout.id, version: layout.version, installed: layout.installed },
      welcomeKey: WELCOME_TEMPLATE_KEY,
      limits: { fields: FIELD_SAVE_LIMITS, maxTemplates: MAX_TEMPLATES },
    });
  } catch (err) {
    return storeFailure(err, 'read templates');
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return fail('Invalid request', 400);
  try {
    if (body.action === 'duplicate') {
      if (typeof body.id !== 'string') return fail('A template id is required', 400);
      const template = await duplicateEmailTemplate(body.id);
      audit(request, 'EMAIL_TEMPLATE_DUPLICATE', { templateId: template.id, from: body.id });
      return ok({ template }, 201);
    }
    if (body.action === undefined || body.action === 'create') {
      const template = await createEmailTemplate({ key: body.key, name: body.name });
      audit(request, 'EMAIL_TEMPLATE_CREATE', { templateId: template.id, key: template.key });
      return ok({ template }, 201);
    }
    return fail('Unknown action', 400);
  } catch (err) {
    return storeFailure(err, 'create template');
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body || typeof body.id !== 'string') return fail('A template id is required', 400);
  try {
    const template = await updateEmailTemplate(body.id, { name: body.name, enabled: body.enabled, fields: body.fields, note: body.note });
    audit(request, 'EMAIL_TEMPLATE_UPDATE', { templateId: template.id, fields: body.fields !== undefined, enabled: body.enabled });
    return ok({ template });
  } catch (err) {
    return storeFailure(err, 'update template');
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body || typeof body.id !== 'string') return fail('A template id is required', 400);
  try {
    const removed = await deleteEmailTemplate(body.id);
    audit(request, 'EMAIL_TEMPLATE_DELETE', { templateId: removed.id, key: removed.key });
    return ok({ success: true });
  } catch (err) {
    return storeFailure(err, 'delete template');
  }
});
