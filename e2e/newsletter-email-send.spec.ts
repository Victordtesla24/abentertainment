/**
 * Newsletter email sending: in-process tests of the transport (Resend), the sender, the send log and the unsubscribe token.
 *
 * Nothing here talks to a real service: fetch is a stub that records the request exactly as it would go to Resend and
 * returns scripted answers, and the AI reviewer is a scripted stand-in that only approves the template up front. The
 * request is asserted at the boundary: URL, headers (Authorization, Idempotency-Key), and body (from, to, reply_to,
 * subject, html, text, List-Unsubscribe and List-Unsubscribe-Post).
 */

import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir, unitDir } from './support/email-unit';
import { StubAi, passingReview } from './fixtures/email-ai-stub';
import { ADDRESS, API_KEY, ENV, accepted, json, refused, stubFetch, type Step } from './support/email-send-kit';

type Sender = typeof import('@/lib/email/sender');
type Resend = typeof import('@/lib/email/resend');
type Token = typeof import('@/lib/email/unsubscribe-token');
type SendLog = typeof import('@/lib/email/send-log');
type Data = typeof import('@/lib/data');
type Store = typeof import('@/lib/email/store');
type Gate = typeof import('@/lib/email/gate');
type LayoutMod = typeof import('@/lib/email/layout');
type Seed = typeof import('@/lib/email/seed');

test.describe.configure({ mode: 'serial' });

