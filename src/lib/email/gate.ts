/**
 * The quality gate: the fix loop that approves a template version, the approval's binding to exact content, and the
 * check made again at every send.
 *
 * Approval (runGate): each round runs the deterministic checks and, when they pass, the AI review. A failing round is
 * fixed by the AI for the failing fields only and reviewed again, up to the administrators' number of fix rounds.
 * Pass means every deterministic check is clean and the review passed every dimension at the threshold. If the AI
 * reviewer is unavailable or unusable the version is blocked: nothing is ever approved unreviewed.
 *
 * Sending (verifyForSend): no new AI call per email. The deterministic checks run again on the exact rendered message
 * (including the per-recipient unsubscribe link), and the version must carry an approval bound to the hash of this
 * exact content, this layout version and this brand-guidelines version. Any change to any of them voids the approval.
 */

import { AiInvalidResponseError, AiUnavailableError, type AiClient } from './ai-review';
import { buildRenderContext, publicBaseUrl } from './context';
import { runDeterministicChecks } from './gate-rules';
import { bindingHash, contentHash } from './hash';
import { EmailStoreError, findVersion, parseFieldsPatch } from './store';
import {
  AI_DIMENSIONS,
  EMAIL_FIELDS,
  type AiAttemptRecord,
  type AiReview,
  type BrandGuidelines,
  type EmailFieldName,
  type EmailFields,
  type EmailLayout,
  type EmailSettings,
  type EmailTemplate,
  type GateIssue,
  type GateResult,
  type GateRound,
  type GateStopReason,
  type RenderContext,
  type RenderedEmail,
  type TemplateApproval,
  type TemplateVersion,
} from './types';

/** The render context used for reviews and previews: the same shape as a real send, with a stand-in token. */
export function reviewContext(): RenderContext {
  return buildRenderContext(`${publicBaseUrl()}/api/newsletter/unsubscribe?t=preview`);
}

// ─── Pass logic ──────────────────────────────────────────────────────────────

/** A review passes only when it says pass, every dimension reaches the threshold, and no blocker or major issue is listed. */
export function aiPasses(review: AiReview, threshold: number): boolean {
  const scoresOk = AI_DIMENSIONS.every((dimension) => review.scores[dimension] >= threshold);
  const blocking = review.issues.some((found) => found.severity === 'blocker' || found.severity === 'major');
  return review.verdict === 'pass' && scoresOk && !blocking;
}

/** The issues that make a review fail: blockers and majors, plus a stated reason for any low score or bare "fail" verdict. */
export function failingAiIssues(review: AiReview, threshold: number): GateIssue[] {
  const listed = review.issues.filter((found) => found.severity !== 'minor');
  const covered = new Set(listed.map((found) => found.code));
  const synthetic: GateIssue[] = AI_DIMENSIONS.filter((dimension) => review.scores[dimension] < threshold && !covered.has(`ai_${dimension}`)).map((dimension) => ({
    source: 'ai',
    code: `ai_${dimension}`,
    field: 'global',
    message: `${dimension} scored ${review.scores[dimension]}, below the pass mark of ${threshold}.`,
    ...(review.summary ? { suggestion: review.summary } : {}),
    fixable: true,
    severity: 'major',
  }));
  if (listed.length === 0 && synthetic.length === 0 && review.verdict === 'fail') {
    synthetic.push({ source: 'ai', code: 'ai_verdict', field: 'global', message: `The reviewer did not pass the draft: ${review.summary || 'no reason given'}`, fixable: true, severity: 'major' });
  }
  return [...listed, ...synthetic];
}

/** The fields the AI fix may change, from the issues it is asked to resolve. */
export function changeableFields(issues: GateIssue[]): EmailFieldName[] {
  const allowed = new Set<EmailFieldName>();
  for (const found of issues) {
    switch (found.field) {
      case 'subject': case 'preheader': case 'eyebrow': case 'heading': case 'body':
        allowed.add(found.field);
        break;
      case 'cta':
        allowed.add('ctaLabel');
        allowed.add('ctaUrl');
        break;
      case 'global':
        for (const name of ['subject', 'preheader', 'eyebrow', 'heading', 'body', 'ctaLabel'] as const) allowed.add(name);
        break;
      default:
        break; // layout: not content
    }
  }
  return EMAIL_FIELDS.filter((name) => allowed.has(name));
}

/** Apply the AI's proposed fixes: only the changeable fields, and only if the result is valid content. */
export function applyFixes(fields: EmailFields, fixes: Partial<Record<EmailFieldName, string | null>>, changeable: readonly EmailFieldName[]): EmailFields {
  const patch: Partial<EmailFields> = {};
  for (const name of changeable) {
    const proposed = fixes[name];
    if (typeof proposed === 'string' && proposed.trim() !== (fields[name] ?? '').trim()) patch[name] = proposed;
  }
  if (Object.keys(patch).length === 0) return { ...fields };
  return { ...fields, ...parseFieldsPatch(patch) };
}

