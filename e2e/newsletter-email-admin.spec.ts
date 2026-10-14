/**
 * The Newsletter area of the admin portal, driven in a real browser against a local dev server with the Resend API and
 * the AI reviewer (Anthropic's Messages API) mocked on loopback: sections, template editing with the live brand-layout
 * preview, the quality review round by round (a failing review, the AI's fix, a passing review and the approval it
 * leaves), activation, a test email, the welcome email on a real signup, the send log, the brand guidelines and reviewer
 * model, and the quota banner an administrator sees without reading any log.
 *
 * Needs the email test harness (see e2e/support/email-http.ts): E2E_EMAIL_HARNESS=1 and ADMIN_TEST_PASSWORD.
 */

import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  MockAi,
  MockResend,
  SERVER_DATA_DIR,
  adminApi,
  adminLogin,
  mockPassingReview,
  noFixes,
  readSubscribers,
  seedApprovedTemplate,
  subscribePublic,
} from './support/email-http';

const FILES = ['email-templates.json', 'email-settings.json', 'email-guidelines.json', 'email-send-log.json', 'email-provider-state.json', 'newsletter-subscribers.json'];

async function openNewsletter(page: Page): Promise<void> {
  await page.locator('aside').getByRole('button', { name: /Newsletter/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Newsletter Subscribers' })).toBeVisible({ timeout: 15000 });
}

async function openSection(page: Page, label: string, heading: string): Promise<void> {
  await page.getByRole('tab', { name: label }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible({ timeout: 15000 });
}

const TEMPLATES = 'Email templates';

test.describe.configure({ mode: 'serial' });

test.describe('admin: newsletter email', () => {
  const saved = new Map<string, string | null>();
  const resend = new MockResend();
  const ai = new MockAi();

  test.beforeAll(async ({ baseURL }) => {
    if (!HARNESS) return;
    const host = new URL(baseURL ?? 'http://localhost:3000').hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`Refusing to run: baseURL (${baseURL}) is not on this machine.`);
    for (const file of FILES) saved.set(file, existsSync(join(SERVER_DATA_DIR, file)) ? readFileSync(join(SERVER_DATA_DIR, file), 'utf-8') : null);
    await resend.start();
    await ai.start();
  });

  test.afterAll(async () => {
    if (!HARNESS) return;
    await resend.stop();
    await ai.stop();
    for (const [file, content] of saved) {
      if (content === null) rmSync(join(SERVER_DATA_DIR, file), { force: true });
      else writeFileSync(join(SERVER_DATA_DIR, file), content, 'utf-8');
    }
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.skip(!HAS_ADMIN_CREDS || !HARNESS, HARNESS_SKIP);
    resend.reset();
    ai.reset();
    for (const file of FILES) rmSync(join(SERVER_DATA_DIR, file), { force: true });
  });

  test('the sections, and an honest account of why nothing can be sent yet', async ({ page }) => {
    await adminLogin(page);
    await openNewsletter(page);
    const tabs = page.getByRole('tablist', { name: 'Newsletter sections' }).getByRole('tab');
    await expect(tabs).toHaveText(['Subscribers', 'Email templates', 'Brand guidelines', 'Send log', 'Sending status']);
    await expect(page.getByRole('tab', { name: 'Subscribers' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('newsletter-count')).toHaveText('0');

    await openSection(page, 'Sending status', 'Sending status');
    await expect(page.getByTestId('welcome-readiness')).toContainText('Not ready');
    await expect(page.getByTestId('welcome-readiness')).toContainText('No version of the welcome template is approved and active');
    await expect(page.getByText('Configured', { exact: true })).toBeVisible();
    await expect(page.getByTestId('reviewer-model')).toHaveText('Default');
    await expect(page.getByText('Tried in order: anthropic claude-opus-5-5, then anthropic claude-sonnet-5-5')).toBeVisible();
    // the status never shows a key or the sender's address
    const body = await page.locator('main').innerText();
    expect(body).not.toContain('re_local_test');
    expect(body).not.toContain('sk-ant-local');
    expect(body).not.toContain('newsletter@abentertainment.com.au');

    await openSection(page, 'Send log', 'Send log');
    await expect(page.getByText('Nothing has been sent yet.')).toBeVisible();
    await openSection(page, 'Brand guidelines', 'Brand guidelines');
    await expect(page.getByRole('textbox', { name: 'Brand guidelines' })).toContainText('CONTENT FUNDAMENTALS');
    await openSection(page, 'Subscribers', 'Newsletter Subscribers');
  });

  test('templates: the seeded welcome email, its live preview in the brand layout, and editing it into a new version', async ({ page }) => {
    await adminLogin(page);
    await openNewsletter(page);
    await openSection(page, TEMPLATES, 'Email templates');
    await expect(page.locator('[data-template-key="newsletter_welcome"]')).toContainText('Welcome email');
    await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('Welcome to AB Entertainment');
    await expect(page.getByLabel('Eyebrow (optional)')).toHaveValue('Welcome to');
    await expect(page.getByRole('heading', { name: 'Content of version 1' })).toBeVisible();

    // the preview is the real layout, rendered by the server
    const preview = page.frameLocator('iframe[title="Email preview"]');
    await expect(preview.getByRole('heading', { name: 'The AB Entertainment Community' })).toBeVisible({ timeout: 15000 });
    await expect(preview.getByRole('link', { name: 'View All Events' })).toBeVisible();
    await expect(preview.getByRole('link', { name: 'Unsubscribe' })).toBeVisible();
    await expect(page.getByTestId('preview-clean')).toBeVisible();
    await page.getByRole('button', { name: 'Plain text' }).click();
    await expect(page.locator('pre').filter({ hasText: 'VIEW ALL EVENTS' })).toBeVisible();
    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await page.getByRole('button', { name: 'Phone' }).click();
    await expect.poll(async () => (await page.locator('iframe[title="Email preview"]').boundingBox())?.width).toBe(390);

    // an edit shows its problems at once, and cannot be reviewed until it is saved
    const subject = page.getByLabel('Subject', { exact: true });
    await subject.fill('Hi');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await expect(page.getByText('The subject is only 2 characters.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Run quality review' })).toBeDisabled();
    await page.getByRole('button', { name: 'Reset changes' }).click();
    await expect(subject).toHaveValue('Welcome to AB Entertainment');
    await subject.fill('Welcome to the AB Entertainment community');
    await page.getByRole('button', { name: 'Save as new version' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved as version 2' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content of version 2' })).toBeVisible();
    await expect(page.locator('[data-version="2"]')).toContainText('Edited by an admin');
    await expect(page.locator('[data-version="2"]')).toContainText('Not approved');
    // the saved version is in the store, version 1 untouched
    const stored = JSON.parse(readFileSync(join(SERVER_DATA_DIR, 'email-templates.json'), 'utf-8')) as Array<{ versions: Array<{ version: number; fields: { subject: string }; createdBy: string }> }>;
    expect(stored[0].versions.map((v) => [v.version, v.fields.subject, v.createdBy])).toEqual([[1, 'Welcome to AB Entertainment', 'seed'], [2, 'Welcome to the AB Entertainment community', 'admin']]);
    // another version can be opened and read
    await page.locator('[data-version="1"]').click();
    await expect(subject).toHaveValue('Welcome to AB Entertainment');
  });

  test('the quality review, round by round: a failing review, the AI\'s fix, a passing review, and the approval it leaves', async ({ page }) => {
    // slow enough (three AI calls of 7 s) that the screen has to follow the review as it goes
    ai.delayMs = 7000;
    ai.reviews = [
      {
        scores: { content: 90, brand: 88, tone: 70, language: 92, quality: 86 },
        verdict: 'fail',
        summary: 'The body is a little casual for the brand.',
        issues: [{ dimension: 'tone', field: 'body', severity: 'major', message: 'The second paragraph is too casual for the brand voice.', suggestion: 'Raise the register.' }],
      },
      mockPassingReview(),
    ];
    ai.fixes = [{ fixes: { ...noFixes, body: 'Thank you for joining the AB Entertainment community. Your place in this audience is a privilege, and it is warmly welcomed.\n\nAB Entertainment presents the performing arts of India and Maharashtra to Melbourne with meticulous care, so that you, and those who join you, may experience an evening like no other.' }, rationale: 'Raised the register of the second paragraph.' }];
    await adminLogin(page);
    await openNewsletter(page);
    await openSection(page, TEMPLATES, 'Email templates');
    await page.getByRole('button', { name: 'Run quality review' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Review in progress' })).toBeVisible({ timeout: 10000 });

    // round 1 appears while the review is still running, with its failure and the AI's fix
    const round1 = page.getByTestId('review-round-1');
    await expect(round1).toBeVisible({ timeout: 40000 });
    await expect(round1).toContainText('Needs changes');
    await expect(round1).toContainText('All automatic checks passed');
    await expect(round1).toContainText('anthropic claude-opus-5-5');
    await expect(round1).toContainText('The second paragraph is too casual for the brand voice.');
    await expect(round1.getByTestId('score-tone')).toContainText('70');
    await expect(round1).toContainText('Reworded: Body. Raised the register of the second paragraph.');

    // then round 2 passes and the version the AI wrote is approved
    await expect(page.getByTestId('review-outcome')).toContainText('Passed', { timeout: 60000 });
    await expect(page.getByTestId('review-outcome')).toContainText('Version 2 is approved');
    await expect(page.getByTestId('review-round-2')).toContainText('Passed');
    await expect(page.getByRole('status').filter({ hasText: 'Approved: version 2 passed the quality review.' })).toBeVisible();
    await expect(page.locator('[data-version="2"]')).toContainText('Reworded by the quality review');
    await expect(page.locator('[data-version="2"]')).toContainText('Approved');
    await expect(page.locator('[data-version="1"]')).toContainText('Reworded as version 2'); // the original was not approved; the reworded copy is
    await expect(page.locator('[data-version="1"]')).toContainText('Not approved');
    await expect(page.getByTestId('approved-by')).toContainText('anthropic claude-opus-5-5');
    await expect(page.getByRole('heading', { name: 'Content of version 2' })).toBeVisible();
    expect(ai.calls.map((c) => [c.kind, c.provider, c.model])).toEqual([['review', 'anthropic', 'claude-opus-5-5'], ['fix', 'anthropic', 'claude-opus-5-5'], ['review', 'anthropic', 'claude-opus-5-5']]);
    // what the reviewer was shown is the draft and the guidelines (the AI is told the draft is data)
    const prompt = JSON.stringify(ai.calls[0].body.messages);
    expect(prompt).toContain('The AB Entertainment Community');
    expect(prompt).toContain('CONTENT FUNDAMENTALS');
  });

  test('approve, activate, send a test email, welcome a real signup, and see it all in the send log', async ({ page, request }) => {
    ai.reviews = [mockPassingReview()];
    await adminLogin(page);
    await openNewsletter(page);
    await openSection(page, TEMPLATES, 'Email templates');
    await expect(page.getByRole('button', { name: 'Activate for sending' })).toBeDisabled(); // not approved yet
    await expect(page.getByRole('button', { name: 'Send test email' })).toBeDisabled();
    await page.getByRole('button', { name: 'Run quality review' }).click();
    await expect(page.getByTestId('review-outcome')).toContainText('Passed', { timeout: 40000 });
    await expect(page.getByRole('status').filter({ hasText: 'Approved: version 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Activate for sending' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Version 1 is now the version used for sending.' })).toBeVisible();
    await expect(page.locator('[data-template-key="newsletter_welcome"]')).toContainText('Active v1');
    await expect(page.locator('[data-version="1"]')).toContainText('Active');

    // a test email goes through the same gate and transport
    await page.getByLabel('Send to').fill('delivered@resend.dev');
    await page.getByRole('button', { name: 'Send test email' }).click();
    await expect(page.getByTestId('test-send-result')).toContainText('Test email sent (message id re_mock_1)', { timeout: 20000 });
    expect(resend.requests).toHaveLength(1);
    expect(resend.requests[0].body).toMatchObject({ to: ['delivered@resend.dev'], subject: 'Welcome to AB Entertainment' });

    // a visitor subscribes on the public form's endpoint and is welcomed
    const email = `ui.welcome.${Date.now()}@example.com`;
    expect((await subscribePublic(request, email)).status()).toBe(200);
    await expect.poll(() => resend.requests.length, { timeout: 30000 }).toBe(2);
    await expect.poll(() => readSubscribers()[0]?.welcome?.status, { timeout: 15000 }).toBe('sent');

    await openSection(page, 'Subscribers', 'Newsletter Subscribers');
    await expect(page.locator('[data-subscriber-id]').first()).toContainText(email);
    await expect(page.getByTestId('welcome-state').first()).toContainText('Welcome sent');
    await expect(page.getByRole('button', { name: /Send waiting welcomes/ })).toBeDisabled();

    await openSection(page, 'Send log', 'Send log');
    const rows = page.locator('[data-log-id]');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Sent');
    await expect(rows.first()).toContainText('Welcome');
    await expect(rows.first()).toContainText('u***@example.com');
    await expect(page.getByTestId('log-message-id').first()).toContainText('re_mock_2');
    await expect(rows.last()).toContainText('Test');
    await expect(rows.last()).toContainText('d***@resend.dev');
    await page.getByLabel('Kind').selectOption('test');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('re_mock_1');
    const text = await page.locator('main').innerText();
    expect(text).not.toContain(email); // the log shows masked addresses only

    await openSection(page, 'Sending status', 'Sending status');
    await expect(page.getByTestId('welcome-readiness')).toContainText('Ready to send');
    await expect(page.getByTestId('welcome-readiness')).toContainText('Version 1 is approved and active');
  });

  test('a quota refusal is plain to see: the banner, the status block, the waiting welcome, and a retry that works once the quota is back', async ({ page, request }) => {
    await seedApprovedTemplate();
    resend.answers = [{ status: 429, body: { statusCode: 429, name: 'daily_quota_exceeded', message: 'You have reached your daily email sending quota.' } }];
    const email = `ui.quota.${Date.now()}@example.com`;
    expect((await subscribePublic(request, email)).status()).toBe(200);
    await expect.poll(() => resend.requests.length, { timeout: 30000 }).toBe(1);
    await expect.poll(() => readSubscribers()[0]?.welcome?.reason, { timeout: 15000 }).toBe('provider_rate_limited');

    await adminLogin(page);
    await openNewsletter(page);
    const banner = page.getByTestId('provider-banner');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toContainText('daily sending quota has been reached');
    await expect(banner).toContainText('1 welcome email is waiting');
    await expect(banner).toContainText('Automatic attempts resume in');
    await expect(page.getByTestId('welcome-state').first()).toContainText('Welcome waiting');
    await expect(page.locator('[data-subscriber-id]').first()).toContainText('asked for fewer requests');

    await openSection(page, 'Sending status', 'Sending status');
    await expect(page.getByTestId('provider-banner')).toHaveCount(0); // the full block replaces the banner on this section
    const block = page.getByTestId('provider-block');
    await expect(block).toContainText('The email provider’s daily sending quota has been reached.');
    await expect(block).toContainText('1 welcome email is waiting to be sent.');
    await expect(page.getByTestId('provider-last-attempt')).toContainText('the provider answered 429 daily_quota_exceeded');
    await expect(page.getByTestId('provider-resumes')).toContainText(/\(in (?:\d+ hours?|\d+ minutes?|less than a minute)/);
    await expect(page.getByTestId('provider-next-attempt')).toContainText('switched off on this server'); // the harness runs with the sweeper off
    await expect(block).toContainText('The provider said');
    await expect(block).toContainText('You have reached your daily email sending quota.');
    await expect(block).toContainText('1 × Waiting: the email provider asked for fewer requests.');
    await expect(page.getByText('Refused the last send')).toBeVisible();

    // the log says the same, in words
    await openSection(page, 'Send log', 'Send log');
    await expect(page.locator('[data-log-id]').first()).toContainText('Rate limited');
    await expect(page.locator('[data-log-id]').first()).toContainText('quota was reached');
    await expect(page.locator('[data-log-id]').first()).toContainText('Provider answered 429 (daily_quota_exceeded)');

    // the administrator presses "Send waiting welcomes": it tries at once, the quota is back (the mock now accepts), it is sent
    await openSection(page, 'Subscribers', 'Newsletter Subscribers');
    await page.getByRole('button', { name: 'Send waiting welcomes (1)' }).click();
    await expect(page.getByRole('status').filter({ hasText: '1 welcome email sent' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('welcome-state').first()).toContainText('Welcome sent');
    expect(resend.requests).toHaveLength(2);
    expect(resend.requests[1].headers['idempotency-key']).toBe(resend.requests[0].headers['idempotency-key']);
    await page.getByRole('button', { name: 'Refresh' }).click();
    await openSection(page, 'Sending status', 'Sending status');
    await expect(page.getByTestId('provider-block')).toHaveCount(0);
    await expect(page.getByText('Accepting emails')).toBeVisible();
  });

  test('brand guidelines and the reviewer model: editing the voice voids approvals, changing the model does not', async ({ page }) => {
    await seedApprovedTemplate();
    await adminLogin(page);
    await openNewsletter(page);
    await openSection(page, TEMPLATES, 'Email templates');
    await expect(page.locator('[data-version="1"]')).toContainText('Approved');

    await openSection(page, 'Brand guidelines', 'Brand guidelines');
    const model = page.getByLabel('Reviewer model');
    await expect(model).toHaveValue('');
    await expect(page.getByTestId('reviewer-chain')).toContainText('Tried in order: anthropic claude-opus-5-5, then anthropic claude-sonnet-5-5');
    await model.selectOption('claude-sonnet-5-5');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Settings saved.' })).toBeVisible();
    await expect(page.getByTestId('reviewer-chain')).toContainText('Tried in order: anthropic claude-sonnet-5-5, then anthropic claude-opus-5-5');
    expect(JSON.parse(readFileSync(join(SERVER_DATA_DIR, 'email-settings.json'), 'utf-8'))).toMatchObject({ reviewModel: 'claude-sonnet-5-5' });
    // a model of your own
    await model.selectOption('__custom__');
    await page.getByLabel('Model id').fill('claude-haiku-4-5');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByTestId('reviewer-chain')).toContainText('Tried in order: anthropic claude-haiku-4-5', { timeout: 10000 });

    // changing the model left the approval standing, and the approval still says who approved it
    await openSection(page, TEMPLATES, 'Email templates');
    await expect(page.locator('[data-version="1"]')).toContainText('Approved');
    await expect(page.locator('[data-version="1"]')).not.toContainText('out of date');
    await expect(page.getByTestId('approved-by')).toContainText('stub-model'); // seeded by the in-process scripted reviewer

    // a setting the server refuses is explained
    await openSection(page, 'Brand guidelines', 'Brand guidelines');
    await page.getByLabel('Fix rounds (1 to 6)').fill('9');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'maxFixRounds must be a whole number from 1 to 6' })).toBeVisible();

    // editing the guidelines asks first, and voids the approval
    const guidelines = page.getByRole('textbox', { name: 'Brand guidelines' });
    await guidelines.fill(`${await guidelines.inputValue()}\n\nOne more rule, added by an administrator.`);
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('must pass the quality review again');
      void dialog.accept();
    });
    await page.getByRole('button', { name: 'Save guidelines' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Guidelines saved as version 2' })).toBeVisible();
    await openSection(page, TEMPLATES, 'Email templates');
    await expect(page.locator('[data-version="1"]')).toContainText('Approval out of date');
    await expect(page.getByRole('button', { name: 'Activate for sending' })).toBeDisabled();
    await openSection(page, 'Sending status', 'Sending status');
    await expect(page.getByTestId('welcome-readiness')).toContainText('Not ready');
    await expect(page.getByTestId('welcome-readiness')).toContainText('approval no longer applies');
    await expect(page.getByTestId('provider-banner')).toHaveCount(0);
  });

  test('add, duplicate, switch off and delete templates', async ({ page }) => {
    await adminLogin(page);
    await openNewsletter(page);
    await openSection(page, TEMPLATES, 'Email templates');
    await page.getByLabel('Template name').fill('Spring note');
    await page.getByLabel('Template key').fill('spring_note');
    await page.getByRole('button', { name: 'Add template' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Template “Spring note” created' })).toBeVisible();
    await expect(page.locator('[data-template-key="spring_note"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('');
    await expect(page.getByText('The subject is empty.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Content of version 1' })).toBeVisible();

    await page.getByLabel('Subject', { exact: true }).fill('An evening to remember this spring');
    await page.getByLabel('Preheader').fill('A short note from AB Entertainment about the season ahead.');
    await page.getByLabel('Heading', { exact: true }).fill('A Spring Evening');
    await page.getByLabel('Body', { exact: true }).fill('AB Entertainment looks forward to welcoming you to a season of music, theatre and dance. Each evening is prepared with meticulous care, so that you and those who join you may enjoy it fully.');
    await page.getByLabel('Button label').fill('View All Events');
    await page.getByLabel('Button link').fill('https://abentertainment.com.au/events/');
    await expect(page.getByTestId('preview-clean')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Save as new version' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved as version 2' })).toBeVisible();

    await page.getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Duplicated as' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Email templates' }).getByRole('button')).toHaveCount(3);

    await page.getByRole('button', { name: 'Switch off' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'switched off: it sends nothing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch on' })).toBeVisible();
    await page.getByRole('button', { name: 'Switch on' }).click();
    await expect(page.getByRole('button', { name: 'Switch off' })).toBeVisible();

    // deleting asks first
    page.once('dialog', (dialog) => void dialog.dismiss());
    await page.getByRole('button', { name: 'Delete template' }).click();
    await expect(page.getByRole('list', { name: 'Email templates' }).getByRole('button')).toHaveCount(3);
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Delete template' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Template deleted.' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Email templates' }).getByRole('button')).toHaveCount(2);
    // the welcome template carries a stronger warning
    await page.locator('[data-template-key="newsletter_welcome"]').click();
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('New subscribers will not be sent a welcome email');
      void dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Delete template' }).click();
    // an invalid key is explained by the server
    await page.getByLabel('Template name').fill('Bad key');
    await page.getByLabel('Template key').fill('Bad Key!');
    await page.getByRole('button', { name: 'Add template' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'key must be 3 to 49 characters' })).toBeVisible();
    const api = await adminApi(page, 'GET', '/api/admin/newsletter/templates');
    expect((api.body?.templates as Array<{ key: string }>).map((t) => t.key).sort()).toEqual(['newsletter_welcome', 'spring_note']);
  });
});
