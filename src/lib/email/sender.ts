/**
 * Sending: the welcome email on subscription, queued sends, and the admin's test sends.
 *
 * Nothing leaves this module unless the quality gate's verifyForSend passes for the EXACT message that is about to
 * go out: the approved version of the template, rendered for this recipient with their own unsubscribe link, with every
 * deterministic check run again and the approval's binding (content, layout, guidelines, rules) verified. There is no
 * new AI call per email, and an unapproved, edited, stale, disabled or failing template sends nothing.
 *
 * Triggering. A new subscriber is saved first and the response goes back; the welcome attempt then runs in the same
 * process, after the response (queueWelcome), and can never fail the subscription: whatever happens is written to the
 * send log and to the subscriber's welcome state. A welcome that cannot go yet (not configured, not approved, the
 * provider not ready, a cap, a temporary error) stays "pending" and is retried: by the in-process sweeper every few
 * minutes while the server runs, and whenever an admin presses "send pending". Each attempt claims the subscriber
 * first (pending -> sending, under the list lock) so two attempts can never both send, and the provider gets an
 * Idempotency-Key per subscriber and template version, so even a retry after a crash cannot deliver twice.
 *
 * Subscribers who joined before this capability have no welcome state and are never sent one.
 */

import { randomUUID } from 'crypto';
import { getNewsletterSubscribers, updateNewsletterSubscriber, type NewsletterSubscriber, type WelcomeState } from '@/lib/data';
import { describeError, maskEmail } from '@/lib/newsletter';
import { configuredAiProviders, reviewerChain } from './ai-review';
import { buildRenderContext, publicBaseUrl } from './context';
import { approvalState, reviewContext, verifyForSend } from './gate';
import { getLayout } from './layout';
import { isBlocked, readProviderState, recordProviderAttempt, type ProviderState } from './provider-state';
import { isEmailAddress, readResendConfig, sendViaResend, type OutboundEmail, type ResendResult } from './resend';
import { appendSendLog, countSentLastHour, reserveSendSlot, settleSendLog, type NewSendLogEntry, type SendOutcome } from './send-log';
import { getBrandGuidelines, getEmailSettings, getEmailTemplateByKey, findVersion } from './store';
import { NoSigningSecretError, TEST_SUBSCRIBER_ID, mintUnsubscribeToken, resolveSigningSecret } from './unsubscribe-token';
import { WELCOME_TEMPLATE_KEY, type EmailLayout } from './types';

type Env = Record<string, string | undefined>;

export interface SenderDeps {
  fetchImpl?: typeof fetch;
  env?: Env;
  now?: () => Date;
  /** The layout to render with (tests); the app's layout otherwise. */
  layout?: EmailLayout;
  /** What started the attempt. An automatic retry that meets the same blocker as last time is not logged again. */
  source?: 'signup' | 'sweep' | 'admin';
}

/** A "sending" claim older than this is taken to be a crashed attempt and may be retried. */
export const STALE_CLAIM_MS = 10 * 60_000;
export const SWEEP_DELAY_MS = 5 * 60_000;
const MAX_CONSECUTIVE_SWEEPS = 288; // a day of five-minute sweeps without anything left to do

/** Blockers that affect every subscriber alike: a queued run stops at the first one instead of trying each address. */
const GLOBAL_BLOCKERS = new Set([
  'not_configured', 'no_signing_secret', 'no_template', 'no_active_version', 'not_approved', 'approval_stale', 'layout_not_installed', 'gate_failed',
  'hourly_cap', 'provider_not_ready', 'provider_rate_limited', 'provider_unavailable',
]);

export type WelcomeAttempt =
  | { result: 'sent'; messageId: string }
  | { result: 'pending'; reason: string }
  | { result: 'failed'; reason: string }
  | { result: 'skipped'; reason: string }
  | { result: 'already'; status: WelcomeState['status'] }
  | { result: 'in_progress' }
  | { result: 'not_found' };

const isoNow = (now: () => Date) => now().toISOString();

function isStaleClaim(welcome: WelcomeState, now: Date): boolean {
  return welcome.status === 'sending' && (!welcome.attemptedAt || now.getTime() - Date.parse(welcome.attemptedAt) > STALE_CLAIM_MS);
}

