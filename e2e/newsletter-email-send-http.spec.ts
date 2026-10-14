/**
 * Newsletter email sending over HTTP: the real signup route and admin endpoints against a local dev server, with a
 * mock of the Resend API on loopback.
 *
 * The dev server must be started with fake Resend settings and RESEND_BASE_URL=http://127.0.0.1:3199 (the base URL can
 * only be the real API or a loopback address), so no request can leave the machine: this file starts the mock on that
 * port, seeds an approved welcome template into the server's data directory (the review itself is covered in-process
 * with a scripted AI; here the AI is unavailable), and checks the whole chain: subscribe -> welcome request at the
 * mock (headers and body asserted) -> send log with the message id -> admin status, send-pending and test send.
 * It writes the server's data directory, so it only runs against this machine and restores every file it touches.
 */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { HARNESS, HAS_ADMIN_CREDS, HARNESS_SKIP, MockResend, SERVER_DATA_DIR as DATA_DIR, SITE_ORIGIN, adminApi, adminLogin, readSubscribers, seedApprovedTemplate, subscribePublic as subscribe } from './support/email-http';

const FILES = ['email-templates.json', 'email-settings.json', 'email-guidelines.json', 'email-send-log.json', 'email-provider-state.json', 'email-reviewer-state.json', 'newsletter-subscribers.json'];

test.describe.configure({ mode: 'serial' });

