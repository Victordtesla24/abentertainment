/**
 * The provider hold and quota visibility, in-process against a stubbed Resend:
 *   - what each refusal holds back and until when (a quota until midnight UTC, a rate limit for its Retry-After, an
 *     unverified domain and temporary errors with a backoff), and that an accepted send clears it;
 *   - the incident this exists for: Resend answers 429 daily_quota_exceeded, the welcome stays pending, nothing asks the
 *     provider again until the quota resets, an administrator's own retry still tries, and the queue then drains by itself;
 *   - the status the admin screen shows (reason, last attempt, next retry, waiting welcomes, which model reviews);
 *   - the boot hook, which rebuilds the retry timer after a restart from what was saved.
 */

import { test, expect } from '@playwright/test';
import { rmSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir, unitDir } from './support/email-unit';
import { StubAi, passingReview } from './fixtures/email-ai-stub';
import { ENV, accepted, refused, stubFetch } from './support/email-send-kit';

type Sender = typeof import('@/lib/email/sender');
type ProviderMod = typeof import('@/lib/email/provider-state');
type SendLog = typeof import('@/lib/email/send-log');
type Data = typeof import('@/lib/data');
type Store = typeof import('@/lib/email/store');
type Gate = typeof import('@/lib/email/gate');
type LayoutMod = typeof import('@/lib/email/layout');

const QUOTA = refused(429, 'daily_quota_exceeded', 'You have reached your daily email sending quota. Resets at 00:00 UTC.');
const T0 = new Date('2026-10-13T22:56:19Z');

test.describe.configure({ mode: 'serial' });