/** The recipient's one-click unsubscribe link: the public site, the unsubscribe endpoint and a signed token. */
export function unsubscribeUrlFor(subscriberId: string, env: Env = process.env): string {
  return `${publicBaseUrl()}/api/newsletter/unsubscribe?t=${mintUnsubscribeToken(subscriberId, env)}`;
}

/** The provider's Idempotency-Key for the welcome of one subscriber and one template version. */
export function welcomeIdempotencyKey(subscriberId: string, templateKey: string, version: number): string {
  return `welcome-${subscriberId}-${templateKey}-v${version}`;
}

// ─── Welcome state on the subscriber ─────────────────────────────────────────

async function setWelcome(subscriberId: string, mutate: (welcome: WelcomeState, subscriber: NewsletterSubscriber) => WelcomeState | null): Promise<void> {
  await updateNewsletterSubscriber(subscriberId, (current) => {
    if (!current.welcome) return null;
    const next = mutate(current.welcome, current);
    return next ? { ...current, welcome: next } : null;
  });
}

async function releaseClaim(subscriberId: string, reason: string, now: () => Date): Promise<void> {
  await setWelcome(subscriberId, (welcome) => (welcome.status === 'sending' ? { ...welcome, status: 'pending', reason, updatedAt: isoNow(now) } : null));
}

// ─── The welcome email ───────────────────────────────────────────────────────

export async function attemptWelcome(subscriberId: string, deps: SenderDeps = {}): Promise<WelcomeAttempt> {
  const now = deps.now ?? (() => new Date());
  const claim = { held: false };
  try {
    return await attemptInner(subscriberId, deps, now, claim);
  } catch (err) {
    console.error('[email] welcome attempt failed:', describeError(err));
    if (claim.held) {
      try {
        await releaseClaim(subscriberId, 'internal_error', now);
      } catch { /* the stale-claim rule frees it */ }
    }
    return { result: 'pending', reason: 'internal_error' };
  }
}

