/**
 * Shared helpers for the email specs that talk to a local dev server over HTTP: a Resend API mock on loopback, the
 * admin login and admin API calls, a public signup, and seeding an approved welcome template into the server's data
 * directory (what a passing review and activation leave behind; the review itself is covered in-process with a
 * scripted AI). Nothing here can reach a service off this machine: the mock listens on 127.0.0.1 only.
 */

import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir, unitDir } from './email-unit';
import { StubAi, passingReview } from '../fixtures/email-ai-stub';

export const SITE_ORIGIN = 'https://abentertainment.com.au';
export const MOCK_PORT = 3199;
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
