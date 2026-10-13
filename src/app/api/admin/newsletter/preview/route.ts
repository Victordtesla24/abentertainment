export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fail, ok, readJsonObject, storeFailure } from '@/lib/email/api';
import { reviewContext } from '@/lib/email/gate';
import { runDeterministicChecks } from '@/lib/email/gate-rules';
import { getLayout } from '@/lib/email/layout';
import { BLANK_FIELDS, findVersion, getEmailSettings, getEmailTemplates, parseFieldsPatch } from '@/lib/email/store';

/**
 * Preview a draft: the message exactly as the brand layout renders it, with the deterministic checks that apply to
 * it (no AI call, nothing stored). POST {id?, version?, fields?}: start from a saved version and/or overlay fields.
 */

export const POST = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return fail('Invalid request', 400);
  try {
    let fields = { ...BLANK_FIELDS };
    if (typeof body.id === 'string') {
      const template = (await getEmailTemplates()).find((t) => t.id === body.id);
      const version = template && typeof body.version === 'number' ? findVersion(template, body.version) : undefined;
      if (!template || !version) return fail('Version not found', 404);
      fields = { ...fields, ...version.fields };
    }
    if (body.fields !== undefined) fields = { ...fields, ...parseFieldsPatch(body.fields) };
    const layout = getLayout();
    const outcome = runDeterministicChecks({ fields, settings: await getEmailSettings(), layout, ctx: reviewContext() });
    return ok({
      layout: { id: layout.id, version: layout.version, installed: layout.installed },
      fields,
      html: outcome.rendered?.html ?? null,
      text: outcome.rendered?.text ?? null,
      issues: outcome.issues,
    });
  } catch (err) {
    return storeFailure(err, 'preview');
  }
});