async function attemptInner(subscriberId: string, deps: SenderDeps, now: () => Date, claim: { held: boolean }): Promise<WelcomeAttempt> {
  const env = deps.env ?? process.env;
  const subscriber = (await getNewsletterSubscribers()).find((s) => s.id === subscriberId);
  if (!subscriber) return { result: 'not_found' };
  const welcome = subscriber.welcome;
  if (!welcome) return { result: 'skipped', reason: 'legacy_subscriber' };
  const base = { kind: 'welcome', to: maskEmail(subscriber.email), subscriberId: subscriber.id, templateKey: WELCOME_TEMPLATE_KEY, by: 'system' } as const;

  async function skip(reason: string, detail?: string): Promise<WelcomeAttempt> {
    await setWelcome(subscriber!.id, (w) => (w.status === 'pending' || isStaleClaim(w, now()) ? { ...w, status: 'skipped', reason, updatedAt: isoNow(now) } : null));
    await appendSendLog({ ...base, outcome: 'skipped', reason, ...(detail ? { detail } : {}) }, now());
    return { result: 'skipped', reason };
  }

  /** Not sent, and it stays pending with the reason on record; `retryAt` is when an automatic retry makes sense. */
  async function hold(reason: string, log: { outcome: SendOutcome; detail?: string; code?: string; httpStatus?: number; version?: number; layoutVersion?: string }, retryAt?: Date): Promise<WelcomeAttempt> {
    const unchanged = welcome!.status === 'pending' && welcome!.reason === reason;
    if (!(deps.source === 'sweep' && unchanged)) await appendSendLog({ ...base, reason, ...log }, now());
    if (!unchanged) await setWelcome(subscriber!.id, (w) => (w.status === 'pending' || isStaleClaim(w, now()) ? { ...w, status: 'pending', reason, updatedAt: isoNow(now) } : null));
    scheduleWelcomeSweep(deps, retryDelay(retryAt, now()));
    return { result: 'pending', reason };
  }

  if (subscriber.status === 'unsubscribed') {
    if (welcome.status === 'pending' || welcome.status === 'sending') await setWelcome(subscriber.id, (w) => ({ ...w, status: 'skipped', reason: 'unsubscribed', updatedAt: isoNow(now) }));
    return { result: 'skipped', reason: 'unsubscribed' };
  }
  if (welcome.status === 'sent' || welcome.status === 'failed' || welcome.status === 'skipped') return { result: 'already', status: welcome.status };
  if (welcome.status === 'sending' && !isStaleClaim(welcome, now())) return { result: 'in_progress' };

  // 1. the transport must be configured
  const config = readResendConfig(env);
  if (!config.ok) return hold('not_configured', { outcome: 'blocked', detail: [...config.missing.map((n) => `${n} is not set`), ...config.invalid.map((n) => `${n} is not usable`)].join('; ') });

  // 2. the template, settings and guidelines
  const [template, settings, guidelines] = await Promise.all([getEmailTemplateByKey(WELCOME_TEMPLATE_KEY), getEmailSettings(), getBrandGuidelines()]);
  if (!template) return hold('no_template', { outcome: 'blocked', detail: 'The welcome template does not exist.' });
  if (!template.enabled) return skip('template_disabled');

  // 3. the recipient's unsubscribe link, then the gate on the exact message
  let unsubscribeUrl: string;
  try {
    unsubscribeUrl = unsubscribeUrlFor(subscriber.id, env);
  } catch (err) {
    if (err instanceof NoSigningSecretError) return hold('no_signing_secret', { outcome: 'blocked', detail: 'No signing secret for unsubscribe links (NEWSLETTER_UNSUBSCRIBE_SECRET or SESSION_SECRET).' });
    throw err;
  }
  const layout = deps.layout ?? getLayout();
  const check = verifyForSend({ template, settings, guidelines, layout, ctx: buildRenderContext(unsubscribeUrl, now()) });
  if (!check.ok) {
    if (check.reason === 'disabled') return skip('template_disabled');
    return hold(check.reason, { outcome: 'blocked', detail: check.issues.length ? check.issues.slice(0, 8).map((i) => i.code).join(', ') : check.message, layoutVersion: layout.version });
  }
  if (!isEmailAddress(subscriber.email)) {
    await setWelcome(subscriber.id, (w) => ({ ...w, status: 'failed', reason: 'invalid_address', updatedAt: isoNow(now) }));
    await appendSendLog({ ...base, outcome: 'failed', reason: 'invalid_address', version: check.version.version }, now());
    return { result: 'failed', reason: 'invalid_address' };
  }

  // 3b. the provider has said no recently (a quota, a rate limit, an unverified domain): an automatic attempt waits it out
  // instead of asking again; an administrator's own "send waiting welcomes" always tries
  if (deps.source !== 'admin') {
    const state = await readProviderStateSafe();
    if (state && isBlocked(state, now())) {
      const until = new Date(state.blockedUntil as string);
      return hold(holdReasonOf(state), { outcome: holdOutcomeOf(state), detail: `Not asking the email provider again until ${until.toISOString()}.${state.lastReason ? ` Last answer: ${state.lastReason}.` : ''}`, code: state.lastCode, httpStatus: state.lastHttpStatus, version: check.version.version, layoutVersion: layout.version }, until);
    }
  }

  // 4. claim the subscriber (pending -> sending) so no other attempt can send to them
  const claimed = await updateNewsletterSubscriber(subscriber.id, (current) => {
    const w = current.welcome;
    if (current.status === 'unsubscribed' || !w || (w.status !== 'pending' && !isStaleClaim(w, now()))) return null;
    return { ...current, welcome: { ...w, status: 'sending', reason: 'sending', attemptedAt: isoNow(now), templateKey: template.key, version: check.version.version, updatedAt: isoNow(now) } };
  });
  if (!claimed) return { result: 'in_progress' };
  claim.held = true;

  // 5. take an hourly slot (recorded as "reserved" in the send log until the provider answers)
  const logBase: NewSendLogEntry = { ...base, templateKey: template.key, version: check.version.version, layoutVersion: layout.version, outcome: 'reserved' };
  const slot = await reserveSendSlot({ cap: settings.hourlyCap, entry: logBase, now: now() });
  if (!slot.ok) {
    await releaseClaim(subscriber.id, 'hourly_cap', now);
    claim.held = false;
    if (!(deps.source === 'sweep' && welcome.reason === 'hourly_cap')) await appendSendLog({ ...logBase, outcome: 'rate_limited', reason: 'hourly_cap', detail: `${slot.used} of ${settings.hourlyCap} sent in the last hour` }, now());
    scheduleWelcomeSweep(deps);
    return { result: 'pending', reason: 'hourly_cap' };
  }

  // 6. send, then record exactly what happened
  const message: OutboundEmail = {
    to: subscriber.email,
    subject: check.fields.subject,
    html: check.rendered.html,
    text: check.rendered.text,
    unsubscribeUrl,
    idempotencyKey: welcomeIdempotencyKey(subscriber.id, template.key, check.version.version),
    category: template.key,
  };
  const sent = await sendViaResend(config.config, message, { fetchImpl: deps.fetchImpl });
  const providerState = await recordProviderAttemptSafe(sent, now());
  if (sent.ok) {
    await settleSendLog(slot.entry.id, { outcome: 'sent', messageId: sent.id, httpStatus: sent.status }, now());
    await setWelcome(subscriber.id, (w) => ({ status: 'sent', attemptedAt: w.attemptedAt, sentAt: isoNow(now), templateKey: template.key, version: check.version.version, messageId: sent.id, updatedAt: isoNow(now) }));
    claim.held = false;
    // sending works right now: look in a few minutes for older welcomes that are still waiting (for example after a restart)
    scheduleWelcomeSweep(deps);
    return { result: 'sent', messageId: sent.id };
  }

  const logPatch = { httpStatus: sent.status ?? undefined, code: sent.code, reason: sent.reason, detail: sent.detail || undefined };
  claim.held = false;
  if (sent.kind === 'rejected') {
    await settleSendLog(slot.entry.id, { outcome: 'failed', ...logPatch }, now());
    await setWelcome(subscriber.id, (w) => ({ ...w, status: 'failed', reason: 'rejected_by_provider', updatedAt: isoNow(now) }));
    return { result: 'failed', reason: 'rejected_by_provider' };
  }
  const held = sent.kind === 'provider_not_ready' ? { outcome: 'provider_not_ready' as const, welcomeReason: 'provider_not_ready' } : sent.kind === 'rate_limited' ? { outcome: 'rate_limited' as const, welcomeReason: 'provider_rate_limited' } : { outcome: 'retry' as const, welcomeReason: 'provider_unavailable' };
  await settleSendLog(slot.entry.id, { outcome: held.outcome, ...logPatch }, now());
  await releaseClaim(subscriber.id, held.welcomeReason, now);
  scheduleWelcomeSweep(deps, retryDelay(providerState?.blockedUntil ? new Date(providerState.blockedUntil) : undefined, now()));
  return { result: 'pending', reason: held.welcomeReason };
}

