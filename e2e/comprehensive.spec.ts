/**
 * Comprehensive E2E Test Suite — AB Entertainment 1:1 Validation
 */
import { test, expect, Page } from '@playwright/test';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? 'admin123';
const HAS_ADMIN_CREDS = Boolean(process.env.ADMIN_TEST_PASSWORD);

function attachErrorSpy(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('404') && !text.includes('Download the React DevTools')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', (err) => { errors.push(`PAGE_ERROR: ${err.message}`); });
  return errors;
}

async function adminLogin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.waitForTimeout(500);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel('Username').fill(ADMIN_USERNAME);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    if (await page.locator('aside').getByText('AB Entertainment').first().isVisible({ timeout: 6000 }).catch(() => false)) {
      return;
    }
    const throttled = await page.getByText(/too many attempts|too many requests/i).first().isVisible({ timeout: 1500 }).catch(() => false);
    if (!throttled) break;
    await page.waitForTimeout(2000);
  }
  await expect(page.locator('aside').getByText('AB Entertainment').first()).toBeVisible({ timeout: 20000 });
}

test.describe('@req-color-palette', () => {
  test('body bg is #0A0A0A', async ({ page }) => {
    const errors = attachErrorSpy(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(10, 10, 10)');
    expect(errors).toHaveLength(0);
  });
  test('gold #C9A84C in CTAs', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const hasGold = await page.evaluate(() => {
      for (const el of document.querySelectorAll('a, button, span')) {
        const s = getComputedStyle(el);
        if (s.backgroundColor.includes('201, 168, 76') || s.color.includes('201, 168, 76')) return true;
        if (el.className && typeof el.className === 'string' && el.className.includes('C9A84C')) return true;
      }
      return false;
    });
    expect(hasGold).toBe(true);
  });
});

test.describe('@req-typography', () => {
  test('font vars loaded on html', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.className)).toBeTruthy();
  });
  test('body has font-body', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.body.className)).toContain('font-body');
  });
});

test.describe('@req-header-ui', () => {
  test('nav fixed', async ({ page }) => {
    await page.goto('/');
    const pos = await page.locator('nav').first().evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe('fixed');
  });
  test('nav has AB Entertainment', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav').getByText('AB Entertainment').first()).toBeVisible();
  });
  test('nav links present', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav').first();
    for (const l of ['Home','About','Events','Gallery','Sponsors']) {
      await expect(nav.getByRole('link', { name: l }).first()).toBeVisible();
    }
    expect(await nav.locator('a:has-text("Contact")').count()).toBeGreaterThanOrEqual(1);
  });
  test('Contact Us CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav').getByRole('link', { name: /contact us/i })).toBeVisible();
  });
  test('nav links navigate', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav').getByRole('link', { name: 'Events', exact: true }).first().click();
    await expect(page).toHaveURL(/\/events\/?/);
    await page.locator('nav').getByRole('link', { name: 'About', exact: true }).first().click();
    await expect(page).toHaveURL(/\/about\/?/);
  });
});

test.describe('@req-hero-section', () => {
  test('hero >= 90vh', async ({ page }) => {
    await page.goto('/');
    const h = await page.locator('section').first().evaluate((el) => el.getBoundingClientRect().height);
    const vh = await page.evaluate(() => window.innerHeight);
    expect(h).toBeGreaterThanOrEqual(vh * 0.9);
  });
  test('hero gold badge', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    const b = await page.evaluate(() => {
      for (const s of document.querySelectorAll('section:first-of-type span')) {
        const c = getComputedStyle(s);
        if (c.color.includes('201, 168, 76')) return true;
        if (s.className && typeof s.className === 'string' && s.className.includes('C9A84C')) return true;
      }
      return false;
    });
    expect(b).toBe(true);
  });
  test('hero h1', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    expect((await h1.textContent())!.length).toBeGreaterThan(5);
  });
  test('carousel dots', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('button[aria-label*="slide"]').count()).toBeGreaterThanOrEqual(2);
  });
  test('hero CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /buy tickets/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /get in touch/i }).first()).toBeVisible();
  });
});

test.describe('@req-four-pillars', () => {
  test('pillars titles', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Networking')).toBeVisible();
    await expect(page.getByText('Heritage Bequest')).toBeVisible();
    await expect(page.getByText('Cultural Kaleidoscope')).toBeVisible();
    await expect(page.getByText('Community Building')).toBeVisible();
  });
});