// ─── The fix loop ────────────────────────────────────────────────────────────

export interface GateDeps {
  layout: EmailLayout;
  ai: AiClient;
  ctx?: RenderContext;
  /** Called as each round finishes, so a long review can show its progress. */
  onRound?: (round: GateRound) => void;
  now?: () => Date;
}

export interface RunGateInput {
  fields: EmailFields;
  settings: EmailSettings;
  guidelines: BrandGuidelines;
}

/** The calls an AI error carries (every attempt made before giving up). */
function attemptsOf(err: unknown): AiAttemptRecord[] {
  return err instanceof AiUnavailableError || err instanceof AiInvalidResponseError ? err.attempts : [];
}

function safeAiMessage(err: unknown): string {
  return err instanceof AiUnavailableError || err instanceof AiInvalidResponseError ? err.message : 'The AI reviewer failed.';
}

export async function runGate(input: RunGateInput, deps: GateDeps): Promise<GateResult> {
  const now = deps.now ?? (() => new Date());
  const ctx = deps.ctx ?? reviewContext();
  const { settings, guidelines } = input;
  const startedAt = now().toISOString();
  const rounds: GateRound[] = [];
  let candidate: EmailFields = { ...input.fields };
  let passed = false;
  let stopReason: GateStopReason = 'max_rounds';

  for (let number = 1; ; number += 1) {
    const deterministic = runDeterministicChecks({ fields: candidate, settings, layout: deps.layout, ctx });
    const round: GateRound = { round: number, fieldsHash: contentHash(candidate), fields: { ...candidate }, deterministic: deterministic.issues, ai: null, passed: false };
    rounds.push(round);

    if (!deps.layout.installed) {
      stopReason = 'layout_not_installed';
      deps.onRound?.(round);
      break;
    }

    let aiPassed = false;
    if (deterministic.issues.length === 0 && deterministic.rendered) {
      try {
        const { attempts, ...review } = await deps.ai.review({ fields: candidate, plainText: deterministic.rendered.text, guidelines, threshold: settings.qualityThreshold, model: settings.reviewModel });
        round.ai = review;
        if (attempts?.length) round.aiAttempts = attempts; // kept once, on the round, so the stored result does not repeat itself
        aiPassed = aiPasses(round.ai, settings.qualityThreshold);
      } catch (err) {
        round.aiError = err instanceof AiInvalidResponseError ? 'invalid_response' : 'unavailable';
        round.aiErrorDetail = safeAiMessage(err);
        if (attemptsOf(err).length) round.aiAttempts = attemptsOf(err);
        stopReason = 'ai_unavailable';
        deps.onRound?.(round);
        break;
      }
    } else {
      round.aiError = 'skipped';
    }

    round.passed = deterministic.issues.length === 0 && aiPassed;
    if (round.passed) {
      passed = true;
      stopReason = 'passed';
      deps.onRound?.(round);
      break;
    }

    // not passed: fix the failing fields (if any may be fixed and any fix rounds remain), then go round again
    if (number - 1 >= settings.maxFixRounds) {
      stopReason = 'max_rounds';
      deps.onRound?.(round);
      break;
    }
    const failing = [...deterministic.issues, ...(round.ai ? failingAiIssues(round.ai, settings.qualityThreshold) : [])];
    const fixable = failing.filter((found) => found.fixable);
    const changeable = changeableFields(fixable);
    if (fixable.length === 0 || changeable.length === 0) {
      stopReason = 'unfixable';
      deps.onRound?.(round);
      break;
    }
    try {
      const fix = await deps.ai.fix({ fields: candidate, issues: fixable, changeable, guidelines, threshold: settings.qualityThreshold, model: settings.reviewModel, allowedLinkDomains: settings.allowedLinkDomains });
      if (fix.attempts?.length) round.fixAttempts = fix.attempts;
      const next = applyFixes(candidate, fix.fixes, changeable);
      round.fixedFields = EMAIL_FIELDS.filter((name) => next[name] !== candidate[name]);
      round.fixRationale = fix.rationale;
      if (round.fixedFields.length === 0) {
        stopReason = 'no_progress';
        deps.onRound?.(round);
        break;
      }
      candidate = next;
      deps.onRound?.(round);
    } catch (err) {
      if (attemptsOf(err).length) round.fixAttempts = attemptsOf(err);
      if (err instanceof AiUnavailableError) {
        round.fixError = safeAiMessage(err);
        stopReason = 'ai_unavailable';
      } else if (err instanceof EmailStoreError) {
        round.fixError = `The proposed fix was not valid content: ${err.message}`;
        stopReason = 'no_progress';
      } else {
        round.fixError = safeAiMessage(err);
        stopReason = 'no_progress';
      }
      deps.onRound?.(round);
      break;
    }
  }

  return {
    passed,
    stopReason,
    rounds,
    finalFields: candidate,
    finalHash: contentHash(candidate),
    startedAt,
    finishedAt: now().toISOString(),
    maxRounds: settings.maxFixRounds,
    threshold: settings.qualityThreshold,
  };
}