/** From the public signup route: attempt the welcome after the response has been sent. It can never throw or fail the signup. */
export function queueWelcome(subscriberId: string, deps: SenderDeps = {}): void {
  void attemptWelcome(subscriberId, deps).catch((err) => console.error('[email] queued welcome failed:', describeError(err)));
}

// ─── Queued welcomes ─────────────────────────────────────────────────────────

export interface PendingSummary {
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
  /** Still waiting after this run. */
  pending: number;
  /** The blocker that stopped the run early (it affects every address alike). */
  stoppedBecause?: string;
}

export async function sendPendingWelcomes(deps: SenderDeps = {}, limit = 25): Promise<PendingSummary> {
  const now = deps.now ?? (() => new Date());
  const waiting = (list: NewsletterSubscriber[]) =>
    list
      .filter((s) => s.welcome && s.status !== 'unsubscribed' && (s.welcome.status === 'pending' || isStaleClaim(s.welcome, now())))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const queue = waiting(await getNewsletterSubscribers());
  const summary: PendingSummary = { considered: Math.min(queue.length, limit), sent: 0, failed: 0, skipped: 0, pending: 0 };
  for (const subscriber of queue.slice(0, limit)) {
    const attempt = await attemptWelcome(subscriber.id, { ...deps, source: deps.source ?? 'admin' });
    if (attempt.result === 'sent') summary.sent += 1;
    else if (attempt.result === 'failed') summary.failed += 1;
    else if (attempt.result === 'skipped') summary.skipped += 1;
    else if (attempt.result === 'pending' && GLOBAL_BLOCKERS.has(attempt.reason)) {
      summary.stoppedBecause = attempt.reason;
      break;
    }
  }
  summary.pending = waiting(await getNewsletterSubscribers()).length;
  return summary;
}