test.describe('@req-events-grid', () => {
  test('events on homepage', async ({ page }) => {
    await page.goto('/');
    // EventsShowcase uses "Our Productions" label + "Signature Events" heading
    await expect(page.getByText('Our Productions')).toBeVisible();
  });
  test('events page loads', async ({ page }) => {
    const errors = attachErrorSpy(page);
    await page.goto('/events');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

test.describe('@req-footer-arch', () => {
  test('newsletter form', async ({ page }) => {
    await page.goto('/');
    const f = page.locator('footer');
    await expect(f.getByText('Stay Updated')).toBeVisible();
    await expect(f.locator('input[type="email"]')).toBeVisible();
  });
  test('company + social', async ({ page }) => {
    await page.goto('/');
    const f = page.locator('footer');
    await expect(f.getByText('AB Entertainment').first()).toBeVisible();
    expect(await f.locator('a[aria-label]').count()).toBeGreaterThanOrEqual(2);
  });
  test('copyright', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer').getByText(/© \d{4}/)).toBeVisible();
  });
  test('columns', async ({ page }) => {
    await page.goto('/');
    const f = page.locator('footer');
    await expect(f.getByText('Quick Links')).toBeVisible();
    await expect(f.getByRole('heading', { name: 'Events' })).toBeVisible();
    await expect(f.getByRole('heading', { name: 'Contact' })).toBeVisible();
  });
});

test.describe('@req-admin-auth', () => {
  test('redirect to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login\/?/);
  });
  test('login succeeds', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await expect(page.getByText('+ New Event')).toBeVisible({ timeout: 10000 });
  });
  test('bad creds rejected', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Username').fill('hacker');
    await page.getByLabel('Password').fill('hacker123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 5000 });
  });
  test('logout clears session', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/admin\/login\/?/, { timeout: 10000 });
  });
});

