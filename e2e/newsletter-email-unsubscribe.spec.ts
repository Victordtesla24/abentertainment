/**
 * Newsletter unsubscribe: the link in every email, in-process and then over HTTP.
 *
 * In-process: following the link never changes anything (it only previews), the removal by POST (idempotent, masked log
 * entry, nothing revealed), every token that must change nothing, a queued welcome for a removed subscriber, the branded
 * pages against the design tokens and the brand voice.
 * Over HTTP (a local dev server with a Resend mock on loopback): the link taken from a real welcome request at the mock;
 * a GET or HEAD (what a mail-security scanner, a previewer or a prefetcher does) leaves the subscriber in place; the
 * confirmation page's form POST and the RFC 8058 one-click POST each remove them; invalid links; the admin list and send
 * log; the link of an admin test email. Nothing here touches production.
 */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir, unitDir } from './support/email-unit';
import { HAS_ADMIN_CREDS, MockResend, SERVER_DATA_DIR, adminApi, adminLogin, readSubscribers, seedApprovedTemplate, subscribePublic } from './support/email-http';

type Unsub = typeof import('@/lib/email/unsubscribe');
type Page = typeof import('@/lib/email/unsubscribe-page');
type Token = typeof import('@/lib/email/unsubscribe-token');
type Log = typeof import('@/lib/email/send-log');
type Data = typeof import('@/lib/data');
type Tokens = typeof import('@/lib/email/design-tokens');
type Rules = typeof import('@/lib/email/gate-rules');
type Sender = typeof import('@/lib/email/sender');

const ENV = { SESSION_SECRET: 'unit-test-session-secret-0123456789abcdef' };

test.describe.configure({ mode: 'serial' });