// ─── The sweeper ─────────────────────────────────────────────────────────────

/**
 * The timer lives on globalThis, not in this module, so every bundle that loads the sender (each route, and the boot hook
 * in src/instrumentation.ts) shares one timer and one clock for "when is the next automatic attempt due".
 */
interface SweepState {
  timer: ReturnType<typeof setTimeout> | null;
  /** Epoch ms the timer is due, or null. */
  nextAt: number | null;
  /** Sweeps in a row that still found something waiting. */
  runs: number;
}

const sweepHolder = globalThis as unknown as { __abEmailSweep?: SweepState };

function sweepState(): SweepState {
  if (!sweepHolder.__abEmailSweep) sweepHolder.__abEmailSweep = { timer: null, nextAt: null, runs: 0 };
  return sweepHolder.__abEmailSweep;
}

/** Milliseconds until an automatic retry makes sense: the usual interval, or longer when the provider asked us to wait. */
function retryDelay(retryAt: Date | undefined, now: Date): number {
  if (!retryAt) return SWEEP_DELAY_MS;
  return Math.max(SWEEP_DELAY_MS, Math.min(retryAt.getTime() - now.getTime() + 1000, 25 * 3_600_000));
}

async function readProviderStateSafe(): Promise<ProviderState | null> {
  try {
    return await readProviderState();
  } catch (err) {
    console.error('[email] could not read the provider state:', describeError(err));
    return null;
  }
}

async function recordProviderAttemptSafe(result: ResendResult, now: Date): Promise<ProviderState | null> {
  try {
    return await recordProviderAttempt(result, now);
  } catch (err) {
    console.error('[email] could not record the provider state:', describeError(err));
    return null;
  }
}

function holdReasonOf(state: ProviderState): string {
  return state.lastOutcome === 'rate_limited' ? 'provider_rate_limited' : state.lastOutcome === 'retry' ? 'provider_unavailable' : 'provider_not_ready';
}

function holdOutcomeOf(state: ProviderState): SendOutcome {
  return state.lastOutcome === 'rate_limited' ? 'rate_limited' : state.lastOutcome === 'retry' ? 'retry' : 'provider_not_ready';
}

export function sweeperDisabled(): boolean {
  return process.env.EMAIL_SWEEP_DISABLED === '1';
}

/**
 * Retry queued welcomes after `delayMs` (default five minutes). One timer at a time: an earlier due time replaces a later
 * one. When it fires it sends what it can and reschedules itself while anything is still waiting, waiting out a provider
 * hold rather than asking again every few minutes.
 */
export function scheduleWelcomeSweep(deps: SenderDeps = {}, delayMs: number = SWEEP_DELAY_MS): void {
  const state = sweepState();
  if (sweeperDisabled() || state.runs >= MAX_CONSECUTIVE_SWEEPS) return;
  const dueAt = Date.now() + delayMs;
  if (state.timer && state.nextAt !== null && state.nextAt <= dueAt) return;
  if (state.timer) clearTimeout(state.timer);
  state.nextAt = dueAt;
  state.timer = setTimeout(() => {
    state.timer = null;
    state.nextAt = null;
    state.runs += 1;
    sendPendingWelcomes({ ...deps, source: 'sweep' })
      .then(async (summary) => {
        if (summary.pending > 0) {
          const providerState = await readProviderStateSafe();
          const now = (deps.now ?? (() => new Date()))();
          scheduleWelcomeSweep(deps, retryDelay(providerState?.blockedUntil ? new Date(providerState.blockedUntil) : undefined, now));
        } else {
          state.runs = 0;
        }
      })
      .catch((err) => console.error('[email] welcome sweep failed:', describeError(err)));
  }, delayMs);
  state.timer.unref?.();
}

