/**
 * Shared helpers for the email specs that talk to a local dev server over HTTP: mocks of the Resend API and of the AI
 * reviewer on loopback, the admin login and admin API calls, a public signup, and seeding an approved welcome template
 * into the server's data directory. Nothing here can reach a service off this machine: the mocks listen on 127.0.0.1.
 *
 * THE EMAIL TEST HARNESS. The HTTP specs that send or review need a dev server started with FAKE settings that point
 * at the mocks (the base URLs are only honoured when they are loopback addresses), for example:
 *   RESEND_API_KEY=re_local_test_0123456789abcdef  EMAIL_FROM='AB Entertainment <newsletter@abentertainment.com.au>'
 *   EMAIL_REPLY_TO=abhi@abentertainment.com.au     RESEND_BASE_URL=http://127.0.0.1:3199
 *   ANTHROPIC_API_KEY=sk-ant-local-test-not-real-0123456789   EMAIL_AI_BASE_URL=http://127.0.0.1:3198
 *   EMAIL_SWEEP_DISABLED=1 (so no background retry can fire in the middle of a test)
 * and AB_DATA_DIR pointing at a scratch directory (OPENAI_API_KEY and OPENROUTER_API_KEY unset). Run them with E2E_EMAIL_HARNESS=1 and ADMIN_TEST_PASSWORD set;
 * without the flag they skip, so a server with real keys is never asked to review or send.
 */

import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir, unitDir } from './email-unit';
import { StubAi, passingReview } from '../fixtures/email-ai-stub';

export const SITE_ORIGIN = 'https://abentertainment.com.au';
export const MOCK_PORT = 3199;
export const MOCK_AI_PORT = 3198;
export const HARNESS = process.env.E2E_EMAIL_HARNESS === '1';
export const HARNESS_SKIP = 'Needs ADMIN_TEST_PASSWORD and the email test harness (E2E_EMAIL_HARNESS=1, see e2e/support/email-http.ts).';
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
export const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? '';
export const HAS_ADMIN_CREDS = Boolean(process.env.ADMIN_TEST_PASSWORD);
export const SERVER_DATA_DIR = process.env.AB_DATA_DIR ?? join(process.cwd(), 'data');

export interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}

/** The Resend API on loopback: records every request, answers from a queue (default: accepted with a numbered id). */
export class MockResend {
  requests: MockRequest[] = [];
  answers: Array<{ status: number; body: unknown }> = [];
  private server: Server | null = null;
  private counter = 0;

  reset(): void {
    this.requests = [];
    this.answers = [];
    this.counter = 0;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', () => {
          let body: Record<string, unknown> = {};
          try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = {}; }
          this.requests.push({ method: String(req.method), url: String(req.url), headers: req.headers, body });
          const answer = this.answers.shift() ?? { status: 200, body: { id: `re_mock_${++this.counter}` } };
          res.writeHead(answer.status, { 'content-type': 'application/json' });
          res.end(JSON.stringify(answer.body));
        });
      });
      this.server.once('error', reject);
      this.server.listen(MOCK_PORT, '127.0.0.1', () => resolve());
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}

// ─── the AI reviewer, on loopback ────────────────────────────────────────────

export interface MockAiReview {
  scores: { content: number; brand: number; tone: number; language: number; quality: number };
  verdict: 'pass' | 'fail';
  summary: string;
  issues: Array<{ dimension: 'content' | 'brand' | 'tone' | 'language' | 'quality'; field: 'subject' | 'preheader' | 'eyebrow' | 'heading' | 'body' | 'cta'; severity: 'blocker' | 'major' | 'minor'; message: string; suggestion: string }>;
}

export interface MockAiFix {
  fixes: Record<'subject' | 'preheader' | 'eyebrow' | 'heading' | 'body' | 'ctaLabel' | 'ctaUrl', string | null>;
  rationale: string;
}

export const mockPassingReview = (over: Partial<MockAiReview> = {}): MockAiReview => ({
  scores: { content: 93, brand: 94, tone: 92, language: 95, quality: 93 },
  verdict: 'pass',
  summary: 'On brand, accurate and ready to send.',
  issues: [],
  ...over,
});

export const noFixes: MockAiFix['fixes'] = { subject: null, preheader: null, eyebrow: null, heading: null, body: null, ctaLabel: null, ctaUrl: null };

/**
 * The AI reviewer on loopback, speaking both Anthropic's Messages API (/v1/messages, answers in a forced tool call) and
 * the OpenAI chat API: answers the review and fix calls from scripted queues (the last answer repeats).
 */
export class MockAi {
  calls: Array<{ kind: 'review' | 'fix'; provider: 'anthropic' | 'openai'; model: string; body: Record<string, unknown> }> = [];
  reviews: MockAiReview[] = [];
  fixes: MockAiFix[] = [];
  /** Wait this long before each answer (to make a review slow enough to watch). */
  delayMs = 0;
  private server: Server | null = null;