// ─── Approval binding ────────────────────────────────────────────────────────

/** The approval to store for content that has just passed (null when the gate did not pass). */
export function buildApproval(result: GateResult, layout: EmailLayout, guidelines: BrandGuidelines, now: Date = new Date()): TemplateApproval | null {
  if (!result.passed) return null;
  const passingRound = result.rounds[result.rounds.length - 1];
  const review = passingRound.ai;
  if (!review) return null;
  return {
    at: now.toISOString(),
    bindingHash: bindingHash({ fields: result.finalFields, layoutId: layout.id, layoutVersion: layout.version, guidelinesVersion: guidelines.version, guidelinesText: guidelines.text }),
    layoutId: layout.id,
    layoutVersion: layout.version,
    guidelinesVersion: guidelines.version,
    scores: review.scores,
    provider: review.provider,
    model: review.model,
    rounds: result.rounds.length,
  };
}

export type ApprovalState =
  | { state: 'approved' }
  | { state: 'unapproved' }
  | { state: 'stale'; reasons: Array<'content' | 'layout' | 'guidelines' | 'rules'> };

/** Is this version's approval bound to exactly this content, layout and guidelines? */
export function approvalState(version: TemplateVersion, layout: EmailLayout, guidelines: BrandGuidelines): ApprovalState {
  const approval = version.approval;
  if (!approval) return { state: 'unapproved' };
  const expected = bindingHash({ fields: version.fields, layoutId: layout.id, layoutVersion: layout.version, guidelinesVersion: guidelines.version, guidelinesText: guidelines.text });
  if (approval.bindingHash === expected && contentHash(version.fields) === version.hash) return { state: 'approved' };
  const reasons: Array<'content' | 'layout' | 'guidelines' | 'rules'> = [];
  if (contentHash(version.fields) !== version.hash) reasons.push('content');
  if (approval.layoutId !== layout.id || approval.layoutVersion !== layout.version) reasons.push('layout');
  if (approval.guidelinesVersion !== guidelines.version) reasons.push('guidelines');
  if (reasons.length === 0) reasons.push('guidelines', 'rules'); // same versions but a different hash: the text or the rule set changed
  return { state: 'stale', reasons };
}

// ─── The check at every send ─────────────────────────────────────────────────

export type SendRefusal = 'disabled' | 'no_active_version' | 'not_approved' | 'approval_stale' | 'layout_not_installed' | 'gate_failed';

export type SendCheck =
  | { ok: true; version: TemplateVersion; fields: EmailFields; rendered: RenderedEmail }
  | { ok: false; reason: SendRefusal; message: string; issues: GateIssue[] };

export interface VerifyForSendInput {
  template: EmailTemplate;
  /** A specific version to send (a test send); otherwise the active version. */
  version?: number;
  settings: EmailSettings;
  guidelines: BrandGuidelines;
  layout: EmailLayout;
  /** The real per-recipient context: the unsubscribe link for this address. */
  ctx: RenderContext;
}

export function verifyForSend(input: VerifyForSendInput): SendCheck {
  const { template, settings, guidelines, layout, ctx } = input;
  const refuse = (reason: SendRefusal, message: string, issues: GateIssue[] = []): SendCheck => ({ ok: false, reason, message, issues });
  if (!template.enabled) return refuse('disabled', `The template "${template.key}" is switched off.`);
  const number = input.version ?? template.activeVersion;
  if (number === null || number === undefined) return refuse('no_active_version', `The template "${template.key}" has no active version.`);
  const version = findVersion(template, number);
  if (!version) return refuse('no_active_version', `Version ${number} of "${template.key}" does not exist.`);
  if (!layout.installed) return refuse('layout_not_installed', 'No brand email layout is installed.');
  const state = approvalState(version, layout, guidelines);
  if (state.state === 'unapproved') return refuse('not_approved', `Version ${version.version} of "${template.key}" has not passed the quality review.`);
  if (state.state === 'stale') return refuse('approval_stale', `The approval of version ${version.version} no longer applies (the ${state.reasons.join(' and ')} changed). Run the quality review again.`);
  const outcome = runDeterministicChecks({ fields: version.fields, settings, layout, ctx });
  if (outcome.issues.length > 0 || !outcome.rendered) return refuse('gate_failed', `The rendered message fails ${outcome.issues.length} quality check(s).`, outcome.issues);
  return { ok: true, version, fields: version.fields, rendered: outcome.rendered };
}