/** At server start: look for waiting welcomes soon (and keep looking while any are waiting). */
export function scheduleBootSweep(delayMs = 30_000): void {
  scheduleWelcomeSweep({}, delayMs);
}

export function isWelcomeSweepScheduled(): boolean {
  return sweepState().timer !== null;
}

/** When the next automatic attempt is due (ISO), or null when none is scheduled. */
export function getNextSweepAt(): string | null {
  const { timer, nextAt } = sweepState();
  return timer && nextAt !== null ? new Date(nextAt).toISOString() : null;
}

export function cancelWelcomeSweep(): void {
  const state = sweepState();
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  state.nextAt = null;
  state.runs = 0;
}

// ─── Test sends ──────────────────────────────────────────────────────────────

export type TestSendResult =
  | { ok: true; messageId: string; version: number }
  | { ok: false; status: 400 | 404 | 409 | 429 | 502; reason: string; message: string; issues?: string[]; retryAfterSeconds?: number };

/**
 * Send one real email of an approved template version to an address the admin types. It goes through exactly the same
 * gate and transport as a welcome (an unapproved or edited version is refused), with an unsubscribe link that works but
 * changes nothing (the reserved "test" token). It uses and counts against the same hourly cap.
 */
export async function sendTestEmail(input: { to: unknown; templateKey?: string; version?: number }, deps: SenderDeps = {}): Promise<TestSendResult> {
  const now = deps.now ?? (() => new Date());
  const env = deps.env ?? process.env;
  if (!isEmailAddress(input.to)) return { ok: false, status: 400, reason: 'invalid_recipient', message: 'Enter one email address.' };
  const to = input.to.trim().toLowerCase();
  const templateKey = input.templateKey || WELCOME_TEMPLATE_KEY;
  const logBase: NewSendLogEntry = { kind: 'test', to: maskEmail(to), templateKey, by: 'admin', outcome: 'blocked' };
  const blocked = async (status: 409 | 404, reason: string, message: string, detail?: string, extra: Partial<NewSendLogEntry> = {}): Promise<TestSendResult> => {
    await appendSendLog({ ...logBase, ...extra, outcome: 'blocked', reason, ...(detail ? { detail } : {}) }, now());
    return { ok: false, status, reason, message, ...(detail ? { issues: detail.split(', ') } : {}) };
  };

  const config = readResendConfig(env);
  if (!config.ok) return blocked(409, 'not_configured', 'Sending is not configured on this server.', undefined, {});
  const template = await getEmailTemplateByKey(templateKey);
  if (!template) return { ok: false, status: 404, reason: 'template_not_found', message: 'Template not found.' };
  if (input.version !== undefined && !findVersion(template, input.version)) return { ok: false, status: 404, reason: 'version_not_found', message: 'Version not found.' };
  const [settings, guidelines] = await Promise.all([getEmailSettings(), getBrandGuidelines()]);
  let unsubscribeUrl: string;
  try {
    unsubscribeUrl = unsubscribeUrlFor(TEST_SUBSCRIBER_ID, env);
  } catch (err) {
    if (err instanceof NoSigningSecretError) return blocked(409, 'no_signing_secret', 'No signing secret is configured for unsubscribe links.');
    throw err;
  }
  const layout = deps.layout ?? getLayout();
  const check = verifyForSend({ template, version: input.version, settings, guidelines, layout, ctx: buildRenderContext(unsubscribeUrl, now()) });
  if (!check.ok) return blocked(409, check.reason, check.message, check.issues.slice(0, 8).map((i) => i.code).join(', ') || undefined, { layoutVersion: layout.version });

  const slotEntry: NewSendLogEntry = { ...logBase, version: check.version.version, layoutVersion: layout.version, outcome: 'reserved' };
  const slot = await reserveSendSlot({ cap: settings.hourlyCap, entry: slotEntry, now: now() });
  if (!slot.ok) {
    await appendSendLog({ ...slotEntry, outcome: 'rate_limited', reason: 'hourly_cap', detail: `${slot.used} of ${settings.hourlyCap} sent in the last hour` }, now());
    return { ok: false, status: 429, reason: 'hourly_cap', message: `The hourly sending cap (${settings.hourlyCap}) has been reached.` };
  }
  const sent = await sendViaResend(
    config.config,
    { to, subject: check.fields.subject, html: check.rendered.html, text: check.rendered.text, unsubscribeUrl, idempotencyKey: `test-${randomUUID()}`, category: template.key },
    { fetchImpl: deps.fetchImpl },
  );
  await recordProviderAttemptSafe(sent, now());
  if (sent.ok) {
    await settleSendLog(slot.entry.id, { outcome: 'sent', messageId: sent.id, httpStatus: sent.status }, now());
    return { ok: true, messageId: sent.id, version: check.version.version };
  }
  const outcome: SendOutcome = sent.kind === 'provider_not_ready' ? 'provider_not_ready' : sent.kind === 'rate_limited' ? 'rate_limited' : sent.kind === 'retry' ? 'retry' : 'failed';
  await settleSendLog(slot.entry.id, { outcome, httpStatus: sent.status ?? undefined, code: sent.code, reason: sent.reason, detail: sent.detail || undefined }, now());
  return { ok: false, status: 502, reason: sent.reason, message: sent.detail || `The provider could not send the email (${sent.reason}).`, ...(sent.retryAfterSeconds ? { retryAfterSeconds: sent.retryAfterSeconds } : {}) };
}