test.describe('newsletter email sending', () => {
  let sender: Sender;
  let resend: Resend;
  let token: Token;
  let log: SendLog;
  let data: Data;
  let store: Store;
  let gate: Gate;
  let layoutMod: LayoutMod;
  let seed: Seed;

  test.beforeAll(() => {
    loadWithUnitDir(() => {
      data = require('@/lib/data') as Data;
      sender = require('@/lib/email/sender') as Sender;
      resend = require('@/lib/email/resend') as Resend;
      token = require('@/lib/email/unsubscribe-token') as Token;
      log = require('@/lib/email/send-log') as SendLog;
      store = require('@/lib/email/store') as Store;
      gate = require('@/lib/email/gate') as Gate;
      layoutMod = require('@/lib/email/layout') as LayoutMod;
      seed = require('@/lib/email/seed') as Seed;
    });
  });

  test.beforeEach(() => cleanUnitDir());
  test.afterEach(() => sender.cancelWelcomeSweep());

  /** The welcome template as an admin leaves it after a passing review and activation (the AI is a scripted stand-in). */
  async function approveWelcome() {
    const layout = layoutMod.getLayout();
    const guidelines = await store.getBrandGuidelines();
    const settings = await store.getEmailSettings();
    const template = (await store.getEmailTemplates())[0];
    const result = await gate.runGate({ fields: template.versions[0].fields, settings, guidelines }, { layout, ai: new StubAi([passingReview()]), ctx: gate.reviewContext() });
    expect(result.passed).toBe(true);
    await store.recordGateOutcome(template.id, 1, { result, approval: gate.buildApproval(result, layout, guidelines) });
    return store.setActiveVersion(template.id, 1, () => null);
  }

  async function subscribe(email = ADDRESS) {
    const added = await data.addNewsletterSubscriber({ email, source: '/about/' });
    if (added.status !== 'created') throw new Error('not created');
    return added.subscriber;
  }

  const subscriberOf = async (id: string) => (await data.getNewsletterSubscribers()).find((s) => s.id === id)!;
  const run = (id: string, fetchStub: ReturnType<typeof stubFetch>, extra: Partial<Parameters<Sender['attemptWelcome']>[1]> = {}) => sender.attemptWelcome(id, { fetchImpl: fetchStub.impl, env: ENV, ...extra });

  // ─── configuration ─────────────────────────────────────────────────────────

  test('configuration: required names are reported (never values), unusable values are refused, the key never leaks', () => {
    expect(resend.readResendConfig({})).toEqual({ ok: false, missing: ['RESEND_API_KEY', 'EMAIL_FROM'], invalid: [] });
    expect(resend.readResendConfig({ RESEND_API_KEY: 'bad key with spaces', EMAIL_FROM: 'not an address' })).toEqual({ ok: false, missing: [], invalid: ['RESEND_API_KEY', 'EMAIL_FROM'] });
    expect(resend.readResendConfig({ ...ENV, EMAIL_FROM: 'AB <a@abentertainment.com.au>\r\nBcc: x@example.com' })).toMatchObject({ ok: false, invalid: ['EMAIL_FROM'] });
    expect(resend.readResendConfig({ ...ENV, EMAIL_FROM: 'a@b.co, c@d.co' })).toMatchObject({ ok: false, invalid: ['EMAIL_FROM'] });
    expect(resend.readResendConfig({ ...ENV, EMAIL_REPLY_TO: 'not an address' })).toMatchObject({ ok: false, invalid: ['EMAIL_REPLY_TO'] });
    // the base URL can only be the real API or a loopback test address: the key can never be sent to another host
    expect(resend.readResendConfig({ ...ENV, RESEND_BASE_URL: 'https://evil.example' })).toMatchObject({ ok: false, invalid: ['RESEND_BASE_URL'] });
    expect(resend.readResendConfig({ ...ENV, RESEND_BASE_URL: 'http://api.resend.com' })).toMatchObject({ ok: false, invalid: ['RESEND_BASE_URL'] });
    expect(resend.readResendConfig({ ...ENV, RESEND_BASE_URL: 'http://127.0.0.1:3199/' })).toMatchObject({ ok: true, config: { baseUrl: 'http://127.0.0.1:3199' } });
    const good = resend.readResendConfig(ENV);
    expect(good).toMatchObject({ ok: true, config: { from: ENV.EMAIL_FROM, replyTo: 'abhi@abentertainment.com.au', baseUrl: 'https://api.resend.com' } });
    expect(resend.readResendConfig({ RESEND_API_KEY: API_KEY, EMAIL_FROM: 'newsletter@abentertainment.com.au' })).toMatchObject({ ok: true, config: { replyTo: null } });
    const failure = JSON.stringify(resend.readResendConfig({ RESEND_API_KEY: 'bad key', EMAIL_FROM: ENV.EMAIL_FROM }));
    expect(failure).not.toContain('bad key');
    expect(failure).not.toContain('newsletter@');
    expect(resend.isEmailAddress('a@b.co')).toBe(true);
    for (const bad of ['', 'a', 'a@b', 'a@b.co, c@d.co', 'Name <a@b.co>', 'a@b.co\r\nBcc: x@y.co', ' a@b.co', 'a b@c.co', 'a@b.co;c@d.co']) expect(resend.isEmailAddress(bad), bad).toBe(false);
  });

  // ─── the request at the boundary ───────────────────────────────────────────

  test('the request to Resend: URL, headers and body exactly (text part, reply-to, one-click unsubscribe, idempotency)', async () => {
    const config = (resend.readResendConfig(ENV) as { ok: true; config: import('@/lib/email/resend').ResendConfig }).config;
    const stub = stubFetch();
    const unsubscribeUrl = 'https://abentertainment.com.au/api/newsletter/unsubscribe?t=v1.abc.def';
    const result = await resend.sendViaResend(config, { to: ADDRESS, subject: 'Welcome to AB Entertainment', html: '<p>html</p>', text: 'text', unsubscribeUrl, idempotencyKey: 'welcome-nl-1-newsletter_welcome-v1', category: 'newsletter_welcome' }, { fetchImpl: stub.impl });
    expect(result).toEqual({ ok: true, id: 're_0001', status: 200 });
    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0];
    expect(call.url).toBe('https://api.resend.com/emails');
    expect(call.method).toBe('POST');
    expect(call.headers).toEqual({ Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'welcome-nl-1-newsletter_welcome-v1' });
    expect(call.body).toEqual({
      from: 'AB Entertainment <newsletter@abentertainment.com.au>',
      to: [ADDRESS],
      subject: 'Welcome to AB Entertainment',
      html: '<p>html</p>',
      text: 'text',
      reply_to: 'abhi@abentertainment.com.au',
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      tags: [{ name: 'category', value: 'newsletter_welcome' }],
    });
    // the key is only in the Authorization header: nowhere in the body, and nowhere in what the function returns
    expect(call.raw).not.toContain(API_KEY);
    expect(JSON.stringify(result)).not.toContain(API_KEY);

    // no reply-to when none is configured
    const withoutReplyTo = (resend.readResendConfig({ ...ENV, EMAIL_REPLY_TO: '' }) as { ok: true; config: import('@/lib/email/resend').ResendConfig }).config;
    const second = stubFetch();
    await resend.sendViaResend(withoutReplyTo, { to: ADDRESS, subject: 'Subject line here', html: 'h', text: 't', unsubscribeUrl, idempotencyKey: 'k', category: 'x' }, { fetchImpl: second.impl });
    expect('reply_to' in second.calls[0].body).toBe(false);

    // guards: one plain recipient, an https unsubscribe link, one-line header values
    const build = (over: Partial<import('@/lib/email/resend').OutboundEmail>) => () => resend.buildResendRequest(config, { to: ADDRESS, subject: 'Subject line here', html: 'h', text: 't', unsubscribeUrl, idempotencyKey: 'k', category: 'x', ...over });
    expect(build({ to: 'a@b.co, c@d.co' })).toThrow();
    expect(build({ to: 'a@b.co\r\nBcc: x@y.co' })).toThrow();
    expect(build({ unsubscribeUrl: 'http://abentertainment.com.au/u?t=x' })).toThrow();
    expect(build({ unsubscribeUrl: 'https://abentertainment.com.au/u?t=x>\r\nBcc: x@y.co' })).toThrow();
    expect(build({ subject: 'two\nlines' })).toThrow();
    expect(build({ idempotencyKey: 'a\nb' })).toThrow();
    expect(build({})).not.toThrow();
    expect(resend.scrubDetail('Invalid to jane.doe@example.com for token abcdefghijklmnopqrstuvwxyz0123456789 ok')).toBe('Invalid to [address] for token [token] ok');
  });

  // ─── the welcome ───────────────────────────────────────────────────────────

  test('welcome: an approved template is sent exactly once to a new subscriber, and everything is recorded', async () => {
    await approveWelcome();
    const subscriber = await subscribe();
    expect(subscriber.welcome).toMatchObject({ status: 'pending', reason: 'queued' });
    const stub = stubFetch([accepted('re_msg_welcome_1')]);
    const outcome = await run(subscriber.id, stub);
    expect(outcome).toEqual({ result: 'sent', messageId: 're_msg_welcome_1' });
    expect(stub.calls).toHaveLength(1);

    const call = stub.calls[0];
    expect(call.url).toBe('https://api.resend.com/emails');
    expect(call.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(call.headers['Idempotency-Key']).toBe(`welcome-${subscriber.id}-newsletter_welcome-v1`);
    expect(call.body.to).toEqual([ADDRESS]);
    expect(call.body.from).toBe(ENV.EMAIL_FROM);
    expect(call.body.reply_to).toBe('abhi@abentertainment.com.au');
    expect(call.body.subject).toBe('Welcome to AB Entertainment');
    expect(call.body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(call.body.tags).toEqual([{ name: 'category', value: 'newsletter_welcome' }]);

    // the message is the approved one rendered in the brand layout, with THIS recipient's unsubscribe link in every slot
    const header = /^<(https:\/\/abentertainment\.com\.au\/api\/newsletter\/unsubscribe\?t=([^>]+))>$/.exec(call.body.headers['List-Unsubscribe']);
    expect(header).not.toBeNull();
    expect(token.verifyUnsubscribeToken(header![2], ENV)).toEqual({ ok: true, subscriberId: subscriber.id });
    expect(call.body.html).toContain(header![1]);
    expect(call.body.text).toContain(`Unsubscribe: ${header![1]}`);
    expect(call.body.html).toContain('The AB Entertainment Community');
    expect(call.body.html).toContain('background-image:linear-gradient(135deg,#C9A84C,#D4B65C 50%,#C9A84C)');
    expect(call.body.text).toContain('VIEW ALL EVENTS');

    // the subscriber, the send log
    const stored = await subscriberOf(subscriber.id);
    expect(stored.welcome).toMatchObject({ status: 'sent', messageId: 're_msg_welcome_1', templateKey: 'newsletter_welcome', version: 1 });
    expect(stored.welcome?.reason).toBeUndefined();
    expect(stored.welcome?.sentAt).toBeTruthy();
    const entries = await log.readSendLog();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'welcome', outcome: 'sent', to: 'j***@example.com', subscriberId: subscriber.id, templateKey: 'newsletter_welcome', version: 1, messageId: 're_msg_welcome_1', httpStatus: 200, by: 'system' });
    expect(entries[0].layoutVersion).toBe(layoutMod.getLayout().version);

    // exactly once: a second attempt and a queued run send nothing
    expect(sender.isWelcomeSweepScheduled()).toBe(true); // a sweep is scheduled after a send, to catch any older welcomes still waiting
    expect(await run(subscriber.id, stub)).toEqual({ result: 'already', status: 'sent' });
    expect(await sender.sendPendingWelcomes({ fetchImpl: stub.impl, env: ENV })).toMatchObject({ considered: 0, sent: 0, pending: 0 });
    expect(stub.calls).toHaveLength(1);

    // no secret and no whole address anywhere on disk except the subscriber list itself
    for (const file of readdirSync(unitDir())) {
      const content = readFileSync(join(unitDir(), file), 'utf-8');
      expect(content, file).not.toContain(API_KEY);
      if (file !== 'newsletter-subscribers.json') expect(content, file).not.toContain(ADDRESS);
    }
  });

  test('welcome: nothing is sent unless the gate passes for the exact message (not approved, edited, guidelines or layout changed, switched off)', async () => {
    const stub = stubFetch();
    const first = await subscribe('first@example.com');

    // nothing approved yet: the seeded welcome has no active version
    expect(await run(first.id, stub)).toEqual({ result: 'pending', reason: 'no_active_version' });
    expect((await subscriberOf(first.id)).welcome).toMatchObject({ status: 'pending', reason: 'no_active_version' });
    expect(await log.readSendLog()).toMatchObject([{ kind: 'welcome', outcome: 'blocked', reason: 'no_active_version', to: 'f***@example.com' }]);

    // approved version with an unreviewed edit slipped into the stored file: the content no longer matches its approval
    const active = await approveWelcome();
    const file = join(unitDir(), 'email-templates.json');
    const stored = JSON.parse(readFileSync(file, 'utf-8')) as Array<{ versions: Array<{ fields: { body: string } }> }>;
    const original = JSON.stringify(stored);
    stored[0].versions[0].fields.body += '\n\nA sentence nobody reviewed.';
    require('fs').writeFileSync(file, JSON.stringify(stored), 'utf-8');
    const edited = await run(first.id, stub);
    expect(edited).toEqual({ result: 'pending', reason: 'approval_stale' });
    expect((await log.readSendLog())[0]).toMatchObject({ outcome: 'blocked', reason: 'approval_stale' });
    require('fs').writeFileSync(file, original, 'utf-8');

    // the guidelines changed after approval
    await store.saveBrandGuidelines(`${seed.DEFAULT_GUIDELINES_TEXT}\n\nOne more rule that was added later.`, 'admin');
    expect(await run(first.id, stub)).toEqual({ result: 'pending', reason: 'approval_stale' });
    // (restore: a review on the new guidelines is what an admin would run; here we put the old text back to carry on)
    await store.saveBrandGuidelines(seed.DEFAULT_GUIDELINES_TEXT, 'admin');
    expect((await store.getBrandGuidelines()).version).toBe(3); // the approval was bound to version 1: still stale
    expect(await run(first.id, stub)).toEqual({ result: 'pending', reason: 'approval_stale' });

    // a layout whose output changed
    const redesigned = layoutMod.installLayout((f, c) => ({ ...layoutMod.getLayout().render(f, c), html: layoutMod.getLayout().render(f, c).html.replace('Instagram', 'Instagram page') }));
    expect(await run(first.id, stub, { layout: redesigned })).toEqual({ result: 'pending', reason: 'approval_stale' });

    // switched off: skipped for good
    await store.updateEmailTemplate(active.id, { enabled: false });
    expect(await run(first.id, stub)).toEqual({ result: 'skipped', reason: 'template_disabled' });
    expect((await subscriberOf(first.id)).welcome).toMatchObject({ status: 'skipped', reason: 'template_disabled' });
    expect(stub.calls).toHaveLength(0); // not one request went out in any of these cases
  });

  test('welcome: a missing configuration or signing secret keeps the subscriber pending without a request', async () => {
    await approveWelcome();
    const stub = stubFetch();
    const subscriber = await subscribe();
    const notConfigured = await sender.attemptWelcome(subscriber.id, { fetchImpl: stub.impl, env: { SESSION_SECRET: ENV.SESSION_SECRET } });
    expect(notConfigured).toEqual({ result: 'pending', reason: 'not_configured' });
    const entry = (await log.readSendLog())[0];
    expect(entry).toMatchObject({ outcome: 'blocked', reason: 'not_configured', detail: 'RESEND_API_KEY is not set; EMAIL_FROM is not set' });
    const noSecret = await sender.attemptWelcome(subscriber.id, { fetchImpl: stub.impl, env: { RESEND_API_KEY: API_KEY, EMAIL_FROM: ENV.EMAIL_FROM } });
    expect(noSecret).toEqual({ result: 'pending', reason: 'no_signing_secret' });
    expect(stub.calls).toHaveLength(0);
    expect((await subscriberOf(subscriber.id)).welcome?.status).toBe('pending');
    // once configured, the same subscriber is sent their welcome
    expect(await run(subscriber.id, stub)).toMatchObject({ result: 'sent' });
    expect(stub.calls).toHaveLength(1);
  });

  test('welcome: every Resend answer is classified, recorded, and leaves the subscriber in the right state; a retry reuses the idempotency key', async () => {
    await approveWelcome();
    const cases: Array<{ name: string; step: Step; result: string; reason: string; welcome: { status: string; reason?: string }; log: Record<string, unknown> }> = [
      { name: 'domain not verified', step: refused(403, 'validation_error', 'The abentertainment.com.au domain is not verified. Please, add and verify your domain on https://resend.com/domains'), result: 'pending', reason: 'provider_not_ready', welcome: { status: 'pending', reason: 'provider_not_ready' }, log: { outcome: 'provider_not_ready', httpStatus: 403, code: 'validation_error', reason: 'domain_not_verified' } },
      { name: 'sandbox recipient only', step: refused(403, 'validation_error', 'You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain.'), result: 'pending', reason: 'provider_not_ready', welcome: { status: 'pending', reason: 'provider_not_ready' }, log: { outcome: 'provider_not_ready', reason: 'sandbox_recipient_only' } },
      { name: 'invalid api key', step: refused(403, 'invalid_api_key', 'API key is invalid'), result: 'pending', reason: 'provider_not_ready', welcome: { status: 'pending', reason: 'provider_not_ready' }, log: { outcome: 'provider_not_ready', code: 'invalid_api_key', reason: 'invalid_api_key' } },
      { name: 'missing api key', step: refused(401, 'missing_api_key', 'Missing API key in the authorization header'), result: 'pending', reason: 'provider_not_ready', welcome: { status: 'pending', reason: 'provider_not_ready' }, log: { outcome: 'provider_not_ready', reason: 'invalid_api_key' } },
      { name: 'invalid from address', step: refused(403, 'invalid_from_address', 'Invalid `from` field'), result: 'pending', reason: 'provider_not_ready', welcome: { status: 'pending', reason: 'provider_not_ready' }, log: { outcome: 'provider_not_ready', reason: 'invalid_from_address' } },
      { name: 'rate limit', step: refused(429, 'rate_limit_exceeded', 'Too many requests', { 'retry-after': '30' }), result: 'pending', reason: 'provider_rate_limited', welcome: { status: 'pending', reason: 'provider_rate_limited' }, log: { outcome: 'rate_limited', httpStatus: 429, reason: 'rate_limit' } },
      { name: 'quota', step: refused(429, 'daily_quota_exceeded', 'You have reached your daily email sending quota.'), result: 'pending', reason: 'provider_rate_limited', welcome: { status: 'pending', reason: 'provider_rate_limited' }, log: { outcome: 'rate_limited', reason: 'quota_exceeded' } },
      { name: 'outage', step: refused(503, 'application_error', 'Something went wrong'), result: 'pending', reason: 'provider_unavailable', welcome: { status: 'pending', reason: 'provider_unavailable' }, log: { outcome: 'retry', httpStatus: 503, reason: 'provider_error' } },
      { name: 'network error', step: new TypeError('fetch failed'), result: 'pending', reason: 'provider_unavailable', welcome: { status: 'pending', reason: 'provider_unavailable' }, log: { outcome: 'retry', code: 'network_error', reason: 'network_error' } },
      { name: 'timeout', step: Object.assign(new Error('aborted'), { name: 'AbortError' }), result: 'pending', reason: 'provider_unavailable', welcome: { status: 'pending', reason: 'provider_unavailable' }, log: { outcome: 'retry', code: 'timeout', reason: 'timeout' } },
      { name: 'concurrent idempotent request', step: refused(409, 'concurrent_idempotent_requests', 'Same idempotency key used concurrently'), result: 'pending', reason: 'provider_unavailable', welcome: { status: 'pending', reason: 'provider_unavailable' }, log: { outcome: 'retry', reason: 'concurrent_request' } },
      { name: 'accepted without an id', step: json(200, {}), result: 'pending', reason: 'provider_unavailable', welcome: { status: 'pending', reason: 'provider_unavailable' }, log: { outcome: 'retry', reason: 'unexpected_response' } },
      { name: 'rejected', step: refused(422, 'validation_error_422', 'Invalid `to` field jane.doe@example.com'), result: 'failed', reason: 'rejected_by_provider', welcome: { status: 'failed', reason: 'rejected_by_provider' }, log: { outcome: 'failed', httpStatus: 422, reason: 'invalid_request', detail: 'Invalid `to` field [address]' } },
      { name: 'idempotency conflict', step: refused(409, 'invalid_idempotent_request', 'Different payload for the same key'), result: 'failed', reason: 'rejected_by_provider', welcome: { status: 'failed', reason: 'rejected_by_provider' }, log: { outcome: 'failed', reason: 'idempotency_conflict' } },
    ];
    for (const [index, item] of cases.entries()) {
      cleanSubscribers();
      const subscriber = await subscribe(`case${index}@example.com`);
      const stub = stubFetch([item.step]);
      const outcome = await run(subscriber.id, stub);
      expect(outcome, item.name).toMatchObject({ result: item.result, reason: item.reason });
      expect(stub.calls, item.name).toHaveLength(1);
      expect((await subscriberOf(subscriber.id)).welcome, item.name).toMatchObject(item.welcome);
      const entry = (await log.readSendLog())[0];
      expect(entry, item.name).toMatchObject({ kind: 'welcome', ...item.log });
      expect(entry.messageId, item.name).toBeUndefined();
      expect(JSON.stringify(entry), item.name).not.toContain(API_KEY);
      expect(JSON.stringify(entry), item.name).not.toContain('@example.com'.replace('@', `${index}@`)); // never a whole address
      if (item.name === 'rate limit') expect(stub.calls[0].headers['Idempotency-Key']).toBe(`welcome-${subscriber.id}-newsletter_welcome-v1`);

      // a pending one is sent later, with the SAME idempotency key (so the provider can never deliver it twice)
      if (item.result === 'pending') {
        const retry = stubFetch([accepted('re_after_retry')]);
        const queued = await sender.sendPendingWelcomes({ fetchImpl: retry.impl, env: ENV });
        expect(queued, item.name).toMatchObject({ sent: 1, pending: 0 });
        expect(retry.calls[0].headers['Idempotency-Key'], item.name).toBe(stub.calls[0].headers['Idempotency-Key']);
        expect((await subscriberOf(subscriber.id)).welcome, item.name).toMatchObject({ status: 'sent', messageId: 're_after_retry' });
      } else {
        const retry = stubFetch();
        expect(await sender.sendPendingWelcomes({ fetchImpl: retry.impl, env: ENV })).toMatchObject({ considered: 0 }); // failed for good: not retried
        expect(retry.calls).toHaveLength(0);
      }
    }
  });

  function cleanSubscribers() {
    require('fs').rmSync(join(unitDir(), 'newsletter-subscribers.json'), { force: true });
    require('fs').rmSync(join(unitDir(), 'email-send-log.json'), { force: true });
  }

  test('welcome: the hourly cap holds (parallel and sequential), and the queue resumes when the hour has passed', async () => {
    await approveWelcome();
    await store.updateEmailSettings({ hourlyCap: 2 });
    const subscribers = [await subscribe('a1@example.com'), await subscribe('a2@example.com'), await subscribe('a3@example.com'), await subscribe('a4@example.com')];
    const stub = stubFetch([accepted('re_cap')]);
    let clock = new Date('2026-10-13T10:00:00Z');
    const results = await Promise.all(subscribers.map((s) => run(s.id, stub, { now: () => clock })));
    expect(results.filter((r) => r.result === 'sent')).toHaveLength(2);
    expect(results.filter((r) => r.result === 'pending' && r.reason === 'hourly_cap')).toHaveLength(2);
    expect(stub.calls).toHaveLength(2);
    expect(await log.countSentLastHour(clock)).toBe(2);
    const capped = (await log.readSendLog()).filter((e) => e.outcome === 'rate_limited');
    expect(capped).toHaveLength(2);
    expect(capped[0]).toMatchObject({ reason: 'hourly_cap', detail: '2 of 2 sent in the last hour' });

    // a queued run in the same hour stops at the cap without a request
    expect(await sender.sendPendingWelcomes({ fetchImpl: stub.impl, env: ENV, now: () => clock })).toMatchObject({ sent: 0, pending: 2, stoppedBecause: 'hourly_cap' });
    expect(stub.calls).toHaveLength(2);
    // an hour later the next two go
    clock = new Date('2026-10-13T11:01:00Z');
    expect(await sender.sendPendingWelcomes({ fetchImpl: stub.impl, env: ENV, now: () => clock })).toMatchObject({ sent: 2, pending: 0 });
    expect(stub.calls).toHaveLength(4);
  });

  test('welcome: parallel attempts for one subscriber send once; a fresh claim is respected and a stale one is retried', async () => {
    await approveWelcome();
    const subscriber = await subscribe();
    const stub = stubFetch([accepted('re_once')]);
    const results = await Promise.all([run(subscriber.id, stub), run(subscriber.id, stub), run(subscriber.id, stub)]);
    expect(results.filter((r) => r.result === 'sent')).toHaveLength(1);
    expect(stub.calls).toHaveLength(1);

    // a claim made a minute ago is another attempt still working: leave it; one made eleven minutes ago is a crash: retry it
    cleanSubscribers();
    const second = await subscribe('second@example.com');
    const now = new Date('2026-10-13T10:00:00Z');
    const claimAt = (minutesAgo: number) => data.updateNewsletterSubscriber(second.id, (current) => ({ ...current, welcome: { ...current.welcome!, status: 'sending', attemptedAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(), updatedAt: now.toISOString() } }));
    await claimAt(1);
    const again = stubFetch([accepted('re_stale')]);
    expect(await run(second.id, again, { now: () => now })).toEqual({ result: 'in_progress' });
    expect(again.calls).toHaveLength(0);
    await claimAt(11);
    expect(await run(second.id, again, { now: () => now })).toEqual({ result: 'sent', messageId: 're_stale' });
    expect(again.calls[0].headers['Idempotency-Key']).toBe(`welcome-${second.id}-newsletter_welcome-v1`);
  });

  test('welcome: unsubscribed addresses, subscribers from before the capability and unknown ids are never sent anything', async () => {
    await approveWelcome();
    const stub = stubFetch();
    const gone = await subscribe('gone@example.com');
    await data.updateNewsletterSubscriber(gone.id, (current) => ({ ...current, status: 'unsubscribed', unsubscribedAt: new Date().toISOString() }));
    expect(await run(gone.id, stub)).toEqual({ result: 'skipped', reason: 'unsubscribed' });
    expect((await subscriberOf(gone.id)).welcome).toMatchObject({ status: 'skipped', reason: 'unsubscribed' });

    // a subscriber saved before this capability existed has no welcome state
    const file = join(unitDir(), 'newsletter-subscribers.json');
    const list = JSON.parse(readFileSync(file, 'utf-8')) as Array<Record<string, unknown>>;
    list.push({ id: 'nl-legacy-1', email: 'legacy@example.com', createdAt: '2026-01-01T00:00:00.000Z', source: '/' });
    require('fs').writeFileSync(file, JSON.stringify(list), 'utf-8');
    expect(await run('nl-legacy-1', stub)).toEqual({ result: 'skipped', reason: 'legacy_subscriber' });
    expect(await run('nl-nobody', stub)).toEqual({ result: 'not_found' });
    expect(await sender.sendPendingWelcomes({ fetchImpl: stub.impl, env: ENV })).toMatchObject({ considered: 0, sent: 0 });
    expect(stub.calls).toHaveLength(0);
  });

  test('welcome: the queue sweeper retries on its own once the provider is ready, and can be cancelled', async () => {
    await approveWelcome();
    const subscriber = await subscribe();
    const notReady = stubFetch([refused(403, 'validation_error', 'The abentertainment.com.au domain is not verified.')]);
    expect(await run(subscriber.id, notReady)).toEqual({ result: 'pending', reason: 'provider_not_ready' });
    sender.cancelWelcomeSweep(); // the attempt scheduled one for five minutes; replace it with a quick one for the test
    const ready = stubFetch([accepted('re_swept')]);
    // the refusal held automatic attempts back for five minutes; by the time the sweeper looks, that has passed
    const later = () => new Date(Date.now() + 3_600_000);
    sender.scheduleWelcomeSweep({ fetchImpl: ready.impl, env: ENV, now: later }, 40);
    await expect.poll(async () => (await subscriberOf(subscriber.id)).welcome?.status, { timeout: 5000 }).toBe('sent');
    expect(ready.calls).toHaveLength(1);
    expect((await subscriberOf(subscriber.id)).welcome?.messageId).toBe('re_swept');

    const second = await subscribe('second@example.com');
    sender.scheduleWelcomeSweep({ fetchImpl: ready.impl, env: ENV }, 40);
    sender.cancelWelcomeSweep();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((await subscriberOf(second.id)).welcome?.status).toBe('pending');
    expect(ready.calls).toHaveLength(1);
  });

  test('a repeated automatic retry that meets the same blocker is not logged again', async () => {
    const subscriber = await subscribe();
    const stub = stubFetch();
    await run(subscriber.id, stub, { source: 'signup' });
    expect(await log.readSendLog()).toHaveLength(1);
    await run(subscriber.id, stub, { source: 'sweep' });
    await run(subscriber.id, stub, { source: 'sweep' });
    expect(await log.readSendLog()).toHaveLength(1);
    await run(subscriber.id, stub, { source: 'admin' }); // an admin's action is always recorded
    expect(await log.readSendLog()).toHaveLength(2);
  });

  // ─── test sends ────────────────────────────────────────────────────────────

  test('test send: the same gate and transport, an unsubscribe link that changes nothing, the cap shared, every refusal explained', async () => {
    const stub = stubFetch([accepted('re_test_1')]);
    const send = (input: Parameters<Sender['sendTestEmail']>[0], env: Record<string, string> = ENV) => sender.sendTestEmail(input, { fetchImpl: stub.impl, env });

    for (const to of ['a@b.co, c@d.co', 'x', 'Name <a@b.co>', 'a@b.co\r\nBcc: z@y.co', '', undefined, 42]) {
      expect(await send({ to }), String(to)).toMatchObject({ ok: false, status: 400, reason: 'invalid_recipient' });
    }
    expect(await send({ to: ADDRESS }, { SESSION_SECRET: ENV.SESSION_SECRET })).toMatchObject({ ok: false, status: 409, reason: 'not_configured' });
    expect(await send({ to: ADDRESS })).toMatchObject({ ok: false, status: 409, reason: 'no_active_version' }); // nothing approved or active yet
    await approveWelcome();
    expect(await send({ to: ADDRESS, templateKey: 'no_such_template' })).toMatchObject({ ok: false, status: 404, reason: 'template_not_found' });
    expect(await send({ to: ADDRESS, version: 9 })).toMatchObject({ ok: false, status: 404, reason: 'version_not_found' });
    expect(stub.calls).toHaveLength(0);

    const sent = await send({ to: 'Delivered@Resend.dev' });
    expect(sent).toEqual({ ok: true, messageId: 're_test_1', version: 1 });
    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0];
    expect(call.body.to).toEqual(['delivered@resend.dev']);
    expect(call.body.subject).toBe('Welcome to AB Entertainment'); // the approved content exactly, no test prefix
    expect(call.headers['Idempotency-Key']).toMatch(/^test-[0-9a-f-]{36}$/);
    const header = /unsubscribe\?t=([^>]+)>/.exec(call.body.headers['List-Unsubscribe']);
    expect(token.verifyUnsubscribeToken(header![1], ENV)).toEqual({ ok: true, subscriberId: token.TEST_SUBSCRIBER_ID });
    expect(call.body.html).toContain(`unsubscribe?t=${header![1]}`);
    const entry = (await log.readSendLog())[0];
    expect(entry).toMatchObject({ kind: 'test', outcome: 'sent', to: 'd***@resend.dev', messageId: 're_test_1', by: 'admin', version: 1 });

    // a version the admin has edited since (no approval) is refused, naming why
    const template = (await store.getEmailTemplates())[0];
    await store.updateEmailTemplate(template.id, { fields: { subject: 'A different welcome subject' } });
    expect(await send({ to: ADDRESS, version: 2 })).toMatchObject({ ok: false, status: 409, reason: 'not_approved' });
    expect(stub.calls).toHaveLength(1);

    // the cap is shared with welcome emails
    await store.updateEmailSettings({ hourlyCap: 1 });
    expect(await send({ to: ADDRESS })).toMatchObject({ ok: false, status: 429, reason: 'hourly_cap' });
    expect(stub.calls).toHaveLength(1);

    // provider problems come back as 502 with the reason, and are logged
    await store.updateEmailSettings({ hourlyCap: 30 });
    const notReady = stubFetch([refused(403, 'validation_error', 'The abentertainment.com.au domain is not verified.')]);
    const refusal = await sender.sendTestEmail({ to: ADDRESS }, { fetchImpl: notReady.impl, env: ENV });
    expect(refusal).toMatchObject({ ok: false, status: 502, reason: 'domain_not_verified' });
    expect((await log.readSendLog())[0]).toMatchObject({ kind: 'test', outcome: 'provider_not_ready', reason: 'domain_not_verified', httpStatus: 403 });
  });

  // ─── status and the log ────────────────────────────────────────────────────

  test('status: names of missing variables only, the approval state, the blockers, the counts and the cap', async () => {
    const empty = await sender.getSendingStatus({ env: {} });
    expect(empty).toMatchObject({ transport: 'resend', configured: false, missing: ['RESEND_API_KEY', 'EMAIL_FROM'], signing: { configured: false, source: null }, ai: { providers: [], available: false } });
    expect(empty.welcome).toMatchObject({ exists: true, enabled: true, activeVersion: null, approval: 'none', readyToSend: false });
    expect(empty.welcome.blockers).toEqual(['not_configured', 'no_signing_secret', 'no_active_version']);
    expect(empty.layout).toMatchObject({ id: 'ab-entertainment', installed: true });
    expect(empty.sending).toEqual({ sentLastHour: 0, hourlyCap: 30 });

    await approveWelcome();
    const ready = await sender.getSendingStatus({ env: { ...ENV, OPENAI_API_KEY: 'sk-test-not-real-0123456789' } });
    expect(ready).toMatchObject({ configured: true, missing: [], invalid: [], signing: { configured: true, source: 'SESSION_SECRET' }, ai: { providers: ['openai'], available: true } });
    expect(ready.welcome).toMatchObject({ approval: 'approved', activeVersion: 1, readyToSend: true, blockers: [] });
    expect(JSON.stringify(ready)).not.toContain(API_KEY);
    expect(JSON.stringify(ready)).not.toContain('sk-test-not-real');
    expect(JSON.stringify(ready)).not.toContain('newsletter@abentertainment.com.au'); // EMAIL_FROM's value is not shown

    await store.saveBrandGuidelines(`${seed.DEFAULT_GUIDELINES_TEXT}\n\nAnother rule.`, 'admin');
    const stale = await sender.getSendingStatus({ env: ENV });
    expect(stale.welcome).toMatchObject({ approval: 'stale', staleReasons: ['guidelines'], readyToSend: false });
    expect(stale.welcome.blockers).toEqual(['approval_stale']);

    const a = await subscribe('s1@example.com');
    await subscribe('s2@example.com');
    await data.updateNewsletterSubscriber(a.id, (current) => ({ ...current, status: 'unsubscribed' }));
    expect((await sender.getSendingStatus({ env: ENV })).subscribers).toEqual({ total: 2, subscribed: 1, unsubscribed: 1, welcomePending: 1, welcomeSent: 0, welcomeFailed: 0, welcomeSkipped: 0 });
  });

  test('send log: newest first, filtered, capped, never holds a secret or a whole address', async () => {
    const now = new Date('2026-10-13T10:00:00Z');
    for (let i = 0; i < 5; i += 1) await log.appendSendLog({ kind: i % 2 ? 'test' : 'welcome', outcome: i === 4 ? 'failed' : 'sent', to: 'j***@example.com', templateKey: 'newsletter_welcome', by: 'system' }, new Date(now.getTime() + i * 1000));
    const all = await log.readSendLog();
    expect(all.map((e) => e.at)).toEqual([...all.map((e) => e.at)].sort().reverse());
    expect(all).toHaveLength(5);
    expect((await log.readSendLog({ kind: 'test' })).every((e) => e.kind === 'test')).toBe(true);
    expect(await log.readSendLog({ outcome: 'failed' })).toHaveLength(1);
    expect(await log.readSendLog({ limit: 2 })).toHaveLength(2);
    // the log keeps only the newest entries
    const big = Array.from({ length: log.MAX_LOG_ENTRIES + 10 }, (_, i) => ({ id: `sl-${i}`, at: new Date(now.getTime() + i).toISOString(), kind: 'welcome', outcome: 'sent', to: 'j***@example.com', templateKey: 'newsletter_welcome', by: 'system' }));
    require('fs').writeFileSync(join(unitDir(), 'email-send-log.json'), JSON.stringify(big), 'utf-8');
    await log.appendSendLog({ kind: 'welcome', outcome: 'sent', to: 'j***@example.com', templateKey: 'newsletter_welcome', by: 'system' }, new Date(now.getTime() + 10_000_000));
    const stored = JSON.parse(readFileSync(join(unitDir(), 'email-send-log.json'), 'utf-8')) as unknown[];
    expect(stored).toHaveLength(log.MAX_LOG_ENTRIES);
    // a log file that does not parse is an error, never silently replaced
    require('fs').writeFileSync(join(unitDir(), 'email-send-log.json'), '{not json', 'utf-8');
    await expect(log.readSendLog()).rejects.toThrow();
    await expect(log.appendSendLog({ kind: 'welcome', outcome: 'sent', to: 'x', templateKey: 'k', by: 'system' })).rejects.toThrow();
    expect(readFileSync(join(unitDir(), 'email-send-log.json'), 'utf-8')).toBe('{not json');
  });

  // ─── the unsubscribe token ─────────────────────────────────────────────────

  test('unsubscribe token: signed, tamper-proof, tied to one subscriber, from a server secret only', () => {
    const minted = token.mintUnsubscribeToken('nl-1760000000000-abcd1234', ENV);
    expect(minted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    expect(minted).not.toContain(ADDRESS);
    expect(token.mintUnsubscribeToken('nl-1760000000000-abcd1234', ENV)).toBe(minted); // deterministic: the same link on a resend
    expect(token.mintUnsubscribeToken('nl-other', ENV)).not.toBe(minted);
    expect(token.verifyUnsubscribeToken(minted, ENV)).toEqual({ ok: true, subscriberId: 'nl-1760000000000-abcd1234' });
    // another secret does not verify it, and a changed id or signature does not either
    expect(token.verifyUnsubscribeToken(minted, { SESSION_SECRET: 'a-completely-different-secret-value-123' })).toEqual({ ok: false, reason: 'bad_signature' });
    const [version, id, signature] = minted.split('.');
    const otherId = Buffer.from('nl-victim').toString('base64url');
    expect(token.verifyUnsubscribeToken(`${version}.${otherId}.${signature}`, ENV)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(token.verifyUnsubscribeToken(`${version}.${id}.${signature.slice(0, -2)}AA`, ENV)).toEqual({ ok: false, reason: 'bad_signature' });
    for (const bad of ['', 'x', 'v1.a.b', 'v2.abc.def', `${minted}.extra`, 'v1..', null, undefined, 42, 'a'.repeat(400)]) expect(token.verifyUnsubscribeToken(bad, ENV), String(bad)).toMatchObject({ ok: false });
    // the dedicated secret wins over the session secret; a short or default secret is no secret at all
    const dedicated = { ...ENV, NEWSLETTER_UNSUBSCRIBE_SECRET: 'a-dedicated-unsubscribe-secret-0123456789' };
    expect(token.resolveSigningSecret(dedicated)?.source).toBe('NEWSLETTER_UNSUBSCRIBE_SECRET');
    expect(token.resolveSigningSecret(ENV)?.source).toBe('SESSION_SECRET');
    expect(token.verifyUnsubscribeToken(minted, dedicated)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(token.resolveSigningSecret({ SESSION_SECRET: 'short' })).toBeNull();
    expect(token.resolveSigningSecret({ SESSION_SECRET: 'admin123' })).toBeNull();
    expect(() => token.mintUnsubscribeToken('nl-1', {})).toThrow(token.NoSigningSecretError);
    expect(token.verifyUnsubscribeToken(minted, {})).toEqual({ ok: false, reason: 'no_secret' });
    expect(token.TEST_SUBSCRIBER_ID).toBe('test');
  });
});