test.describe('welcome email over HTTP (Resend mocked on loopback)', () => {
  const saved = new Map<string, string | null>();
  const mock = new MockResend();

  test.beforeAll(async ({ baseURL }) => {
    const host = new URL(baseURL ?? 'http://localhost:3000').hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`Refusing to run: baseURL (${baseURL}) is not on this machine.`);
    if (!HARNESS) return;
    for (const file of FILES) saved.set(file, existsSync(join(DATA_DIR, file)) ? readFileSync(join(DATA_DIR, file), 'utf-8') : null);
    await mock.start();
  });

  test.afterAll(async () => {
    if (!HARNESS) return;
    await mock.stop();
    for (const [file, content] of saved) {
      if (content === null) rmSync(join(DATA_DIR, file), { force: true });
      else writeFileSync(join(DATA_DIR, file), content, 'utf-8');
    }
  });

  test.beforeEach(() => {
    if (!HARNESS) return;
    mock.reset();
    for (const file of FILES) rmSync(join(DATA_DIR, file), { force: true });
  });

  test('every sending endpoint is a 401 without a session', async ({ request }) => {
    const origin = { origin: SITE_ORIGIN };
    expect((await request.get('/api/admin/newsletter/status')).status()).toBe(401);
    expect((await request.get('/api/admin/newsletter/log')).status()).toBe(401);
    expect((await request.post('/api/admin/newsletter/send', { data: { mode: 'pending' }, headers: origin })).status()).toBe(401);
    expect((await request.post('/api/admin/newsletter/send', { data: { mode: 'test', to: 'a@b.co' }, headers: origin })).status()).toBe(401);
    expect(mock.requests).toHaveLength(0);
  });

  test('subscribing sends the welcome: the signup answers at once, the mock receives the exact request, the log and the subscriber carry the message id', async ({ request, page }) => {
    test.skip(!HAS_ADMIN_CREDS || !HARNESS, HARNESS_SKIP);
    await seedApprovedTemplate();
    const email = `Welcome.Http.${Date.now()}@Example.com`;
    const started = Date.now();
    const response = await subscribe(request, email);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(Date.now() - started).toBeLessThan(10_000);

    await expect.poll(() => mock.requests.length, { timeout: 30_000 }).toBe(1);
    const sent = mock.requests[0];
    const stored = readSubscribers();
    expect(stored).toHaveLength(1);
    const subscriber = stored[0];
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe('/emails');
    expect(sent.headers.authorization).toBe('Bearer re_local_test_0123456789abcdef');
    expect(sent.headers['content-type']).toBe('application/json');
    expect(sent.headers['idempotency-key']).toBe(`welcome-${subscriber.id}-newsletter_welcome-v1`);
    expect(sent.body).toMatchObject({
      from: 'AB Entertainment <newsletter@abentertainment.com.au>',
      to: [email.toLowerCase()],
      reply_to: 'abhi@abentertainment.com.au',
      subject: 'Welcome to AB Entertainment',
      tags: [{ name: 'category', value: 'newsletter_welcome' }],
    });
    const headers = sent.body.headers as Record<string, string>;
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const link = /^<(https:\/\/abentertainment\.com\.au\/api\/newsletter\/unsubscribe\?t=v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)>$/.exec(headers['List-Unsubscribe']);
    expect(link).not.toBeNull();
    expect(String(sent.body.html)).toContain(link![1]);
    expect(String(sent.body.text)).toContain(`Unsubscribe: ${link![1]}`);
    expect(String(sent.body.html)).toContain('The AB Entertainment Community');
    expect(String(sent.body.html).length).toBeGreaterThan(5000);

    await expect.poll(() => readSubscribers()[0]?.welcome?.status, { timeout: 15_000 }).toBe('sent');
    expect(readSubscribers()[0].welcome).toMatchObject({ status: 'sent', messageId: 're_mock_1', version: 1 });

    await adminLogin(page);
    const log = await adminApi(page, 'GET', '/api/admin/newsletter/log');
    expect(log.status).toBe(200);
    const entries = log.body?.entries as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'welcome', outcome: 'sent', messageId: 're_mock_1', to: 'w***@example.com', templateKey: 'newsletter_welcome', version: 1, httpStatus: 200 });
    expect(JSON.stringify(log.body)).not.toContain('re_local_test_0123456789abcdef');
    expect(JSON.stringify(log.body)).not.toContain(email.toLowerCase());
    expect((await adminApi(page, 'GET', '/api/admin/newsletter/log?outcome=failed')).body?.entries).toEqual([]);
    expect((await adminApi(page, 'GET', '/api/admin/newsletter/log?outcome=nonsense')).status).toBe(400);
    expect((await adminApi(page, 'GET', '/api/admin/newsletter/log?limit=0')).status).toBe(400);

    const status = await adminApi(page, 'GET', '/api/admin/newsletter/status');
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      transport: 'resend',
      configured: true,
      missing: [],
      signing: { configured: true, source: 'SESSION_SECRET' },
      ai: { providers: ['anthropic', 'openai'], available: true },
      reviewer: {
        setting: '',
        chain: [{ provider: 'anthropic', model: 'claude-opus-5-5' }, { provider: 'anthropic', model: 'claude-sonnet-5-5' }, { provider: 'openai', model: 'gpt-5.4' }, { provider: 'openai', model: 'gpt-4.1-mini' }],
        availability: [
          { provider: 'anthropic', model: 'claude-opus-5-5', outcome: null, at: null },
          { provider: 'anthropic', model: 'claude-sonnet-5-5', outcome: null, at: null },
          { provider: 'openai', model: 'gpt-5.4', outcome: null, at: null },
          { provider: 'openai', model: 'gpt-4.1-mini', outcome: null, at: null },
        ],
        inUse: { provider: 'anthropic', model: 'claude-opus-5-5' },
      },
      layout: { id: 'ab-entertainment', installed: true },
      welcome: { approval: 'approved', activeVersion: 1, readyToSend: true, blockers: [] },
      subscribers: { total: 1, subscribed: 1, unsubscribed: 0, welcomePending: 0, welcomeSent: 1, welcomeFailed: 0, welcomeSkipped: 0 },
      sending: { sentLastHour: 1, hourlyCap: 30 },
    });
    expect(JSON.stringify(status.body)).not.toContain('re_local_test_0123456789abcdef');
    expect(JSON.stringify(status.body)).not.toContain('sk-ant-local');
    expect(JSON.stringify(status.body)).not.toContain('sk-openai-local');
    expect(JSON.stringify(status.body)).not.toContain('newsletter@abentertainment.com.au');
  });

  test('a failing send never breaks the signup: the subscriber is saved, the failure is on record and visible, and it is sent once the provider is ready', async ({ request, page }) => {
    test.skip(!HAS_ADMIN_CREDS || !HARNESS, HARNESS_SKIP);
    await seedApprovedTemplate();
    mock.answers = [{ status: 403, body: { statusCode: 403, name: 'validation_error', message: 'The abentertainment.com.au domain is not verified. Please, add and verify your domain on https://resend.com/domains' } }];
    const email = `pending.http.${Date.now()}@example.com`;
    const response = await subscribe(request, email);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    await expect.poll(() => mock.requests.length, { timeout: 30_000 }).toBe(1);
    await expect.poll(() => readSubscribers()[0]?.welcome?.reason, { timeout: 15_000 }).toBe('provider_not_ready');
    expect(readSubscribers()[0]).toMatchObject({ email, status: 'subscribed', welcome: { status: 'pending', reason: 'provider_not_ready' } });

    await adminLogin(page);
    const log = await adminApi(page, 'GET', '/api/admin/newsletter/log');
    const entries = log.body?.entries as Array<Record<string, unknown>>;
    expect(entries[0]).toMatchObject({ kind: 'welcome', outcome: 'provider_not_ready', httpStatus: 403, code: 'validation_error', reason: 'domain_not_verified', to: 'p***@example.com' });
    expect(entries[0].messageId).toBeUndefined();
    expect(String(entries[0].detail)).toContain('not verified');
    const before = await adminApi(page, 'GET', '/api/admin/newsletter/status');
    expect(before.body).toMatchObject({ subscribers: { welcomePending: 1, welcomeSent: 0 } });

    // the provider becomes ready: the admin's "send pending" delivers it, with the same idempotency key as the first attempt
    const sendPending = await adminApi(page, 'POST', '/api/admin/newsletter/send', { mode: 'pending' });
    expect(sendPending.status).toBe(200);
    expect(sendPending.body).toMatchObject({ mode: 'pending', considered: 1, sent: 1, failed: 0, pending: 0 });
    expect(mock.requests).toHaveLength(2);
    expect(mock.requests[1].headers['idempotency-key']).toBe(mock.requests[0].headers['idempotency-key']);
    expect(readSubscribers()[0].welcome).toMatchObject({ status: 'sent', messageId: 're_mock_1' });
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/send', { mode: 'pending' })).body).toMatchObject({ considered: 0, sent: 0 });
    expect(mock.requests).toHaveLength(2);
  });

  test('without an approved template the signup still succeeds and nothing leaves the server; the reason is visible to admins', async ({ request, page }) => {
    test.skip(!HAS_ADMIN_CREDS || !HARNESS, HARNESS_SKIP);
    const email = `unapproved.http.${Date.now()}@example.com`;
    const response = await subscribe(request, email);
    expect(response.status()).toBe(200);
    await expect.poll(() => readSubscribers()[0]?.welcome?.reason, { timeout: 30_000 }).toBe('no_active_version');
    expect(mock.requests).toHaveLength(0);
    await adminLogin(page);
    const status = await adminApi(page, 'GET', '/api/admin/newsletter/status');
    expect(status.body).toMatchObject({ welcome: { approval: 'none', readyToSend: false, blockers: ['no_active_version'] }, subscribers: { welcomePending: 1 } });
    const entries = (await adminApi(page, 'GET', '/api/admin/newsletter/log')).body?.entries as Array<Record<string, unknown>>;
    expect(entries[0]).toMatchObject({ kind: 'welcome', outcome: 'blocked', reason: 'no_active_version' });
    // a queued run stops at the first blocker without a request
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/send', { mode: 'pending' })).body).toMatchObject({ considered: 1, sent: 0, pending: 1, stoppedBecause: 'no_active_version' });
    expect(mock.requests).toHaveLength(0);
  });

  test('the admin test send goes through the same gate and transport; refusals say why', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS || !HARNESS, HARNESS_SKIP);
    await adminLogin(page);
    const send = (body: unknown) => adminApi(page, 'POST', '/api/admin/newsletter/send', body);
    expect((await send({})).status).toBe(400);
    expect((await send({ mode: 'bulk' })).status).toBe(400);
    expect((await send({ mode: 'test', to: 'two@example.com, three@example.com' })).status).toBe(400);
    expect((await send({ mode: 'test', to: 'a@example.com', version: 1.5 })).status).toBe(400);
    // nothing approved yet: refused, naming the reason, no request
    const refused = await send({ mode: 'test', to: 'delivered@resend.dev' });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ reason: 'no_active_version' });
    expect(mock.requests).toHaveLength(0);

    await seedApprovedTemplate();
    expect((await send({ mode: 'test', to: 'delivered@resend.dev', version: 7 })).status).toBe(404);
    const sent = await send({ mode: 'test', to: 'Delivered@Resend.dev' });
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ mode: 'test', sent: true, messageId: 're_mock_1', version: 1 });
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0].body).toMatchObject({ to: ['delivered@resend.dev'], subject: 'Welcome to AB Entertainment' });
    expect(mock.requests[0].headers['idempotency-key']).toMatch(/^test-/);
    const entries = (await adminApi(page, 'GET', '/api/admin/newsletter/log?kind=test')).body?.entries as Array<Record<string, unknown>>;
    expect(entries[0]).toMatchObject({ kind: 'test', outcome: 'sent', messageId: 're_mock_1', to: 'd***@resend.dev', by: 'admin' });

    // a provider refusal comes back as 502 with the reason
    mock.answers = [{ status: 403, body: { statusCode: 403, name: 'validation_error', message: 'The abentertainment.com.au domain is not verified.' } }];
    const notReady = await send({ mode: 'test', to: 'delivered@resend.dev' });
    expect(notReady.status).toBe(502);
    expect(notReady.body).toMatchObject({ reason: 'domain_not_verified' });
  });
});