// ─── Status ──────────────────────────────────────────────────────────────────

export interface SendingStatus {
  transport: 'resend';
  /** The environment variables are set and usable (the transport can be called). */
  configured: boolean;
  /** Names only, never values. */
  missing: string[];
  invalid: string[];
  signing: { configured: boolean; source: string | null };
  ai: { providers: string[]; available: boolean };
  /** Which model judges the emails: the administrator's setting and every (provider, model) that would be tried, in order. */
  reviewer: { setting: string; chain: Array<{ provider: string; model: string }> };
  layout: { id: string; version: string; installed: boolean };
  publicBaseUrl: string;
  /**
   * What the email provider last told us. `blocked`: the last attempt was refused (a quota, a rate limit, an unverified
   * domain, a temporary error; not the refusal of a single message, which shows the provider is working); `blockedUntil` is when automatic attempts resume (it may be in the past: a retry is due);
   * `nextAttemptAt` is when the next automatic attempt is scheduled, null when none is.
   */
  provider: {
    state: 'ok' | 'blocked' | 'unknown';
    lastAttemptAt: string | null;
    lastOutcome: string | null;
    lastReason: string | null;
    lastCode: string | null;
    lastHttpStatus: number | null;
    lastDetail: string | null;
    lastSuccessAt: string | null;
    blockedUntil: string | null;
    nextAttemptAt: string | null;
    automaticRetry: boolean;
  };
  /** Welcome emails saved but not yet sent. */
  waiting: { count: number; oldestAt: string | null; reasons: Record<string, number> };
  welcome: {
    templateKey: string;
    exists: boolean;
    enabled: boolean;
    activeVersion: number | null;
    approval: 'approved' | 'unapproved' | 'stale' | 'none';
    staleReasons: string[];
    /** Everything a welcome needs holds right now: a new subscriber would be sent one immediately. */
    readyToSend: boolean;
    blockers: string[];
  };
  subscribers: { total: number; subscribed: number; unsubscribed: number; welcomePending: number; welcomeSent: number; welcomeFailed: number; welcomeSkipped: number };
  sending: { sentLastHour: number; hourlyCap: number };
}