  reset(): void {
    this.calls = [];
    this.reviews = [];
    this.fixes = [];
    this.delayMs = 0;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', () => {
          let body: Record<string, unknown> = {};
          try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = {}; }
          const anthropic = String(req.url).startsWith('/v1/messages');
          const schema = anthropic ? (body.tool_choice as { name?: string } | undefined)?.name : (body.response_format as { json_schema?: { name?: string } } | undefined)?.json_schema?.name;
          const kind = schema === 'email_fix' ? 'fix' : 'review';
          const index = this.calls.filter((c) => c.kind === kind).length;
          this.calls.push({ kind, provider: anthropic ? 'anthropic' : 'openai', model: String(body.model ?? ''), body });
          const queue: Array<MockAiReview | MockAiFix> = kind === 'fix' ? this.fixes : this.reviews;
          const answer = queue[Math.min(index, queue.length - 1)];
          setTimeout(() => {
            if (!answer) {
              res.writeHead(500, { 'content-type': 'application/json' });
              res.end(JSON.stringify({ error: 'no scripted answer' }));
              return;
            }
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
              JSON.stringify(
                anthropic
                  ? { id: 'msg_mock', type: 'message', role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_mock', name: schema, input: answer }] }
                  : { choices: [{ message: { content: JSON.stringify(answer) } }] },
              ),
            );
          }, this.delayMs);
        });
      });
      this.server.once('error', reject);
      this.server.listen(MOCK_AI_PORT, '127.0.0.1', () => resolve());
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}

let ipCounter = 0;
/** A client address of its own for each call, so the signup's per-IP rate limit of one test never touches another. */
export const freshIp = () => `203.0.113.${((Date.now() + ++ipCounter) % 250) + 1}`;

export async function subscribePublic(request: APIRequestContext, email: string) {
  return request.post('/api/newsletter', { data: { email, page: '/about/' }, headers: { origin: SITE_ORIGIN, 'x-forwarded-for': freshIp() } });
}

export async function adminLogin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.waitForTimeout(500);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel('Username').fill(ADMIN_USERNAME);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    if (await page.locator('aside').getByText('AB Entertainment').first().isVisible({ timeout: 6000 }).catch(() => false)) return;
    const throttled = await page.getByText(/too many attempts|too many requests/i).first().isVisible({ timeout: 1500 }).catch(() => false);
    if (!throttled) break;
    await page.waitForTimeout(2000);
  }
  await expect(page.locator('aside').getByText('AB Entertainment').first()).toBeVisible({ timeout: 20000 });
}

export async function adminApi(page: Page, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> | null; retryAfter: string | null }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const auth = await fetch('/api/admin/auth', { credentials: 'include', cache: 'no-store' });
      const { csrfToken } = (await auth.json()) as { csrfToken?: string };
      const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ?? '' }, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body) });
      let json: Record<string, unknown> | null = null;
      try { json = (await res.json()) as Record<string, unknown>; } catch { json = null; }
      return { status: res.status, body: json, retryAfter: res.headers.get('retry-after') };
    },
    { method, path, body },
  );
}

export interface StoredSubscriber {
  id: string;
  email: string;
  status?: string;
  welcome?: { status: string; reason?: string; messageId?: string; version?: number };
}

export function readSubscribers(): StoredSubscriber[] {
  const file = join(SERVER_DATA_DIR, 'newsletter-subscribers.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf-8')) as StoredSubscriber[]) : [];
}

/** An approved, active welcome template in the server's data directory. */
export async function seedApprovedTemplate(): Promise<void> {
  cleanUnitDir();
  const modules = loadWithUnitDir(() => ({
    store: require('@/lib/email/store') as typeof import('@/lib/email/store'),
    gate: require('@/lib/email/gate') as typeof import('@/lib/email/gate'),
    layout: require('@/lib/email/layout') as typeof import('@/lib/email/layout'),
  }));
  const layout = modules.layout.getLayout();
  const guidelines = await modules.store.getBrandGuidelines();
  const settings = await modules.store.getEmailSettings();
  const template = (await modules.store.getEmailTemplates())[0];
  const result = await modules.gate.runGate({ fields: template.versions[0].fields, settings, guidelines }, { layout, ai: new StubAi([passingReview()]), ctx: modules.gate.reviewContext() });
  expect(result.passed).toBe(true);
  await modules.store.recordGateOutcome(template.id, 1, { result, approval: modules.gate.buildApproval(result, layout, guidelines) });
  await modules.store.setActiveVersion(template.id, 1, () => null);
  writeFileSync(join(SERVER_DATA_DIR, 'email-templates.json'), readFileSync(join(unitDir(), 'email-templates.json'), 'utf-8'), 'utf-8');
}