test.describe('provider hold and quota visibility', () => {
  let sender: Sender;
  let provider: ProviderMod;
  let log: SendLog;
  let data: Data;
  let store: Store;
  let gate: Gate;
  let layoutMod: LayoutMod;

  test.beforeAll(() => {
    loadWithUnitDir(() => {
      data = require('@/lib/data') as Data;
      sender = require('@/lib/email/sender') as Sender;
      provider = require('@/lib/email/provider-state') as ProviderMod;
      log = require('@/lib/email/send-log') as SendLog;
      store = require('@/lib/email/store') as Store;
      gate = require('@/lib/email/gate') as Gate;
      layoutMod = require('@/lib/email/layout') as LayoutMod;
    });
  });

  test.beforeEach(() => cleanUnitDir());
  test.afterEach(() => sender.cancelWelcomeSweep());

  async function approveWelcome() {
    const layout = layoutMod.getLayout();
    const guidelines = await store.getBrandGuidelines();
    const settings = await store.getEmailSettings();
    const template = (await store.getEmailTemplates())[0];
    const result = await gate.runGate({ fields: template.versions[0].fields, settings, guidelines }, { layout, ai: new StubAi([passingReview()]), ctx: gate.reviewContext() });
    await store.recordGateOutcome(template.id, 1, { result, approval: gate.buildApproval(result, layout, guidelines) });
    await store.setActiveVersion(template.id, 1, () => null);
  }

  async function subscribe(email: string) {
    const added = await data.addNewsletterSubscriber({ email, source: '/' });
    if (added.status !== 'created') throw new Error('not created');
    return added.subscriber;
  }

  const stateOf = async (id: string) => (await data.getNewsletterSubscribers()).find((s) => s.id === id)!;
  type Failure = Extract<import('@/lib/email/resend').ResendResult, { ok: false }>;
  const failure = (over: Partial<Failure>): Failure => ({ ok: false, kind: 'retry', status: 503, code: 'application_error', reason: 'provider_error', detail: '', ...over });

  test('what each refusal holds back, until when, and that an accepted send clears it', () => {
    const iso = (d: Date | null) => d?.toISOString() ?? null;
    // a quota: until the next midnight UTC (when it resets), with a minute of grace; a monthly one is probed again each day
    expect(iso(provider.holdUntil(failure({ kind: 'rate_limited', reason: 'quota_exceeded', status: 429, code: 'daily_quota_exceeded' }), T0, 1))).toBe('2026-10-14T00:01:00.000Z');
    expect(iso(provider.holdUntil(failure({ kind: 'rate_limited', reason: 'quota_exceeded', status: 429, code: 'monthly_quota_exceeded' }), new Date('2026-10-31T23:59:59Z'), 1))).toBe('2026-11-01T00:01:00.000Z');
    // a rate limit: the provider's Retry-After, kept between 10 seconds and an hour (a minute when it gave none)
    expect(iso(provider.holdUntil(failure({ kind: 'rate_limited', reason: 'rate_limit', status: 429, retryAfterSeconds: 30 }), T0, 1))).toBe('2026-10-13T22:56:49.000Z');
    expect(iso(provider.holdUntil(failure({ kind: 'rate_limited', reason: 'rate_limit', status: 429 }), T0, 1))).toBe('2026-10-13T22:57:19.000Z');
    expect(iso(provider.holdUntil(failure({ kind: 'rate_limited', reason: 'rate_limit', status: 429, retryAfterSeconds: 2 }), T0, 1))).toBe('2026-10-13T22:56:29.000Z');
    expect(iso(provider.holdUntil(failure({ kind: 'rate_limited', reason: 'rate_limit', status: 429, retryAfterSeconds: 86400 }), T0, 1))).toBe('2026-10-13T23:56:19.000Z');
    // an unverified domain or a bad key: five minutes, doubling, to an hour
    const notReady = failure({ kind: 'provider_not_ready', reason: 'domain_not_verified', status: 403 });
    expect([1, 2, 3, 4, 5, 6, 9].map((n) => (provider.holdUntil(notReady, T0, n)!.getTime() - T0.getTime()) / 1000)).toEqual([300, 600, 1200, 2400, 3600, 3600, 3600]);
    // a temporary error: a minute, doubling, to half an hour
    expect([1, 2, 3, 4, 5, 6, 9].map((n) => (provider.holdUntil(failure({}), T0, n)!.getTime() - T0.getTime()) / 1000)).toEqual([60, 120, 240, 480, 960, 1800, 1800]);
    // the provider refusing one message says nothing about the provider
    expect(provider.holdUntil(failure({ kind: 'rejected', reason: 'invalid_request', status: 422 }), T0, 1)).toBeNull();
    expect(provider.nextUtcMidnight(new Date('2026-12-31T23:59:59Z'), 0).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  test('the state is saved across restarts, grows with each refusal, and one accepted send clears the hold', async () => {
    expect(await provider.readProviderState()).toEqual({ consecutiveFailures: 0, updatedAt: '' });
    const first = await provider.recordProviderAttempt(failure({ kind: 'provider_not_ready', reason: 'domain_not_verified', status: 403, code: 'validation_error', detail: 'The abentertainment.com.au domain is not verified.' }), T0);
    expect(first).toMatchObject({ lastOutcome: 'provider_not_ready', lastReason: 'domain_not_verified', lastCode: 'validation_error', lastHttpStatus: 403, consecutiveFailures: 1, blockedUntil: '2026-10-13T23:01:19.000Z', lastAttemptAt: T0.toISOString() });
    expect(provider.isBlocked(first, T0)).toBe(true);
    expect(provider.isBlocked(first, new Date('2026-10-13T23:01:20Z'))).toBe(false);
    const second = await provider.recordProviderAttempt(failure({ kind: 'provider_not_ready', reason: 'domain_not_verified', status: 403 }), new Date('2026-10-13T23:02:00Z'));
    expect(second.consecutiveFailures).toBe(2);
    expect(second.blockedUntil).toBe('2026-10-13T23:12:00.000Z');
    expect(await provider.readProviderState()).toEqual(second); // read back from disk
    const ok = await provider.recordProviderAttempt({ ok: true, id: 're_1', status: 200 }, new Date('2026-10-13T23:15:00Z'));
    expect(ok).toMatchObject({ lastOutcome: 'sent', lastSuccessAt: '2026-10-13T23:15:00.000Z', consecutiveFailures: 0 });
    expect(ok.blockedUntil).toBeUndefined();
    expect(ok.lastReason).toBeUndefined();
    // a later refusal remembers the last success
    const later = await provider.recordProviderAttempt(failure({ kind: 'rate_limited', reason: 'quota_exceeded', status: 429, code: 'daily_quota_exceeded' }), T0);
    expect(later.lastSuccessAt).toBe('2026-10-13T23:15:00.000Z');
    // the file holds no key and no address
    const raw = JSON.stringify(await provider.readProviderState());
    expect(raw).not.toContain('@');
  });

  test('the quota incident: pending, nobody asks the provider again until it resets, an admin retry still tries, then the queue drains', async () => {
    await approveWelcome();
    const stub = stubFetch([QUOTA, QUOTA, accepted('re_after_reset')]);
    const first = await subscribe('first@example.com');
    const attempt = await sender.attemptWelcome(first.id, { fetchImpl: stub.impl, env: ENV, now: () => T0 });
    expect(attempt).toEqual({ result: 'pending', reason: 'provider_rate_limited' });
    expect(stub.calls).toHaveLength(1);
    expect((await stateOf(first.id)).welcome).toMatchObject({ status: 'pending', reason: 'provider_rate_limited' });
    expect(await log.readSendLog()).toMatchObject([{ kind: 'welcome', outcome: 'rate_limited', reason: 'quota_exceeded', code: 'daily_quota_exceeded', httpStatus: 429, to: 'f***@example.com', detail: expect.stringContaining('daily email sending quota') }]);
    expect(await provider.readProviderState()).toMatchObject({ lastOutcome: 'rate_limited', lastReason: 'quota_exceeded', lastCode: 'daily_quota_exceeded', lastHttpStatus: 429, blockedUntil: '2026-10-14T00:01:00.000Z', consecutiveFailures: 1 });

    // the retry timer is set for when the quota resets, not for five minutes from now
    const dueIn = Date.parse(sender.getNextSweepAt() as string) - Date.now();
    const expected = Date.parse('2026-10-14T00:01:00Z') - T0.getTime() + 1000;
    expect(Math.abs(dueIn - expected)).toBeLessThan(3000);

    // a second subscriber, and a queued sweep, do not call Resend: the provider said no
    const second = await subscribe('second@example.com');
    expect(await sender.attemptWelcome(second.id, { fetchImpl: stub.impl, env: ENV, now: () => new Date('2026-10-13T23:30:00Z') })).toEqual({ result: 'pending', reason: 'provider_rate_limited' });
    expect(await sender.sendPendingWelcomes({ fetchImpl: stub.impl, env: ENV, now: () => new Date('2026-10-13T23:31:00Z'), source: 'sweep' })).toMatchObject({ sent: 0, pending: 2, stoppedBecause: 'provider_rate_limited' });
    expect(stub.calls).toHaveLength(1);
    const entries = await log.readSendLog();
    expect(entries).toHaveLength(2); // the refusal, and one line for the signup that was held (the sweep adds nothing)
    expect(entries[0]).toMatchObject({ kind: 'welcome', outcome: 'rate_limited', reason: 'provider_rate_limited', to: 's***@example.com', detail: expect.stringContaining('2026-10-14T00:01:00.000Z') });

    // an administrator's own "send waiting welcomes" always tries (here the quota is still exhausted, so it is refused again)
    expect(await sender.sendPendingWelcomes({ fetchImpl: stub.impl, env: ENV, now: () => new Date('2026-10-13T23:40:00Z'), source: 'admin' })).toMatchObject({ sent: 0, stoppedBecause: 'provider_rate_limited' });
    expect(stub.calls).toHaveLength(2);

    // the quota has reset: the automatic sweep asks again, the answer is yes, and the whole queue drains
    const reset = new Date('2026-10-14T00:02:00Z');
    expect(await sender.sendPendingWelcomes({ fetchImpl: stub.impl, env: ENV, now: () => reset, source: 'sweep' })).toMatchObject({ sent: 2, pending: 0 });
    expect(stub.calls).toHaveLength(4);
    expect(await provider.readProviderState()).toMatchObject({ lastOutcome: 'sent', consecutiveFailures: 0 });
    expect((await provider.readProviderState()).blockedUntil).toBeUndefined();
    expect((await stateOf(first.id)).welcome).toMatchObject({ status: 'sent', messageId: 're_after_reset' });
  });

  test('status: why it is blocked, when it was last tried, when the next try is due, and how many welcomes are waiting', async () => {
    await approveWelcome();
    const keys = { ...ENV, ANTHROPIC_API_KEY: 'sk-ant-test-0123456789abcdef', OPENAI_API_KEY: 'sk-openai-test-0123456789abcdef' };
    const clean = await sender.getSendingStatus({ env: keys });
    expect(clean.provider).toEqual({ state: 'unknown', lastAttemptAt: null, lastOutcome: null, lastReason: null, lastCode: null, lastHttpStatus: null, lastDetail: null, lastSuccessAt: null, blockedUntil: null, nextAttemptAt: null, automaticRetry: true });
    expect(clean.waiting).toEqual({ count: 0, oldestAt: null, reasons: {} });
    expect(clean.reviewer.chain.map((a) => `${a.provider}:${a.model}`)).toEqual(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-4.1-mini']);
    expect(clean.reviewer.setting).toBe('');
    expect(clean.ai).toEqual({ providers: ['anthropic', 'openai'], available: true });

    const stub = stubFetch([QUOTA]);
    const one = await subscribe('one@example.com');
    await subscribe('two@example.com');
    await sender.attemptWelcome(one.id, { fetchImpl: stub.impl, env: ENV, now: () => T0 });
    await store.updateEmailSettings({ reviewModel: 'claude-sonnet-5-5' });
    const blocked = await sender.getSendingStatus({ env: keys, now: () => T0 });
    expect(blocked.provider).toMatchObject({
      state: 'blocked',
      lastAttemptAt: T0.toISOString(),
      lastOutcome: 'rate_limited',
      lastReason: 'quota_exceeded',
      lastCode: 'daily_quota_exceeded',
      lastHttpStatus: 429,
      blockedUntil: '2026-10-14T00:01:00.000Z',
      automaticRetry: true,
    });
    expect(blocked.provider.lastDetail).toContain('daily email sending quota');
    expect(blocked.provider.nextAttemptAt).toBe(sender.getNextSweepAt());
    expect(Date.parse(blocked.provider.nextAttemptAt as string)).toBeGreaterThan(Date.now() + 60_000); // later than the usual few minutes: it waits for the reset
    expect(blocked.waiting.count).toBe(2); // one refused, one never tried
    expect(blocked.waiting.reasons).toEqual({ provider_rate_limited: 1, queued: 1 });
    expect(blocked.waiting.oldestAt).toBeTruthy();
    expect(blocked.reviewer.setting).toBe('claude-sonnet-5-5');
    expect(blocked.reviewer.chain[0]).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5-5' });
    expect(blocked.welcome.readyToSend).toBe(true); // the template is fine: the provider is the problem
    expect(JSON.stringify(blocked)).not.toContain('sk-ant-test');
    expect(JSON.stringify(blocked)).not.toContain('re_test_0123456789abcdef');

    // with the sweeper switched off the status says no automatic retry is scheduled
    process.env.EMAIL_SWEEP_DISABLED = '1';
    try {
      expect((await sender.getSendingStatus({ env: keys })).provider.automaticRetry).toBe(false);
    } finally {
      delete process.env.EMAIL_SWEEP_DISABLED;
    }

    // a refusal of one message (the provider is answering) is not a block
    await provider.recordProviderAttempt(failure({ kind: 'rejected', reason: 'invalid_request', status: 422, code: 'validation_error', detail: 'Invalid to field' }), new Date());
    expect((await sender.getSendingStatus({ env: keys })).provider).toMatchObject({ state: 'ok', lastOutcome: 'failed', blockedUntil: null });
    await provider.recordProviderAttempt(failure({ kind: 'rate_limited', reason: 'quota_exceeded', status: 429, code: 'daily_quota_exceeded' }), T0);

    // once the provider accepts a send the block is gone, with the time of that success
    await sender.sendPendingWelcomes({ fetchImpl: stubFetch([accepted('re_ok')]).impl, env: ENV, source: 'admin' });
    const ok = await sender.getSendingStatus({ env: keys });
    expect(ok.provider).toMatchObject({ state: 'ok', lastOutcome: 'sent', blockedUntil: null });
    expect(ok.provider.lastSuccessAt).toBeTruthy();
    expect(ok.waiting.count).toBe(0);
  });

  test('a test email is an administrator\'s own send: it tries the provider through a hold, and what the provider says is recorded', async () => {
    await approveWelcome();
    await provider.recordProviderAttempt(failure({ kind: 'rate_limited', reason: 'quota_exceeded', status: 429, code: 'daily_quota_exceeded' }), new Date());
    const stub = stubFetch([accepted('re_test_through_hold')]);
    const result = await sender.sendTestEmail({ to: 'delivered@resend.dev' }, { fetchImpl: stub.impl, env: ENV });
    expect(result).toMatchObject({ ok: true, messageId: 're_test_through_hold' });
    expect(stub.calls).toHaveLength(1);
    expect(await provider.readProviderState()).toMatchObject({ lastOutcome: 'sent' });
    expect((await provider.readProviderState()).blockedUntil).toBeUndefined();
    const refusal = await sender.sendTestEmail({ to: 'delivered@resend.dev' }, { fetchImpl: stubFetch([QUOTA]).impl, env: ENV });
    expect(refusal).toMatchObject({ ok: false, status: 502, reason: 'quota_exceeded' });
    expect(await provider.readProviderState()).toMatchObject({ lastOutcome: 'rate_limited', lastReason: 'quota_exceeded' });
  });

  test('after a restart the boot sweep rebuilds the retry timer from what was saved, and it waits out the saved hold', async () => {
    // the boot sweep (what src/instrumentation.ts schedules when the server starts) is one timer, off when the sweeper is switched off
    sender.scheduleBootSweep();
    expect(sender.isWelcomeSweepScheduled()).toBe(true);
    expect(Math.abs(Date.parse(sender.getNextSweepAt() as string) - Date.now() - 30_000)).toBeLessThan(2000);
    sender.scheduleBootSweep(60_000); // a later request never postpones an earlier one
    expect(Math.abs(Date.parse(sender.getNextSweepAt() as string) - Date.now() - 30_000)).toBeLessThan(2000);
    sender.scheduleBootSweep(5_000); // an earlier one replaces a later one
    expect(Math.abs(Date.parse(sender.getNextSweepAt() as string) - Date.now() - 5_000)).toBeLessThan(2000);
    sender.cancelWelcomeSweep();
    expect(sender.getNextSweepAt()).toBeNull();
    process.env.EMAIL_SWEEP_DISABLED = '1';
    try {
      sender.scheduleBootSweep();
      expect(sender.isWelcomeSweepScheduled()).toBe(false);
      expect(sender.sweeperDisabled()).toBe(true);
    } finally {
      delete process.env.EMAIL_SWEEP_DISABLED;
    }
    expect(sender.sweeperDisabled()).toBe(false);

    // a restart: the saved hold and the waiting subscriber are on disk, the timer is gone
    sender.cancelWelcomeSweep();
    await approveWelcome();
    const waiting = await subscribe('waiting@example.com');
    await provider.recordProviderAttempt(failure({ kind: 'rate_limited', reason: 'quota_exceeded', status: 429, code: 'daily_quota_exceeded' }), new Date());
    const blockedUntil = Date.parse((await provider.readProviderState()).blockedUntil as string);
    const stub = stubFetch([accepted('re_booted')]);
    sender.scheduleWelcomeSweep({ fetchImpl: stub.impl, env: ENV }, 40);
    await expect.poll(() => sender.getNextSweepAt(), { timeout: 5000 }).not.toBeNull();
    // the sweep ran, found the hold, sent nothing, and set its next look for when the hold ends
    await expect.poll(() => Math.abs(Date.parse(sender.getNextSweepAt() as string) - (blockedUntil + 1000)) < 5000, { timeout: 5000 }).toBe(true);
    expect(stub.calls).toHaveLength(0);
    expect((await stateOf(waiting.id)).welcome?.status).toBe('pending');
    // and when the hold has ended the sweep sends it
    rmSync(join(unitDir(), 'email-provider-state.json'), { force: true });
    sender.cancelWelcomeSweep();
    sender.scheduleWelcomeSweep({ fetchImpl: stub.impl, env: ENV }, 40);
    await expect.poll(async () => (await stateOf(waiting.id)).welcome?.status, { timeout: 5000 }).toBe('sent');
    expect(stub.calls).toHaveLength(1);
  });
});
