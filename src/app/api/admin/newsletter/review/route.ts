export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { logAdminAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/redis';
import { clientIp, describeError } from '@/lib/newsletter';
import { fail, ok, readJsonObject, storeFailure } from '@/lib/email/api';
import { createAiClient } from '@/lib/email/ai-review';
import { buildApproval, runGate } from '@/lib/email/gate';
import { getLayout } from '@/lib/email/layout';
import type { GateRound } from '@/lib/email/types';
import { getReviewJob, reviewJobKey, startReviewJob, type ReviewJob } from '@/lib/email/review-jobs';
import { attemptsOfRound, recordReviewerAttempts } from '@/lib/email/reviewer-state';
import { findVersion, getBrandGuidelines, getEmailSettings, getEmailTemplates, recordGateOutcome } from '@/lib/email/store';

/**
 * Run the quality review (the fix loop) on one version of a template, and read its progress and result.
 *
 * POST {id, version} starts the review (or joins the one already running) and answers 200 with the whole result if it
 * finishes within a few seconds, otherwise 202 with the rounds so far; GET ?id=&version= returns the same body: the
 * running job, the finished job, or the review saved on the version. The result lists every round: the exact content
 * reviewed, the deterministic issues, the AI scores and issues, what the AI changed, and why the review stopped.
 * Reviews are limited per hour because each one spends AI calls.
 */

const FAST_MS = 20_000;

function jobBody(job: ReviewJob) {
  return {
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt ?? null,
    rounds: job.rounds,
    result: job.result ?? null,
    approvedVersion: job.approvedVersion ?? null,
    error: job.error ?? null,
  };
}

export const POST = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body || typeof body.id !== 'string' || typeof body.version !== 'number' || !Number.isInteger(body.version)) {
    return fail('A template id and a whole version number are required', 400);
  }
  try {
    const template = (await getEmailTemplates()).find((t) => t.id === body.id);
    if (!template) return fail('Template not found', 404);
    const version = findVersion(template, body.version);
    if (!version) return fail('Version not found', 404);
    const key = reviewJobKey(template.id, version.version);
    if (getReviewJob(key)?.status !== 'running') {
      const limit = await checkRateLimit('email-review', 20, 3600);
      if (!limit.allowed) return fail('Too many quality reviews in the last hour. Please try again shortly.', 429);
    }
    const [settings, guidelines] = await Promise.all([getEmailSettings(), getBrandGuidelines()]);
    const layout = getLayout();
    const ai = createAiClient();
    const { job, done } = startReviewJob(key, async (onRound) => {
      // each finished round also remembers what every model it called did, so the admin screen can say which judge is in use
      const remember = (round: GateRound) => {
        onRound(round);
        recordReviewerAttempts(attemptsOfRound(round)).catch((err) => console.error('[admin/newsletter] could not record the reviewer outcomes:', describeError(err)));
      };
      const result = await runGate({ fields: version.fields, settings, guidelines }, { layout, ai, onRound: remember });
      const { approvedVersion } = await recordGateOutcome(template.id, version.version, { result, approval: buildApproval(result, layout, guidelines) });
      return { result, approvedVersion };
    });
    try {
      logAdminAction('admin', 'EMAIL_REVIEW_RUN', '/api/admin/newsletter/review', clientIp(request.headers), { templateId: template.id, version: version.version });
    } catch { /* audit must not block the operation */ }
    const finished = await Promise.race([done, new Promise<null>((resolve) => setTimeout(() => resolve(null), FAST_MS))]);
    if (finished) {
      const after = (await getEmailTemplates()).find((t) => t.id === template.id) ?? null;
      return ok({ ...jobBody(finished), template: after });
    }
    return ok(jobBody(job), 202);
  } catch (err) {
    return storeFailure(err, 'start review');
  }
});

export const GET = withAuth(async (request: NextRequest) => {
  const id = request.nextUrl.searchParams.get('id') ?? '';
  const versionNumber = Number(request.nextUrl.searchParams.get('version'));
  if (!id || !Number.isInteger(versionNumber)) return fail('A template id and a whole version number are required', 400);
  try {
    const job = getReviewJob(reviewJobKey(id, versionNumber));
    if (job) return ok(jobBody(job));
    const template = (await getEmailTemplates()).find((t) => t.id === id);
    const version = template ? findVersion(template, versionNumber) : undefined;
    if (!template || !version) return fail('Version not found', 404);
    return ok({ status: 'idle', review: version.review ?? null, approval: version.approval ?? null });
  } catch (err) {
    return storeFailure(err, 'read review');
  }
});