export async function getSendingStatus(deps: SenderDeps = {}): Promise<SendingStatus> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => new Date());
  const config = readResendConfig(env);
  const signing = resolveSigningSecret(env);
  const layout = deps.layout ?? getLayout();
  const [template, settings, guidelines, subscribers, sentLastHour, providerState] = await Promise.all([getEmailTemplateByKey(WELCOME_TEMPLATE_KEY), getEmailSettings(), getBrandGuidelines(), getNewsletterSubscribers(), countSentLastHour(now()), readProviderStateSafe()]);
  const providers = configuredAiProviders(env);
  const waitingList = subscribers.filter((s) => s.status !== 'unsubscribed' && (s.welcome?.status === 'pending' || s.welcome?.status === 'sending'));
  const waitingReasons: Record<string, number> = {};
  for (const s of waitingList) {
    const reason = s.welcome?.reason ?? 'queued';
    waitingReasons[reason] = (waitingReasons[reason] ?? 0) + 1;
  }
  const nextSweep = getNextSweepAt();
  const lastOutcome = providerState?.lastOutcome ?? null;

  const blockers: string[] = [];
  if (!config.ok) blockers.push('not_configured');
  if (!signing) blockers.push('no_signing_secret');
  let approval: SendingStatus['welcome']['approval'] = 'none';
  let staleReasons: string[] = [];
  if (template) {
    const active = template.activeVersion === null ? undefined : findVersion(template, template.activeVersion);
    if (!layout.installed) blockers.push('layout_not_installed');
    if (!template.enabled) blockers.push('template_disabled');
    else if (!active) blockers.push('no_active_version');
    else {
      const state = approvalState(active, layout, guidelines);
      approval = state.state;
      if (state.state === 'stale') staleReasons = state.reasons;
      if (state.state !== 'approved') blockers.push(state.state === 'stale' ? 'approval_stale' : 'not_approved');
      else {
        const check = verifyForSend({ template, settings, guidelines, layout, ctx: reviewContext() });
        if (!check.ok) blockers.push(check.reason);
      }
    }
  } else {
    blockers.push('no_template');
  }
  const welcomeOf = (s: NewsletterSubscriber) => s.welcome?.status;
  return {
    transport: 'resend',
    configured: config.ok,
    missing: config.ok ? [] : config.missing,
    invalid: config.ok ? [] : config.invalid,
    signing: { configured: Boolean(signing), source: signing?.source ?? null },
    ai: { providers, available: providers.length > 0 },
    reviewer: { setting: settings.reviewModel, chain: reviewerChain(env, settings.reviewModel) },
    layout: { id: layout.id, version: layout.version, installed: layout.installed },
    publicBaseUrl: publicBaseUrl(),
    provider: {
      // a refusal of one message (failed) shows the provider is answering; only a refusal of sending itself is a block
      state: lastOutcome === null ? 'unknown' : lastOutcome === 'sent' || lastOutcome === 'failed' ? 'ok' : 'blocked',
      lastAttemptAt: providerState?.lastAttemptAt ?? null,
      lastOutcome,
      lastReason: providerState?.lastReason ?? null,
      lastCode: providerState?.lastCode ?? null,
      lastHttpStatus: providerState?.lastHttpStatus ?? null,
      lastDetail: providerState?.lastDetail ?? null,
      lastSuccessAt: providerState?.lastSuccessAt ?? null,
      blockedUntil: providerState?.blockedUntil ?? null,
      nextAttemptAt: nextSweep,
      automaticRetry: !sweeperDisabled(),
    },
    waiting: { count: waitingList.length, oldestAt: waitingList.map((s) => s.createdAt).sort()[0] ?? null, reasons: waitingReasons },
    welcome: {
      templateKey: WELCOME_TEMPLATE_KEY,
      exists: Boolean(template),
      enabled: template?.enabled ?? false,
      activeVersion: template?.activeVersion ?? null,
      approval,
      staleReasons,
      readyToSend: blockers.length === 0,
      blockers,
    },
    subscribers: {
      total: subscribers.length,
      subscribed: subscribers.filter((s) => s.status !== 'unsubscribed').length,
      unsubscribed: subscribers.filter((s) => s.status === 'unsubscribed').length,
      welcomePending: subscribers.filter((s) => s.status !== 'unsubscribed' && (welcomeOf(s) === 'pending' || welcomeOf(s) === 'sending')).length,
      welcomeSent: subscribers.filter((s) => welcomeOf(s) === 'sent').length,
      welcomeFailed: subscribers.filter((s) => welcomeOf(s) === 'failed').length,
      welcomeSkipped: subscribers.filter((s) => welcomeOf(s) === 'skipped').length,
    },
    sending: { sentLastHour, hourlyCap: settings.hourlyCap },
  };
}

