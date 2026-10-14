/**
 * Sponsors and partners on events: the admin portal in a browser, from BOTH sides of the same link.
 *
 * The Events form picks sponsors and partners (search, keyboard, a free-text role for each, an order); the Sponsors form
 * picks events the same way; both show the other side's current links when they open, both validate in the browser and
 * on the server, and a change made on one side is what the other side shows next, without a reload. See
 * e2e/support/event-sponsors-http.ts for the scratch-data harness these need.
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminApi,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  gotoAdmin,
  makeEvent,
  makeSponsor,
  openAdminTab,
  publicEvents,
  readStore,
  restoreStores,
  writeEvents,
  writeSponsors,
} from './support/event-sponsors-http';
import type { Event, EventSponsorLink } from '@/lib/data';

const S1 = makeSponsor('sp-u1', { name: 'Satisar Travels', companyName: 'Satisar Travels Pty Ltd', order: 0, category: 'Partner' });
const S2 = makeSponsor('sp-u2', { name: 'Bombay Rocks', companyName: 'Bombay Rocks', order: 1, category: '' });
const S3 = makeSponsor('sp-u3', { name: 'Hidden Co', companyName: 'Hidden Co', order: 2, visible: false });
const S4 = makeSponsor('sp-u4', { name: 'Curry Leaf', companyName: 'Curry Leaf', order: 3, category: 'Sponsor & Partner' });

const SEED_EVENTS = () => [
  makeEvent('evt-u1', { title: 'Gala Night', slug: 'gala-night', order: 0, date: '2027-03-01' }),
  makeEvent('evt-u2', { title: 'Spring Concert', slug: 'spring-concert', order: 1, date: '2027-04-10' }),
  makeEvent('evt-u3', { title: 'Winter Drama', slug: 'winter-drama', order: 2, date: '2025-06-01', status: 'past' }),
];

test.describe.configure({ mode: 'serial' });

test.describe('sponsors and partners on events: the admin portal', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    page = await context.newPage();
    await adminLogin(page);
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await context?.close();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(180000);
    writeSponsors([S1, S2, S3, S4]);
    writeEvents(SEED_EVENTS());
    await gotoAdmin(page);
  });

  const storedEvent = (id: string) => readStore<Event[]>('events.json').find((event) => event.id === id) as Event;
  const linksOf = (id: string) => (storedEvent(id).sponsorLinks ?? []) as EventSponsorLink[];
  const api = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => adminApi(page, method, path, body);

  // the Events form
  const eventPicker = (p: Page = page) => p.getByRole('group', { name: 'Sponsors & Partners', exact: true });
  const eventSearch = (p: Page = page) => p.getByRole('combobox', { name: 'Sponsors & Partners', exact: true });
  // the Sponsors form
  const sponsorPicker = (p: Page = page) => p.getByRole('group', { name: 'Events', exact: true });
  const sponsorSearch = (p: Page = page) => p.getByRole('combobox', { name: 'Events', exact: true });

  async function editEvent(p: Page, title: string): Promise<void> {
    await p.locator('tr', { hasText: title }).first().getByRole('button', { name: 'Edit' }).click();
    await expect(p.getByRole('heading', { name: `Edit: ${title}`, level: 3 })).toBeVisible();
  }

  async function editSponsor(p: Page, name: string): Promise<void> {
    await p.locator('[data-sponsor-id]').filter({ hasText: name }).first().getByRole('button', { name: /Edit/ }).click();
    await expect(p.getByRole('heading', { name: new RegExp(`^Edit: ${name}`), level: 3 })).toBeVisible();
  }

  async function fillNewEvent(p: Page, title: string): Promise<void> {
    await p.getByPlaceholder('e.g. Diwali Spectacular 2026').fill(title);
    await p.locator('input[type="date"]').fill('2027-08-01');
    await p.getByPlaceholder('e.g. Concert, Theatre, Festival').fill('Gala');
    await p.getByPlaceholder('e.g. Hamer Hall, Arts Centre Melbourne').fill('Arts Centre');
    await p.getByPlaceholder(/A short \(1-2 sentence\) description/).fill('A night with supporters.');
  }

  const chosen = (p: Page, scope: 'event' | 'sponsor') => (scope === 'event' ? eventPicker(p) : sponsorPicker(p)).getByRole('list', { name: /^Chosen / }).getByRole('listitem');

  // ─── the Events form: create ──────────────────────────────────────────────

  test('a new event is created with several sponsors and partners: search, add by keyboard and by click, a role of your own words, a new order, a removal', async () => {
    await openAdminTab(page, 'Events');
    await page.getByRole('button', { name: '+ New Event' }).click();
    await fillNewEvent(page, 'Supporters Gala');
    await eventPicker().scrollIntoViewIfNeeded();
    await expect(eventPicker().getByText('None chosen')).toBeVisible();

    // search narrows the list; Enter adds the highlighted entry (and does not submit the form); the role starts as the sponsor's category
    await eventSearch().click();
    await expect(eventPicker().getByRole('option')).toHaveCount(4);
    await eventSearch().fill('bomb');
    await expect(eventPicker().getByRole('option')).toHaveCount(1);
    await eventSearch().press('Enter');
    await expect(chosen(page, 'event')).toHaveCount(1);
    await expect(page.getByLabel('Role of Bombay Rocks')).toHaveValue('Sponsor'); // no category: "Sponsor"
    // a mouse click adds the next; the role starts as its category
    await eventSearch().fill('satisar');
    await eventPicker().getByRole('option', { name: /Satisar Travels Pty Ltd/ }).click();
    await expect(page.getByLabel('Role of Satisar Travels Pty Ltd')).toHaveValue('Partner');
    // a hidden sponsor can be chosen, and says that it stays off the page until it is shown
    await eventSearch().fill('hidden');
    await eventPicker().getByRole('option', { name: /Hidden Co/ }).click();
    await expect(chosen(page, 'event').filter({ hasText: 'Hidden Co' })).toContainText('Hidden on the website');
    // free text role, a new order (Satisar to the top), and a removal (Hidden Co)
    await page.getByLabel('Role of Satisar Travels Pty Ltd').fill('Official Travel Partner');
    await page.getByRole('button', { name: 'Move Satisar Travels Pty Ltd up' }).click();
    await page.getByRole('button', { name: 'Remove Hidden Co' }).click();
    await expect(chosen(page, 'event')).toHaveCount(2);
    await expect(chosen(page, 'event').first()).toContainText('Satisar Travels Pty Ltd');
    // the quick roles are suggestions only
    await expect(eventPicker().locator('datalist option')).toHaveCount(3);
    await expect(eventPicker().getByText(/within about 5 minutes/)).toBeVisible();

    await page.getByRole('button', { name: 'Create Event' }).click();
    await expect(page.getByText(/Event created\. Its sponsors and partners show on the public event page within about 5 minutes/)).toBeVisible();
    const created = readStore<Event[]>('events.json').find((event) => event.title === 'Supporters Gala') as Event;
    expect(created.sponsorLinks).toEqual([
      { sponsorId: 'sp-u1', role: 'Official Travel Partner' },
      { sponsorId: 'sp-u2', role: 'Sponsor' },
    ]);
    // the Events table says how many it holds, and the Sponsors tab shows the same links from its side
    await expect(page.locator('tr', { hasText: 'Supporters Gala' }).first()).toContainText('2 sponsors and partners');
    await openAdminTab(page, 'Sponsors');
    await expect(page.locator('[data-sponsor-id="sp-u1"]')).toContainText('Supporters Gala');
    await expect(page.locator('[data-sponsor-id="sp-u1"]')).toContainText('Official Travel Partner');
    await expect(page.locator('[data-sponsor-id="sp-u2"]')).toContainText('Supporters Gala');
  });

  test('without any sponsor chosen a new event is saved exactly as before: no field, no request body entry', async () => {
    await openAdminTab(page, 'Events');
    await page.getByRole('button', { name: '+ New Event' }).click();
    await fillNewEvent(page, 'Plain Evening');
    const bodies: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/api/admin/events') && request.method() === 'POST') bodies.push(request.postData() ?? '');
    });
    await page.getByRole('button', { name: 'Create Event' }).click();
    await expect(page.getByText('Event created', { exact: true })).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).not.toContain('sponsorLinks');
    const created = readStore<Event[]>('events.json').find((event) => event.title === 'Plain Evening') as Event;
    expect('sponsorLinks' in created).toBe(false);
  });

  // ─── the Events form: edit ────────────────────────────────────────────────

  test('editing an event shows the sponsors and partners it holds now, with logos or names and a role each; saving what is shown changes exactly that', async () => {
    writeEvents([
      makeEvent('evt-u1', { title: 'Gala Night', slug: 'gala-night', order: 0, sponsorLinks: [{ sponsorId: 'sp-u2', role: 'Partner' }, { sponsorId: 'sp-u1', role: 'Sponsor' }, { sponsorId: 'sp-u4', role: 'Sponsor & Partner' }] }),
      ...SEED_EVENTS().slice(1),
    ]);
    await gotoAdmin(page);
    await openAdminTab(page, 'Events');
    await expect(page.locator('tr', { hasText: 'Gala Night' }).first()).toContainText('3 sponsors and partners');
    await expect(page.locator('tr', { hasText: 'Spring Concert' }).first()).not.toContainText('sponsor');
    await editEvent(page, 'Gala Night');
    const rows = chosen(page, 'event');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Bombay Rocks');
    await expect(rows.nth(1)).toContainText('Satisar Travels Pty Ltd');
    await expect(rows.nth(2)).toContainText('Curry Leaf');
    await expect(page.getByLabel('Role of Bombay Rocks')).toHaveValue('Partner');
    await expect(page.getByLabel('Role of Satisar Travels Pty Ltd')).toHaveValue('Sponsor');
    await expect(page.getByLabel('Role of Curry Leaf')).toHaveValue('Sponsor & Partner');
    await expect(rows.nth(1).locator('img')).toHaveAttribute('src', '/images/AB_Logo_transparent.png'); // the logo is shown
    // a new role, one removed, one moved: saved as shown
    await page.getByLabel('Role of Curry Leaf').fill('Media Partner');
    await page.getByRole('button', { name: 'Remove Bombay Rocks' }).click();
    await page.getByRole('button', { name: 'Move Curry Leaf up' }).click();
    await page.getByRole('button', { name: 'Update Event' }).click();
    await expect(page.getByText(/Event updated\. Its sponsors and partners show on the public event page within about 5 minutes/)).toBeVisible();
    expect(linksOf('evt-u1')).toEqual([
      { sponsorId: 'sp-u4', role: 'Media Partner' },
      { sponsorId: 'sp-u1', role: 'Sponsor' },
    ]);
    // the public API (what the event page reads) has them in the same order with the same roles
    const shown = (await publicEvents(page.request)).find((event) => event.id === 'evt-u1');
    expect(shown?.eventSponsors?.map((s) => [s.id, s.role])).toEqual([['sp-u4', 'Media Partner'], ['sp-u1', 'Sponsor']]);
  });

  test('an edit that leaves the sponsors alone does not send them: what the Sponsors view saved in the meantime is kept', async () => {
    writeEvents([makeEvent('evt-u1', { title: 'Gala Night', slug: 'gala-night', order: 0, sponsorLinks: [{ sponsorId: 'sp-u1', role: 'Sponsor' }] }), ...SEED_EVENTS().slice(1)]);
    await gotoAdmin(page);
    await openAdminTab(page, 'Events');
    await editEvent(page, 'Gala Night');
    await expect(chosen(page, 'event')).toHaveCount(1);
    // another admin changes this event's sponsors from the Sponsors side while the form is open
    expect((await api('PUT', '/api/admin/sponsors', { id: 'sp-u4', eventLinks: [{ eventId: 'evt-u1', role: 'Partner' }] })).status).toBe(200);
    expect((await api('PUT', '/api/admin/sponsors', { id: 'sp-u1', eventLinks: [] })).status).toBe(200);
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/api/admin/events') && request.method() === 'PUT') requests.push(request.postData() ?? '');
    });
    await page.getByPlaceholder('e.g. Diwali Spectacular 2026').fill('Gala Night (renamed)');
    await page.getByRole('button', { name: 'Update Event' }).click();
    await expect(page.getByText('Event updated', { exact: true })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toContain('sponsorLinks');
    expect(storedEvent('evt-u1').title).toBe('Gala Night (renamed)');
    expect(linksOf('evt-u1')).toEqual([{ sponsorId: 'sp-u4', role: 'Partner' }]); // the other admin's change survived
  });

  test('the form reads the server when it opens: a link changed from the Sponsors side moments ago is what the Events form shows and edits', async () => {
    await openAdminTab(page, 'Events');
    // the dashboard still holds the old list; the server already has a link made elsewhere
    await api('PUT', '/api/admin/events', { id: 'evt-u2', sponsorLinks: [{ sponsorId: 'sp-u2', role: 'Sponsor & Partner' }] });
    await editEvent(page, 'Spring Concert');
    await expect(chosen(page, 'event')).toHaveCount(1);
    await expect(page.getByLabel('Role of Bombay Rocks')).toHaveValue('Sponsor & Partner');
  });

  // ─── validation: in the browser and on the server ─────────────────────────

  test('a role that is too long or has a control character is refused in the browser before any request is made, then saved once it is fixed', async () => {
    await openAdminTab(page, 'Events');
    await editEvent(page, 'Gala Night');
    await eventSearch().fill('satisar');
    await eventPicker().getByRole('option', { name: /Satisar Travels Pty Ltd/ }).click();
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/api/admin/events') && request.method() === 'PUT') requests.push(request.postData() ?? '');
    });
    const role = page.getByLabel('Role of Satisar Travels Pty Ltd');
    await role.fill('x'.repeat(41));
    await expect(role).toHaveAttribute('aria-invalid', 'true');
    await expect(eventPicker().getByRole('alert')).toContainText('Role must be 40 characters or fewer (41 now)');
    await page.getByRole('button', { name: 'Update Event' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Role must be 40 characters or fewer (Satisar Travels Pty Ltd)' })).toBeVisible();
    expect(requests).toHaveLength(0);
    // 40 characters is fine
    await role.fill('y'.repeat(40));
    await expect(role).not.toHaveAttribute('aria-invalid', 'true');
    // a tab inside the text is a control character
    await role.fill('Gold\tSponsor');
    await expect(eventPicker().getByRole('alert')).toContainText('Role must not contain control characters');
    await page.getByRole('button', { name: 'Update Event' }).click();
    expect(requests).toHaveLength(0);
    await role.fill('Gold Sponsor');
    await page.getByRole('button', { name: 'Update Event' }).click();
    await expect(page.getByText(/Event updated/)).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(linksOf('evt-u1')).toEqual([{ sponsorId: 'sp-u1', role: 'Gold Sponsor' }]);
  });

  test('what the server refuses is shown next to the Save button and nothing is saved: a sponsor deleted while the form was open', async () => {
    await openAdminTab(page, 'Events');
    await editEvent(page, 'Gala Night');
    await eventSearch().fill('curry');
    await eventPicker().getByRole('option', { name: /Curry Leaf/ }).click();
    // another admin deletes that sponsor while this form is open
    expect((await api('DELETE', '/api/admin/sponsors', { id: 'sp-u4' })).status).toBe(200);
    await page.getByPlaceholder('e.g. Diwali Spectacular 2026').fill('Should Not Be Saved');
    await page.getByRole('button', { name: 'Update Event' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /sp-u4.*not a sponsor or partner that exists/ })).toBeVisible();
    expect(storedEvent('evt-u1').title).toBe('Gala Night');
    expect('sponsorLinks' in storedEvent('evt-u1')).toBe(false);
  });

  // ─── the Sponsors form ────────────────────────────────────────────────────

  test('a new sponsor is created with several events, a different role at each; its card and the Events tab show the same links', async () => {
    await openAdminTab(page, 'Sponsors');
    await page.getByRole('button', { name: '+ New Sponsor' }).click();
    await page.locator('#sponsor-name').fill('Brand New Partner');
    await page.locator('#sponsor-company-name').fill('Brand New Partner Pty Ltd');
    await page.locator('#sponsor-category').fill('Partner'); // the role a new event starts with
    await sponsorPicker().scrollIntoViewIfNeeded();
    await sponsorSearch().click();
    await expect(sponsorPicker().getByRole('option')).toHaveCount(3);
    await sponsorPicker().getByRole('option', { name: /Gala Night/ }).click();
    await expect(page.getByLabel('Role of Gala Night')).toHaveValue('Partner');
    await sponsorSearch().fill('spring');
    await sponsorSearch().press('Enter');
    await sponsorSearch().fill('winter');
    await sponsorPicker().getByRole('option', { name: /Winter Drama/ }).click();
    await page.getByLabel('Role of Gala Night').fill('Sponsor');
    await page.getByLabel('Role of Winter Drama').fill('Sponsor & Partner');
    await expect(chosen(page, 'sponsor')).toHaveCount(3);
    await expect(sponsorPicker().getByText(/within about 5 minutes/)).toBeVisible();
    await page.locator('form').getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.getByText(/Sponsor created\. Its events show it within about 5 minutes/)).toBeVisible();
    const sponsorId = readStore<Array<{ id: string; name: string }>>('sponsors.json').find((sponsor) => sponsor.name === 'Brand New Partner')?.id as string;
    expect(sponsorId).toBeTruthy();
    expect(linksOf('evt-u1')).toEqual([{ sponsorId, role: 'Sponsor' }]);
    expect(linksOf('evt-u2')).toEqual([{ sponsorId, role: 'Partner' }]);
    expect(linksOf('evt-u3')).toEqual([{ sponsorId, role: 'Sponsor & Partner' }]);
    // the card lists the events with the roles, and the Events tab shows the sponsor on each event
    const card = page.locator(`[data-sponsor-id="${sponsorId}"]`);
    await expect(card).toContainText('LINKED EVENTS');
    await expect(card).toContainText('Gala Night');
    await expect(card).toContainText('Sponsor & Partner');
    await openAdminTab(page, 'Events');
    await page.locator('tr', { hasText: 'Winter Drama' }).first().getByRole('button', { name: 'Images' }).click();
    await expect(page.getByText('Linked Sponsors & Partners')).toBeVisible();
    await expect(page.getByText('Brand New Partner Pty Ltd')).toBeVisible();
  });

  test('editing a sponsor shows the events it is attached to with its role at each; a role changed in place, an event removed and one added are saved as shown', async () => {
    writeEvents([
      makeEvent('evt-u1', { title: 'Gala Night', slug: 'gala-night', order: 0, sponsorLinks: [{ sponsorId: 'sp-u2', role: 'Sponsor' }, { sponsorId: 'sp-u1', role: 'Sponsor' }] }),
      makeEvent('evt-u2', { title: 'Spring Concert', slug: 'spring-concert', order: 1, sponsorLinks: [{ sponsorId: 'sp-u1', role: 'Partner' }] }),
      makeEvent('evt-u3', { title: 'Winter Drama', slug: 'winter-drama', order: 2, status: 'past', date: '2025-06-01' }),
    ]);
    await gotoAdmin(page);
    await openAdminTab(page, 'Sponsors');
    await editSponsor(page, 'Satisar Travels');
    const rows = chosen(page, 'sponsor');
    await expect(rows).toHaveCount(2);
    await expect(page.getByLabel('Role of Gala Night')).toHaveValue('Sponsor');
    await expect(page.getByLabel('Role of Spring Concert')).toHaveValue('Partner');
    await expect(rows.first()).toContainText('2027-03-01 · upcoming');
    await page.getByLabel('Role of Gala Night').fill('Sponsor & Partner');
    await page.getByRole('button', { name: 'Remove Spring Concert' }).click();
    await sponsorSearch().fill('winter');
    await sponsorPicker().getByRole('option', { name: /Winter Drama/ }).click();
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText(/Sponsor updated\. Its events show it within about 5 minutes/)).toBeVisible();
    // the role changed in place: Bombay Rocks is still first on Gala Night
    expect(linksOf('evt-u1')).toEqual([{ sponsorId: 'sp-u2', role: 'Sponsor' }, { sponsorId: 'sp-u1', role: 'Sponsor & Partner' }]);
    expect('sponsorLinks' in storedEvent('evt-u2')).toBe(false);
    expect(linksOf('evt-u3')).toEqual([{ sponsorId: 'sp-u1', role: 'Partner' }]); // a new event starts with the sponsor's category as its role
    // other fields of the sponsor are untouched
    const stored = readStore<Array<{ id: string; revenue?: number; contractValue?: number }>>('sponsors.json').find((sponsor) => sponsor.id === 'sp-u1');
    expect(stored?.revenue).toBe(2500);
    expect(stored?.contractValue).toBe(9000);
  });

  test('a sponsor edit that leaves its events alone does not send them; and the Sponsors form refuses a bad role in the browser', async () => {
    writeEvents([makeEvent('evt-u1', { title: 'Gala Night', slug: 'gala-night', order: 0, sponsorLinks: [{ sponsorId: 'sp-u1', role: 'Sponsor' }] }), ...SEED_EVENTS().slice(1)]);
    await gotoAdmin(page);
    await openAdminTab(page, 'Sponsors');
    await editSponsor(page, 'Satisar Travels');
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/api/admin/sponsors') && request.method() === 'PUT') requests.push(request.postData() ?? '');
    });
    // the Events side changes this sponsor's link while the form is open
    await api('PUT', '/api/admin/events', { id: 'evt-u1', sponsorLinks: [{ sponsorId: 'sp-u1', role: 'Media Partner' }] });
    await page.locator('#sponsor-description').fill('A note');
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('Sponsor updated', { exact: true })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toContain('eventLinks');
    expect(linksOf('evt-u1')).toEqual([{ sponsorId: 'sp-u1', role: 'Media Partner' }]);
    // a role over 40 characters is refused in the browser
    await editSponsor(page, 'Satisar Travels');
    await page.getByLabel('Role of Gala Night').fill('z'.repeat(45));
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Role must be 40 characters or fewer (Gala Night)' })).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  test('a hidden sponsor can be attached, and the Sponsors form says it stays off the event pages until it is shown', async () => {
    await openAdminTab(page, 'Sponsors');
    await editSponsor(page, 'Hidden Co');
    await sponsorSearch().fill('gala');
    await sponsorPicker().getByRole('option', { name: /Gala Night/ }).click();
    await expect(sponsorPicker().getByRole('note')).toContainText('hidden');
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText(/Sponsor updated/)).toBeVisible();
    expect(linksOf('evt-u1').map((link) => link.sponsorId)).toEqual(['sp-u3']);
    // not on the public event page's data while hidden
    expect(((await publicEvents(page.request)).find((event) => event.id === 'evt-u1') as Record<string, unknown>).eventSponsors).toBeUndefined();
  });

  // ─── both sides agree, without a reload ───────────────────────────────────

  test('a change made on one side is what the other side shows next, in both directions, without reloading the portal', async () => {
    // Sponsors side first: attach Satisar to Gala Night as "Sponsor"
    await openAdminTab(page, 'Sponsors');
    await editSponsor(page, 'Satisar Travels');
    await sponsorSearch().fill('gala');
    await sponsorPicker().getByRole('option', { name: /Gala Night/ }).click();
    await page.getByLabel('Role of Gala Night').fill('Title Sponsor');
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText(/Sponsor updated/)).toBeVisible();
    // the Events tab (same page, no reload) shows it in the form
    await openAdminTab(page, 'Events');
    await editEvent(page, 'Gala Night');
    await expect(chosen(page, 'event')).toHaveCount(1);
    await expect(page.getByLabel('Role of Satisar Travels Pty Ltd')).toHaveValue('Title Sponsor');
    // Events side: add Curry Leaf as a Partner and change Satisar's role
    await page.getByLabel('Role of Satisar Travels Pty Ltd').fill('Presenting Sponsor');
    await eventSearch().fill('curry');
    await eventPicker().getByRole('option', { name: /Curry Leaf/ }).click();
    await page.getByLabel('Role of Curry Leaf').fill('Partner');
    await page.getByRole('button', { name: 'Update Event' }).click();
    await expect(page.getByText(/Event updated/)).toBeVisible();
    // back on the Sponsors tab: both cards and both forms show the new state
    await openAdminTab(page, 'Sponsors');
    await expect(page.locator('[data-sponsor-id="sp-u1"]')).toContainText('Presenting Sponsor');
    await expect(page.locator('[data-sponsor-id="sp-u4"]')).toContainText('Gala Night');
    await editSponsor(page, 'Curry Leaf');
    await expect(page.getByLabel('Role of Gala Night')).toHaveValue('Partner');
    expect(linksOf('evt-u1')).toEqual([{ sponsorId: 'sp-u1', role: 'Presenting Sponsor' }, { sponsorId: 'sp-u4', role: 'Partner' }]);
  });

  test('deleting a sponsor in the portal takes it off every event, in the Events tab as well', async () => {
    writeEvents([
      makeEvent('evt-u1', { title: 'Gala Night', slug: 'gala-night', order: 0, sponsorLinks: [{ sponsorId: 'sp-u1', role: 'Sponsor' }, { sponsorId: 'sp-u2', role: 'Partner' }] }),
      makeEvent('evt-u2', { title: 'Spring Concert', slug: 'spring-concert', order: 1, sponsorLinks: [{ sponsorId: 'sp-u1', role: 'Partner' }] }),
      makeEvent('evt-u3', { title: 'Winter Drama', slug: 'winter-drama', order: 2, status: 'past', date: '2025-06-01' }),
    ]);
    await gotoAdmin(page);
    await openAdminTab(page, 'Sponsors');
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('every event it is attached to');
      void dialog.accept();
    });
    await page.locator('[data-sponsor-id="sp-u1"]').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Sponsor deleted')).toBeVisible();
    expect(linksOf('evt-u1')).toEqual([{ sponsorId: 'sp-u2', role: 'Partner' }]);
    expect('sponsorLinks' in storedEvent('evt-u2')).toBe(false);
    await openAdminTab(page, 'Events');
    await page.locator('tr', { hasText: 'Gala Night' }).first().getByRole('button', { name: 'Images' }).click();
    await expect(page.getByText('Bombay Rocks').first()).toBeVisible();
    await expect(page.getByText('Satisar Travels Pty Ltd')).toHaveCount(0);
  });

  test('the table\'s Linked Sponsors & Partners panel removes one link with its own button, keeping the others and their roles', async () => {
    writeEvents([makeEvent('evt-u1', { title: 'Gala Night', slug: 'gala-night', order: 0, sponsorLinks: [{ sponsorId: 'sp-u1', role: 'Sponsor' }, { sponsorId: 'sp-u2', role: 'Partner' }, { sponsorId: 'sp-u4', role: 'Media Partner' }] }), ...SEED_EVENTS().slice(1)]);
    await gotoAdmin(page);
    await openAdminTab(page, 'Events');
    await page.locator('tr', { hasText: 'Gala Night' }).first().getByRole('button', { name: 'Images' }).click();
    await expect(page.getByText('Media Partner', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Remove Bombay Rocks from Gala Night' }).click();
    await expect.poll(() => linksOf('evt-u1')).toEqual([{ sponsorId: 'sp-u1', role: 'Sponsor' }, { sponsorId: 'sp-u4', role: 'Media Partner' }]);
  });

  test('removing one link from the table also works while the event still holds a link to a sponsor that no longer exists: the dead link is dropped, the rest keep their roles', async () => {
    writeEvents([
      makeEvent('evt-u1', {
        title: 'Gala Night',
        slug: 'gala-night',
        order: 0,
        sponsorLinks: [{ sponsorId: 'sp-u1', role: 'Sponsor' }, { sponsorId: 'sp-gone', role: 'Partner' }, { sponsorId: 'sp-u2', role: 'Media Partner' }, { sponsorId: 'sp-u4', role: 'Partner' }],
      }),
      ...SEED_EVENTS().slice(1),
    ]);
    await gotoAdmin(page);
    await openAdminTab(page, 'Events');
    await page.locator('tr', { hasText: 'Gala Night' }).first().getByRole('button', { name: 'Images' }).click();
    await expect(page.getByText('Media Partner', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Remove Satisar Travels Pty Ltd from Gala Night' }).click();
    await expect.poll(() => linksOf('evt-u1')).toEqual([{ sponsorId: 'sp-u2', role: 'Media Partner' }, { sponsorId: 'sp-u4', role: 'Partner' }]);
  });

  // ─── keyboard and phone ───────────────────────────────────────────────────

  test('the picker works from the keyboard alone: arrows move, Enter adds and never submits the form, Escape closes, Tab leaves', async () => {
    await openAdminTab(page, 'Events');
    await page.getByRole('button', { name: '+ New Event' }).click();
    await fillNewEvent(page, 'Keyboard Evening');
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/api/admin/events') && request.method() === 'POST') posts.push(request.url());
    });
    const search = eventSearch();
    await search.focus();
    await expect(search).toHaveAttribute('aria-expanded', 'true'); // focusing opens the list
    await search.press('ArrowDown');
    const active = await search.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    await expect(page.locator(`#${active}`)).toHaveAttribute('role', 'option');
    await expect(page.locator(`#${active}`)).toHaveAttribute('aria-selected', 'true');
    await search.press('Enter'); // adds the highlighted entry
    await expect(chosen(page, 'event')).toHaveCount(1);
    expect(posts).toHaveLength(0); // Enter did not submit the form
    await search.press('ArrowDown');
    await search.press('ArrowDown');
    await search.press('ArrowUp');
    await search.press('Enter');
    await expect(chosen(page, 'event')).toHaveCount(2);
    await search.press('Escape');
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await search.press('ArrowDown'); // reopens
    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await search.fill('zzz-nothing');
    await expect(page.getByText(/No sponsors and partners match/)).toBeVisible();
    await search.press('Enter');
    await expect(chosen(page, 'event')).toHaveCount(2); // nothing to add
    await search.press('Escape');
    await search.press('Escape'); // a second Escape clears the text
    await expect(search).toHaveValue('');
    await search.press('Tab');
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    // every control has a name a screen reader can say
    for (const button of await eventPicker().getByRole('button').all()) {
      expect(((await button.getAttribute('aria-label')) ?? (await button.innerText())).trim().length).toBeGreaterThan(0);
    }
    await expect(eventPicker().locator('[role="status"]')).toContainText('added');
  });

  test('on a phone (390 px) the picker fits the screen, every control is at least 44 px, a long role is fully visible and an entry can be added by tapping', async ({ browser }) => {
    const phone = await newPhone(browser, context);
    try {
      const p = await phone.newPage();
      await gotoAdmin(p);
      await openAdminTab(p, 'Events');
      writeEvents([makeEvent('evt-u1', { title: 'Gala Night', slug: 'gala-night', order: 0, sponsorLinks: [{ sponsorId: 'sp-u1', role: 'Sponsor & Partner' }, { sponsorId: 'sp-u2', role: 'Sponsor & Partner' }] }), ...SEED_EVENTS().slice(1)]);
      await p.reload();
      await openAdminTab(p, 'Events');
      await editEvent(p, 'Gala Night');
      await eventPicker(p).scrollIntoViewIfNeeded();
      await expect(chosen(p, 'event')).toHaveCount(2);
      // nothing wider than the screen
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // every button and input of the picker is at least 44 px in both directions
      const small = await eventPicker(p).evaluate((root) => {
        const found: string[] = [];
        for (const element of Array.from(root.querySelectorAll<HTMLElement>('button, input'))) {
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;
          if (box.width < 43.5 || box.height < 43.5) found.push(`${element.tagName.toLowerCase()} ${element.getAttribute('aria-label') ?? element.id} ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
        return found;
      });
      expect(small, `controls under 44 px: ${small.join('; ')}`).toEqual([]);
      // the longest of the suggested roles is not cut off
      const roleBox = await p.getByLabel('Role of Bombay Rocks').evaluate((input: HTMLInputElement) => ({ scroll: input.scrollWidth, client: input.clientWidth }));
      expect(roleBox.scroll).toBeLessThanOrEqual(roleBox.client);
      // tap to add
      await eventSearch(p).tap();
      await eventPicker(p).getByRole('option', { name: /Curry Leaf/ }).tap();
      await expect(chosen(p, 'event')).toHaveCount(3);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // the Sponsors form as well
      await openAdminTab(p, 'Sponsors');
      await editSponsor(p, 'Satisar Travels');
      await sponsorPicker(p).scrollIntoViewIfNeeded();
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const smallSponsor = await sponsorPicker(p).evaluate((root) =>
        Array.from(root.querySelectorAll<HTMLElement>('button, input'))
          .filter((element) => element.getBoundingClientRect().width > 0)
          .filter((element) => element.getBoundingClientRect().width < 43.5 || element.getBoundingClientRect().height < 43.5)
          .map((element) => element.getAttribute('aria-label') ?? element.id),
      );
      expect(smallSponsor).toEqual([]);
    } finally {
      await phone.close();
    }
  });
});

async function newPhone(browser: Browser, from: BrowserContext): Promise<BrowserContext> {
  // the same session, on a phone-sized touch screen
  return browser.newContext({
    storageState: await from.storageState(),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
}
