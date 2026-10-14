export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { logAdminAction } from '@/lib/audit';
import { clientIp } from '@/lib/newsletter';
import { fail, ok, readJsonObject, storeFailure } from '@/lib/email/api';
import { approvalState, type ApprovalState } from '@/lib/email/gate';
import { getLayout } from '@/lib/email/layout';
import {
  MAX_TEMPLATES,
  createEmailTemplate,
  deleteEmailTemplate,
  duplicateEmailTemplate,
  getBrandGuidelines,
  getEmailTemplates,
  setActiveVersion,
  updateEmailTemplate,
} from '@/lib/email/store';
import { FIELD_SAVE_LIMITS, WELCOME_TEMPLATE_KEY } from '@/lib/email/types';

/**
 * Admin email templates: list, create, duplicate, edit (an edit of the fields makes a new version), activate a
 * version for sending (only a version whose approval is bound to this exact content, layout and guidelines) and
 * delete. The quality review that approves a version is /api/admin/newsletter/review.
 *
 * GET also returns `states`: for every version of every template, whether its approval is still bound to the exact
 * content, layout and guidelines (approved), has never been earned (unapproved), or no longer applies (stale, and why).
 */

function audit(request: NextRequest, action: string, details: Record<string, unknown>) {
  try {
    logAdminAction('admin', action, '/api/admin/newsletter/templates', clientIp(request.headers), details);
  } catch { /* audit must not block the operation */ }
}

export const GET = withAuth(async () => {
  try {
    const layout = getLayout();
    const [templates, guidelines] = await Promise.all([getEmailTemplates(), getBrandGuidelines()]);
    const states: Record<string, Record<number, ApprovalState>> = {};
    for (const template of templates) {
      states[template.id] = {};
      for (const version of template.versions) states[template.id][version.version] = approvalState(version, layout, guidelines);
    }
    return ok({
      templates,
      states,
      guidelinesVersion: guidelines.version,
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
  if (body.activeVersion !== undefined && body.activeVersion !== null && !Number.isInteger(body.activeVersion)) {
    return fail('activeVersion must be a whole version number, or null to deactivate', 400);
  }
  try {
    let template = (await getEmailTemplates()).find((t) => t.id === body.id);
    if (!template) return fail('Template not found', 404);
    if (body.name !== undefined || body.enabled !== undefined || body.fields !== undefined || body.note !== undefined) {
      template = await updateEmailTemplate(body.id, { name: body.name, enabled: body.enabled, fields: body.fields, note: body.note });
      audit(request, 'EMAIL_TEMPLATE_UPDATE', { templateId: template.id, fields: body.fields !== undefined, enabled: body.enabled });
    }
    if (body.activeVersion !== undefined) {
      const layout = getLayout();
      const guidelines = await getBrandGuidelines();
      template = await setActiveVersion(body.id, body.activeVersion as number | null, (version) => {
        const state = approvalState(version, layout, guidelines);
        if (state.state === 'approved') return null;
        if (state.state === 'unapproved') return `Version ${version.version} has not passed the quality review, so it cannot be activated.`;
        return `The approval of version ${version.version} no longer applies (the ${state.reasons.join(' and ')} changed). Run the quality review again.`;
      });
      audit(request, 'EMAIL_TEMPLATE_ACTIVATE', { templateId: template.id, activeVersion: body.activeVersion });
    }
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