test.describe('unsubscribe (in-process)', () => {
  let unsub: Unsub;
  let page: Page;
  let token: Token;
  let log: Log;
  let data: Data;
  let tokens: Tokens;
  let rules: Rules;
  let sender: Sender;

  test.beforeAll(() => {
    loadWithUnitDir(() => {
      data = require('@/lib/data') as Data;
      unsub = require('@/lib/email/unsubscribe') as Unsub;
      page = require('@/lib/email/unsubscribe-page') as Page;
      token = require('@/lib/email/unsubscribe-token') as Token;
      log = require('@/lib/email/send-log') as Log;
      tokens = require('@/lib/email/design-tokens') as Tokens;
      rules = require('@/lib/email/gate-rules') as Rules;
      sender = require('@/lib/email/sender') as Sender;
    });
  });

  test.beforeEach(() => cleanUnitDir());
  test.afterEach(() => sender.cancelWelcomeSweep());

  async function subscribe(email: string) {
    const added = await data.addNewsletterSubscriber({ email, source: '/about/' });
    if (added.status !== 'created') throw new Error('not created');
    return added.subscriber;
  }

  test('confirming removes the subscriber, leaves a masked record, and the same link again gives the same answer', async () => {
    const jane = await subscribe('jane.doe@example.com');
    const other = await subscribe('other.person@example.com');
    const link = token.mintUnsubscribeToken(jane.id, ENV);

    expect(await unsub.unsubscribeByToken(link, 'confirm_page', { env: ENV })).toEqual({ result: 'done', removed: true });
    expect((await data.getNewsletterSubscribers()).map((s) => s.email)).toEqual(['other.person@example.com']); // only that one subscriber went
    const entries = await log.readSendLog({ kind: 'unsubscribe' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'unsubscribe', outcome: 'unsubscribed', to: 'j***@example.com', subscriberId: jane.id, reason: 'confirm_page', by: 'system' });
    expect(JSON.stringify(entries)).not.toContain('jane.doe@example.com');

    // a second confirmation, a mail app's one-click, or an address an admin had already deleted: the same answer, no entry
    expect(await unsub.unsubscribeByToken(link, 'confirm_page', { env: ENV })).toEqual({ result: 'done', removed: false });
    expect(await unsub.unsubscribeByToken(link, 'one_click', { env: ENV })).toEqual({ result: 'done', removed: false });
    expect(await log.readSendLog({ kind: 'unsubscribe' })).toHaveLength(1);

    // the one-click path records how it happened
    expect(await unsub.unsubscribeByToken(token.mintUnsubscribeToken(other.id, ENV), 'one_click', { env: ENV })).toEqual({ result: 'done', removed: true });
    expect((await log.readSendLog({ kind: 'unsubscribe' }))[0]).toMatchObject({ reason: 'one_click', to: 'o***@example.com' });
    expect(await data.getNewsletterSubscribers()).toEqual([]);
  });

  test('following the link only previews: nothing is removed, logged or written, however often a scanner fetches it', async () => {
    const jane = await subscribe('jane.doe@example.com');
    await subscribe('other.person@example.com');
    const link = token.mintUnsubscribeToken(jane.id, ENV);
    const listFile = join(unitDir(), 'newsletter-subscribers.json');
    const logFile = join(unitDir(), 'email-send-log.json');
    const before = readFileSync(listFile, 'utf-8');
    for (let i = 0; i < 5; i += 1) expect(await unsub.previewUnsubscribe(link, { env: ENV })).toEqual({ result: 'confirm', masked: 'j***@example.com' });
    expect(readFileSync(listFile, 'utf-8')).toBe(before); // the list file is byte for byte what it was
    expect(existsSync(logFile)).toBe(false); // and nothing was logged
    expect(await data.getNewsletterSubscribers()).toHaveLength(2);

    // the preview tells the truth about the link, and still changes nothing
    expect(await unsub.previewUnsubscribe(token.mintUnsubscribeToken(token.TEST_SUBSCRIBER_ID, ENV), { env: ENV })).toEqual({ result: 'confirm', masked: null });
    expect(await unsub.previewUnsubscribe(token.mintUnsubscribeToken('nl-gone-1', ENV), { env: ENV })).toEqual({ result: 'already' });
    for (const bad of ['', 'garbage', null, undefined, `${link}x`, token.mintUnsubscribeToken(jane.id, { SESSION_SECRET: 'a-completely-different-secret-value-123' })]) expect(await unsub.previewUnsubscribe(bad, { env: ENV }), String(bad)).toEqual({ result: 'invalid' });
    expect(await unsub.previewUnsubscribe(link, { env: {} })).toEqual({ result: 'unavailable' });
    expect(readFileSync(listFile, 'utf-8')).toBe(before);

    // after the subscriber confirms, the same link previews as already done
    await unsub.unsubscribeByToken(link, 'confirm_page', { env: ENV });
    expect(await unsub.previewUnsubscribe(link, { env: ENV })).toEqual({ result: 'already' });

    // a damaged list is "unavailable" and is not touched
    writeFileSync(listFile, '{not json', 'utf-8');
    expect(await unsub.previewUnsubscribe(token.mintUnsubscribeToken('nl-anyone-1', ENV), { env: ENV })).toEqual({ result: 'unavailable' });
    expect(readFileSync(listFile, 'utf-8')).toBe('{not json');
  });

  test('a link that does not verify changes nothing: tampered, another secret, malformed, missing; the test token and an unknown id are accepted without change', async () => {
    const jane = await subscribe('jane.doe@example.com');
    const good = token.mintUnsubscribeToken(jane.id, ENV);
    const [version, id, signature] = good.split('.');
    const bad: unknown[] = [
      `${version}.${Buffer.from('someone-else').toString('base64url')}.${signature}`,
      `${version}.${id}.${signature.slice(0, -3)}abc`,
      token.mintUnsubscribeToken(jane.id, { SESSION_SECRET: 'a-completely-different-secret-value-123' }),
      'v1.a.b', '', 'not a token', null, undefined, 42, `${good}x`,
    ];
    for (const attempt of bad) expect(await unsub.unsubscribeByToken(attempt, 'confirm_page', { env: ENV }), String(attempt)).toEqual({ result: 'invalid' });
    expect(await data.getNewsletterSubscribers()).toHaveLength(1);
    expect(await log.readSendLog({ kind: 'unsubscribe' })).toEqual([]);

    // the server cannot check tokens without a secret: unavailable, nothing changed
    expect(await unsub.unsubscribeByToken(good, 'confirm_page', { env: {} })).toEqual({ result: 'unavailable' });
    expect(await data.getNewsletterSubscribers()).toHaveLength(1);

    // the admin's test emails carry a token for the reserved id: it works and removes nobody
    expect(await unsub.unsubscribeByToken(token.mintUnsubscribeToken(token.TEST_SUBSCRIBER_ID, ENV), 'confirm_page', { env: ENV })).toEqual({ result: 'done', removed: false });
    // a valid token for an id that is not on the list (already deleted): done, nothing to remove
    expect(await unsub.unsubscribeByToken(token.mintUnsubscribeToken('nl-gone-1', ENV), 'confirm_page', { env: ENV })).toEqual({ result: 'done', removed: false });
    expect(await data.getNewsletterSubscribers()).toHaveLength(1);
  });

  test('a damaged subscriber list gives "unavailable" and is left exactly as it was', async () => {
    const jane = await subscribe('jane.doe@example.com');
    const file = join(unitDir(), 'newsletter-subscribers.json');
    writeFileSync(file, '{not json', 'utf-8');
    expect(await unsub.unsubscribeByToken(token.mintUnsubscribeToken(jane.id, ENV), 'confirm_page', { env: ENV })).toEqual({ result: 'unavailable' });
    expect(readFileSync(file, 'utf-8')).toBe('{not json');
  });

  test('a welcome that was waiting for a removed subscriber is never sent', async () => {
    const jane = await subscribe('jane.doe@example.com');
    await unsub.unsubscribeByToken(token.mintUnsubscribeToken(jane.id, ENV), 'confirm_page', { env: ENV });
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    expect(await sender.attemptWelcome(jane.id, { fetchImpl, env: { ...ENV, RESEND_API_KEY: 're_test_0123456789abcdef', EMAIL_FROM: 'AB Entertainment <newsletter@abentertainment.com.au>' } })).toEqual({ result: 'not_found' });
    expect(await sender.sendPendingWelcomes({ fetchImpl, env: ENV })).toMatchObject({ considered: 0, sent: 0 });
    expect(calls).toBe(0);
  });

  test('the confirmation page: brand tokens only, the brand voice, nothing indexable, nothing that leaks the link', () => {
    for (const kind of ['done', 'invalid', 'unavailable'] as const) {
      const html = page.renderUnsubscribePage(kind);
      expect(tokens.findOffBrandTokens(html), kind).toEqual({ colours: [], fonts: [] });
      expect(rules.hasEmoji(html), kind).toBe(false);
      expect(html, kind).toContain('<meta name="robots" content="noindex,nofollow">');
      expect(html, kind).toContain('<meta name="referrer" content="no-referrer">');
      expect(html, kind).toContain('<html lang="en-AU">');
      expect(html, kind).toContain('alt="AB Entertainment"');
      expect(html, kind).not.toMatch(/<script|<form|<link\b|@import|url\(/i);
      const copy = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ' ');
      expect(copy, kind).not.toMatch(/!/); // no exclamation marks in the brand's copy
      expect(copy, kind).not.toMatch(/\b(?:we|our|us)\b/i); // the company is AB Entertainment, in the third person
      expect(html, kind).toContain('href="https://abentertainment.com.au/"');
      expect(Buffer.byteLength(html), kind).toBeLessThan(8000);
    }
    // the confirmation page: a form that posts to the same link, the one button that unsubscribes, a way back
    const action = '/api/newsletter/unsubscribe?t=v1.abc_DEF-123.sig_456';
    const confirm = page.renderUnsubscribePage('confirm', 'https://abentertainment.com.au', { action, masked: 'j***@example.com' });
    expect(tokens.findOffBrandTokens(confirm)).toEqual({ colours: [], fonts: [] });
    expect(rules.hasEmoji(confirm)).toBe(false);
    expect(confirm).toContain('<h1>Confirm Unsubscribe</h1>');
    expect(confirm).toContain(`<form method="post" action="${action}">`);
    expect(confirm).toContain('<input type="hidden" name="confirm" value="unsubscribe">');
    expect(confirm.match(/<form\b/g)).toHaveLength(1);
    expect(confirm.match(/<button\b/g)).toHaveLength(1); // one button that unsubscribes
    expect(confirm).toContain('<button class="button" type="submit">Unsubscribe</button>');
    expect(confirm).toContain('<a class="secondary" href="https://abentertainment.com.au/">Keep Me Subscribed</a>');
    expect(confirm).toContain('You are on the AB Entertainment newsletter list as j***@example.com.');
    expect(confirm).toContain('If you followed this link by mistake, close this page: nothing has been changed.');
    expect(confirm).toContain('<meta name="robots" content="noindex,nofollow">');
    expect(confirm).toContain('<meta name="referrer" content="no-referrer">');
    expect(confirm).not.toMatch(/<script|<link\b|@import|url\(|onclick|onsubmit/i);
    const confirmCopy = confirm.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ' ');
    expect(confirmCopy).not.toMatch(/!/);
    expect(confirmCopy).not.toMatch(/\b(?:we|our|us)\b/i);
    expect(rules.titleCaseProblems('Confirm Unsubscribe')).toEqual([]);
    // without a masked address (an admin's test email) it still names the list; the action is escaped
    expect(page.renderUnsubscribePage('confirm', 'https://abentertainment.com.au', { action, masked: null })).toContain('You are on the AB Entertainment newsletter list. Confirm below');
    const hostile = page.renderUnsubscribePage('confirm', 'https://abentertainment.com.au', { action: '/x?t="><script>x</script>', masked: null });
    expect(hostile).not.toContain('<script>x</script>');
    expect(hostile).toContain('&quot;&gt;&lt;script&gt;');
    const done = page.renderUnsubscribePage('done');
    expect(done).toContain('<h1>You Have Been Unsubscribed</h1>');
    expect(done).toContain('AB Entertainment has removed your address from the newsletter list. You will receive no further newsletter emails.');
    expect(done).toContain('Return to AB Entertainment</a>');
    expect(page.renderUnsubscribePage('invalid')).toContain('<h1>This Link Is Not Valid</h1>');
    expect(page.renderUnsubscribePage('invalid')).toContain('<a href="mailto:abhi@abentertainment.com.au">abhi@abentertainment.com.au</a>');
    expect(page.renderUnsubscribePage('unavailable')).toContain('<h1>Please Try Again Shortly</h1>');
    // headings are Title Case, as the gate demands of the emails
    expect(rules.titleCaseProblems('You Have Been Unsubscribed')).toEqual([]);
    expect(rules.titleCaseProblems('This Link Is Not Valid')).toEqual([]);
    expect(rules.titleCaseProblems('Please Try Again Shortly')).toEqual([]);
    // the site URL passed in is escaped
    expect(page.renderUnsubscribePage('done', 'https://abentertainment.com.au"><script>x</script>')).not.toContain('<script>x</script>');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP
// ═══════════════════════════════════════════════════════════════════════════════

const FILES = ['email-templates.json', 'email-settings.json', 'email-guidelines.json', 'email-send-log.json', 'newsletter-subscribers.json'];

test.describe('unsubscribe over HTTP (Resend mocked on loopback)', () => {
  const saved = new Map<string, string | null>();
  const mock = new MockResend();

  test.beforeAll(async ({ baseURL }) => {
    const host = new URL(baseURL ?? 'http://localhost:3000').hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`Refusing to run: baseURL (${baseURL}) is not on this machine.`);
    for (const file of FILES) saved.set(file, existsSync(join(SERVER_DATA_DIR, file)) ? readFileSync(join(SERVER_DATA_DIR, file), 'utf-8') : null);
    await mock.start();
  });

  test.afterAll(async () => {
    await mock.stop();
    for (const [file, content] of saved) {
      if (content === null) rmSync(join(SERVER_DATA_DIR, file), { force: true });
      else writeFileSync(join(SERVER_DATA_DIR, file), content, 'utf-8');
    }
  });

  test.beforeEach(() => {
    mock.reset();
    for (const file of FILES) rmSync(join(SERVER_DATA_DIR, file), { force: true });
  });

  /** The path and query of the unsubscribe link in a request the mock received: the link is taken from the List-Unsubscribe header. */
  function linkOf(index: number): { pathAndQuery: string; absolute: string; htmlHasIt: boolean } {
    const body = mock.requests[index].body as { headers: Record<string, string>; html: string; text: string };
    const match = /^<(https:\/\/abentertainment\.com\.au\/api\/newsletter\/unsubscribe\?t=[^>]+)>$/.exec(body.headers['List-Unsubscribe']);
    if (!match) throw new Error('no unsubscribe link in the request');
    const url = new URL(match[1]);
    return { pathAndQuery: `${url.pathname}${url.search}`, absolute: match[1], htmlHasIt: body.html.includes(match[1]) && body.text.includes(match[1]) };
  }

  test('following the link in a real welcome email changes nothing, however it is fetched; confirming on the page unsubscribes; the list and the log show it', async ({ request, page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await seedApprovedTemplate();
    const email = `unsub.http.${Date.now()}@example.com`;
    const keep = `keeper.http.${Date.now()}@example.com`;
    expect((await subscribePublic(request, email)).status()).toBe(200);
    expect((await subscribePublic(request, keep)).status()).toBe(200);
    await expect.poll(() => mock.requests.length, { timeout: 30_000 }).toBe(2);
    await expect.poll(() => readSubscribers().filter((s) => s.welcome?.status === 'sent').length, { timeout: 15_000 }).toBe(2);
    const toThem = mock.requests.findIndex((r) => (r.body.to as string[])[0] === email);
    const link = linkOf(toThem);
    expect(link.htmlHasIt).toBe(true); // the same link is in the header, the HTML and the plain-text part
    const both = () => readSubscribers().map((s) => s.email).sort();
    expect(both()).toEqual([email, keep].sort());

    // what a mail-security scanner, a previewer or a prefetcher does: HEAD, and GET, again and again. Nobody is unsubscribed.
    for (let i = 0; i < 3; i += 1) {
      expect((await request.head(link.pathAndQuery)).status()).toBe(200);
      const scanned = await request.get(link.pathAndQuery);
      expect(scanned.status()).toBe(200);
      expect(await scanned.text()).toContain('<h1>Confirm Unsubscribe</h1>');
    }
    expect(both()).toEqual([email, keep].sort());
    expect(existsSync(join(SERVER_DATA_DIR, 'email-send-log.json')) ? (JSON.parse(readFileSync(join(SERVER_DATA_DIR, 'email-send-log.json'), 'utf-8')) as Array<{ kind: string }>).filter((e) => e.kind === 'unsubscribe') : []).toEqual([]);

    // the page a GET shows: which list, the masked address, one button that posts to this same link, a way back
    const followed = await request.get(link.pathAndQuery);
    expect(followed.headers()['content-type']).toContain('text/html');
    expect(followed.headers()['cache-control']).toBe('no-store');
    expect(followed.headers()['x-robots-tag']).toContain('noindex');
    expect(followed.headers()['referrer-policy']).toBe('no-referrer');
    const confirmation = await followed.text();
    expect(confirmation).toContain('You are on the AB Entertainment newsletter list as u***@example.com.');
    expect(confirmation).toContain(`<form method="post" action="${link.pathAndQuery}">`);
    expect(confirmation).toContain('<button class="button" type="submit">Unsubscribe</button>');
    expect(confirmation).toContain('Keep Me Subscribed</a>');
    expect(confirmation).not.toContain(email);

    // the recipient confirms, as a browser does: the form posts its fields to the link
    const confirmed = await request.post(link.pathAndQuery, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'confirm=unsubscribe' });
    expect(confirmed.status()).toBe(200);
    expect(confirmed.headers()['content-type']).toContain('text/html');
    const done = await confirmed.text();
    expect(done).toContain('<h1>You Have Been Unsubscribed</h1>');
    expect(done).not.toContain(email);
    expect(both()).toEqual([keep]); // removed, and only them
    // the same link again: GET now says it is done, a second confirmation and a mail app's one-click give the same answer
    expect(await (await request.get(link.pathAndQuery)).text()).toContain('<h1>You Have Been Unsubscribed</h1>');
    expect((await request.post(link.pathAndQuery, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'confirm=unsubscribe' })).status()).toBe(200);
    const again = await request.post(link.pathAndQuery, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'List-Unsubscribe=One-Click' });
    expect(again.status()).toBe(200);
    expect(await again.text()).toBe('Unsubscribed');
    expect(both()).toEqual([keep]);

    // the admin sees it: the list no longer has the address, the log has one masked record
    await adminLogin(page);
    const list = await adminApi(page, 'GET', '/api/admin/newsletter');
    expect((list.body?.subscribers as Array<{ email: string }>).map((s) => s.email)).toEqual([keep]);
    const entries = (await adminApi(page, 'GET', '/api/admin/newsletter/log?kind=unsubscribe')).body?.entries as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'unsubscribe', outcome: 'unsubscribed', reason: 'confirm_page', to: 'u***@example.com' });
    expect(JSON.stringify(entries)).not.toContain(email);
    expect((await adminApi(page, 'GET', '/api/admin/newsletter/status')).body).toMatchObject({ subscribers: { total: 1, welcomeSent: 1 } });
  });

  test('in a browser: the link opens the confirmation page, nothing happens until the button is pressed, and then the page says it is done', async ({ request, page, baseURL }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await seedApprovedTemplate();
    const email = `browser.http.${Date.now()}@example.com`;
    expect((await subscribePublic(request, email)).status()).toBe(200);
    await expect.poll(() => mock.requests.length, { timeout: 30_000 }).toBe(1);
    const link = linkOf(0);
    // only this machine is ever visited: the path and query of the link, on the dev server
    await page.goto(new URL(link.pathAndQuery, baseURL).toString());
    await expect(page.getByRole('heading', { name: 'Confirm Unsubscribe' })).toBeVisible();
    await expect(page.getByText('You are on the AB Entertainment newsletter list as b***@example.com.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Keep Me Subscribed' })).toBeVisible();
    await page.waitForTimeout(500);
    expect(readSubscribers().map((s) => s.email)).toEqual([email]); // looking at the page removed nobody
    await page.getByRole('button', { name: 'Unsubscribe' }).click();
    await expect(page.getByRole('heading', { name: 'You Have Been Unsubscribed' })).toBeVisible();
    expect(readSubscribers()).toEqual([]);
    // reloading the result page (a repeated POST) is harmless
    await page.goto(new URL(link.pathAndQuery, baseURL).toString());
    await expect(page.getByRole('heading', { name: 'You Have Been Unsubscribed' })).toBeVisible();
  });

  test('RFC 8058 one-click: a POST of "List-Unsubscribe=One-Click" to the link needs no Origin, cookie or CSRF token, removes the subscriber and answers with a plain 200', async ({ request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await seedApprovedTemplate();
    const email = `oneclick.http.${Date.now()}@example.com`;
    expect((await subscribePublic(request, email)).status()).toBe(200);
    await expect.poll(() => mock.requests.length, { timeout: 30_000 }).toBe(1);
    const link = linkOf(0);
    const posted = await request.post(link.pathAndQuery, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'List-Unsubscribe=One-Click' });
    expect(posted.status()).toBe(200);
    expect(posted.headers()['content-type']).toContain('text/plain');
    expect(await posted.text()).toBe('Unsubscribed');
    expect(readSubscribers()).toEqual([]);
    const entries = JSON.parse(readFileSync(join(SERVER_DATA_DIR, 'email-send-log.json'), 'utf-8')) as Array<{ kind: string; reason?: string }>;
    expect(entries.find((e) => e.kind === 'unsubscribe')).toMatchObject({ reason: 'one_click' });
  });

  test('a link that is missing, damaged or tampered with is a 400 branded page and removes nobody; other methods are refused', async ({ request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await seedApprovedTemplate();
    const email = `tamper.http.${Date.now()}@example.com`;
    expect((await subscribePublic(request, email)).status()).toBe(200);
    await expect.poll(() => mock.requests.length, { timeout: 30_000 }).toBe(1);
    const real = linkOf(0).pathAndQuery;
    const t = new URL(`https://x.example${real}`).searchParams.get('t') as string;
    const attempts = [
      '/api/newsletter/unsubscribe',
      '/api/newsletter/unsubscribe?t=',
      '/api/newsletter/unsubscribe?t=garbage',
      `/api/newsletter/unsubscribe?t=${t.slice(0, -4)}AAAA`,
      `/api/newsletter/unsubscribe?t=${t}.extra`,
      `/api/newsletter/unsubscribe?t=${Buffer.from('nl-someone-else').toString('base64url')}`,
    ];
    for (const attempt of attempts) {
      const res = await request.get(attempt);
      expect(res.status(), attempt).toBe(400);
      expect(res.headers()['content-type'], attempt).toContain('text/html');
      expect(await res.text(), attempt).toContain('<h1>This Link Is Not Valid</h1>');
      const post = await request.post(attempt, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'List-Unsubscribe=One-Click' });
      expect(post.status(), attempt).toBe(400);
      expect(post.headers()['content-type'], attempt).toContain('text/plain');
      const form = await request.post(attempt, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'confirm=unsubscribe' });
      expect(form.status(), attempt).toBe(400);
      expect(form.headers()['content-type'], attempt).toContain('text/html');
      expect(await form.text(), attempt).toContain('<h1>This Link Is Not Valid</h1>');
    }
    expect(readSubscribers().map((s) => s.email)).toEqual([email]);
    expect((await request.put(real, { data: {} })).status()).toBe(405);
    expect((await request.delete(real)).status()).toBe(405);
    expect(readSubscribers().map((s) => s.email)).toEqual([email]);
  });

  test('the unsubscribe link of an admin test email works and removes nobody', async ({ request, page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await seedApprovedTemplate();
    const keeper = `keeper2.http.${Date.now()}@example.com`;
    expect((await subscribePublic(request, keeper)).status()).toBe(200);
    await expect.poll(() => mock.requests.length, { timeout: 30_000 }).toBe(1); // the keeper's welcome
    await adminLogin(page);
    const sent = await adminApi(page, 'POST', '/api/admin/newsletter/send', { mode: 'test', to: 'delivered@resend.dev' });
    expect(sent.status).toBe(200);
    expect(mock.requests).toHaveLength(2);
    const link = linkOf(1);
    expect(link.htmlHasIt).toBe(true);
    const followed = await request.get(link.pathAndQuery);
    expect(followed.status()).toBe(200);
    const confirmation = await followed.text();
    expect(confirmation).toContain('<h1>Confirm Unsubscribe</h1>');
    expect(confirmation).toContain('You are on the AB Entertainment newsletter list. Confirm below'); // no address is named for a test email
    const confirmed = await request.post(link.pathAndQuery, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'confirm=unsubscribe' });
    expect(confirmed.status()).toBe(200);
    expect(await confirmed.text()).toContain('You Have Been Unsubscribed');
    expect(readSubscribers().map((s) => s.email)).toEqual([keeper]);
    const entries = (await adminApi(page, 'GET', '/api/admin/newsletter/log?kind=unsubscribe')).body?.entries as unknown[];
    expect(entries).toEqual([]);
  });

  test('subscribing again after unsubscribing is a fresh signup that is sent a welcome once more', async ({ request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await seedApprovedTemplate();
    const email = `again.http.${Date.now()}@example.com`;
    expect((await subscribePublic(request, email)).status()).toBe(200);
    await expect.poll(() => mock.requests.length, { timeout: 30_000 }).toBe(1);
    expect((await request.post(linkOf(0).pathAndQuery, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'confirm=unsubscribe' })).status()).toBe(200);
    expect(readSubscribers()).toEqual([]);
    expect((await subscribePublic(request, email)).status()).toBe(200);
    await expect.poll(() => mock.requests.length, { timeout: 30_000 }).toBe(2);
    expect(readSubscribers().map((s) => s.email)).toEqual([email]);
    // a new subscriber record, so a new idempotency key: the provider treats it as a new message
    expect(mock.requests[1].headers['idempotency-key']).not.toBe(mock.requests[0].headers['idempotency-key']);
    // the old link names the old record: it can no longer touch the new subscription (it says "done"; a POST removes nobody)
    expect(await (await request.get(linkOf(0).pathAndQuery)).text()).toContain('<h1>You Have Been Unsubscribed</h1>');
    expect((await request.post(linkOf(0).pathAndQuery, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: 'confirm=unsubscribe' })).status()).toBe(200);
    expect(readSubscribers().map((s) => s.email)).toEqual([email]);
  });
});