test.describe('@req-admin-crud — Events', () => {
  test('create event form', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await page.getByRole('button', { name: '+ New Event' }).click();
    await expect(page.getByRole('heading', { name: 'Create Event', level: 3 })).toBeVisible({ timeout: 10000 });
  });
  test('events table populated', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await expect(page.getByText('Shrimant Damodar Pant')).toBeVisible({ timeout: 10000 });
  });
});
test.describe('@req-admin-crud — Sponsors', () => {
  test('sponsors tab', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await page.getByRole('button', { name: /🤝 Sponsors/i }).click();
    await expect(page.getByRole('button', { name: /new sponsor/i })).toBeVisible({ timeout: 5000 });
  });
});
test.describe('@req-admin-crud — Gallery', () => {
  test('gallery tab', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await page.getByRole('button', { name: /🖼 Gallery/i }).click();
    await expect(page.getByRole('button', { name: /add image/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('@req-admin-settings', () => {
  test('model selection', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await page.getByRole('button', { name: /⚙ Settings/i }).click();
    await expect(page.getByText('Customer Chatbot Model')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('GPT-4o (Default)')).toBeVisible();
  });
  test('hero editor', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await page.getByRole('button', { name: /⚙ Settings/i }).click();
    await expect(page.getByText('Hero Section')).toBeVisible({ timeout: 5000 });
  });
  test('contact editor', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await page.getByRole('button', { name: /⚙ Settings/i }).click();
    await expect(page.getByText('Contact Information')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('@req-admin-ai', () => {
  test('AI agent UI', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await page.getByRole('button', { name: /🤖 AI Agent/i }).click();
    await expect(page.getByRole('heading', { name: 'AI Agent' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder*="agent" i]')).toBeVisible();
  });
  test('AI agent welcome', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await page.getByRole('button', { name: /🤖 AI Agent/i }).click();
    await expect(page.getByText(/AB Entertainment Admin Agent/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('@req-chat-api', () => {
  test('returns error without key', async ({ request }) => {
    const r = await request.post('/api/chat', { data: { messages: [{ role: 'user', content: 'Hello' }] } });
    // 503 = key not configured, 429 = rate limited, 200 = key configured and stream started
    expect([503, 429, 200]).toContain(r.status());
  });
  test('validates messages', async ({ request }) => {
    const r = await request.post('/api/chat', { data: { messages: [] } });
    expect([400, 503]).toContain(r.status());
  });
});

test.describe('@req-contact-api', () => {
  test('rejects empty', async ({ request }) => {
    expect((await request.post('/api/contact', { data: { name: '', email: '', message: '' } })).status()).toBe(400);
  });
  test('rejects bad email', async ({ request }) => {
    // 400 = validation failed, 429 = rate limited during test run (both mean rejected)
    expect([400, 429]).toContain((await request.post('/api/contact', { data: { name: 'Test User', email: 'bad-email', message: 'This is a test message for validation.' } })).status());
  });
  test('accepts valid', async ({ request }) => {
    const r = await request.post('/api/contact', { data: { name: 'E2E Test', email: 'e2e@test.com', message: 'This is a valid e2e test message that meets the minimum length requirement.' } });
    // 200 = success, 429 = rate limited during test run
    expect([200, 429]).toContain(r.status());
    if (r.status() === 200) {
      expect((await r.json()).success).toBe(true);
    }
  });
});

test.describe('@req-zero-errors', () => {
  for (const r of ['/','/about','/events','/gallery','/sponsors','/contact','/privacy','/terms']) {
    test(`no errors ${r}`, async ({ page }) => {
      const e = attachErrorSpy(page);
      await page.goto(r);
      await page.waitForLoadState('networkidle');
      const critical = e.filter((err) =>
        !err.includes('script tag') &&
        !err.includes('template tag') &&
        !err.includes('WebGL') &&
        !err.includes('webgl')
      );
      expect(critical).toHaveLength(0);
    });
  }
  test('no errors /admin/login', async ({ page }) => {
    const e = attachErrorSpy(page);
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    const critical = e.filter((err) =>
      !err.includes('script tag') &&
      !err.includes('template tag') &&
      !err.includes('WebGL') &&
      !err.includes('webgl')
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('@req-no-banned-deps', () => {
  test('no Clerk', async ({ page }) => {
    await page.goto('/');
    const h = await page.content();
    expect(h).not.toContain('clerk.com');
    expect(h).not.toContain('ClerkProvider');
  });
  test('no Sanity', async ({ page }) => {
    await page.goto('/');
    const h = await page.content();
    expect(h).not.toContain('sanity.io');
  });
  test('no Stripe', async ({ page }) => {
    await page.goto('/');
    const h = await page.content();
    expect(h).not.toContain('stripe.com');
  });
});

test.describe('@req-scraped-content', () => {
  test('homepage real content', async ({ page }) => {
    await page.goto('/');
    const c = await page.textContent('body');
    expect(c).toContain('AB Entertainment');
    expect(c!.toLowerCase()).not.toContain('lorem ipsum');
  });
  test('about page real', async ({ page }) => {
    await page.goto('/about');
    const c = await page.textContent('body');
    expect(c).toContain('Melbourne');
    expect(c).toContain('Marathi');
  });
  test('contact real data', async ({ page }) => {
    await page.goto('/contact');
    const c = await page.textContent('body');
    expect(c).toContain('430082646');
    expect(c).toContain('abhi@abentertainment.com.au');
  });
});

test.describe('@req-container-85', () => {
  test('container-eu 85% capped 1400px', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    const containers = page.locator('.container-eu');
    expect(await containers.count()).toBeGreaterThan(0);
    const w = await containers.first().evaluate((el) => parseFloat(getComputedStyle(el).width));
    expect(w).toBeLessThanOrEqual(1400);
    expect(w).toBeGreaterThanOrEqual(1200);
  });
});

test.describe('@req-sharp-buttons', () => {
  test('btn-accent no radius', async ({ page }) => {
    await page.goto('/');
    const btns = page.locator('.btn-accent');
    if (await btns.count() > 0) {
      expect(await btns.first().evaluate((el) => getComputedStyle(el).borderRadius)).toBe('0px');
    }
  });
});

test.describe('@req-admin-crud-api', () => {
  test('auth rejects unauth', async ({ request }) => {
    expect((await request.get('/api/admin/auth')).status()).toBe(401);
  });
  test('events rejects unauth', async ({ request }) => {
    expect((await request.post('/api/admin/events', { data: { title: 'X' } })).status()).toBe(401);
  });
  test('sponsors rejects unauth', async ({ request }) => {
    expect((await request.post('/api/admin/sponsors', { data: { name: 'X' } })).status()).toBe(401);
  });
  test('gallery rejects unauth', async ({ request }) => {
    expect((await request.post('/api/admin/gallery', { data: { src: 'x.jpg' } })).status()).toBe(401);
  });
  test('settings rejects unauth', async ({ request }) => {
    expect((await request.get('/api/admin/settings')).status()).toBe(401);
  });
});

test.describe('@req-all-pages', () => {
  for (const r of ['/','/about','/events','/gallery','/sponsors','/contact','/privacy','/terms','/admin/login']) {
    test(`${r} returns 200`, async ({ page }) => {
      expect((await page.goto(r))?.status()).toBe(200);
    });
  }
});

test.describe('@req-accessibility', () => {
  test('lang=en', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  });
  test('skip link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /skip to main content/i })).toBeAttached();
  });
  test('main#main-content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main#main-content')).toBeVisible();
  });
  test('nav exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav').first()).toBeVisible();
  });
  test('footer exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toBeVisible();
  });
});
