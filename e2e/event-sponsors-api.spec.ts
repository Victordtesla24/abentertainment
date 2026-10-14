/**
 * Sponsors and partners on events: the admin and public APIs against a real dev server with scratch data.
 *
 * Covers both directions (the event form sends `sponsorLinks`, the sponsor form sends `eventLinks`), the validation of
 * ids, roles and duplicates (a refused request changes nothing, not even one byte of the stores), the clean-up when a
 * sponsor is deleted or hidden and when an event is deleted, overlapping edits from both sides (no lost update), a
 * store that cannot be read, and the public projection (public fields only, hidden sponsors never, an event without
 * any exactly as it was). See e2e/support/event-sponsors-http.ts for the harness these need.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  DATA_DIR,
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminApi,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  makeEvent,
  makeSponsor,
  publicEvents,
  readStore,
  readStoreText,
  restoreStores,
  writeEvents,
  writeSponsors,
} from './support/event-sponsors-http';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Event, EventSponsorLink, Sponsor } from '@/lib/data';

const S1 = makeSponsor('sp-t1', { name: 'Satisar Travels', companyName: 'Satisar Travels Pty Ltd', order: 0 });
const S2 = makeSponsor('sp-t2', { name: 'Bombay Rocks', companyName: 'Bombay Rocks', order: 1, url: 'http://insecure.example.com' });
const S3 = makeSponsor('sp-t3', { name: 'Hidden Co', companyName: 'Hidden Co', order: 2, visible: false });
const S4 = makeSponsor('sp-t4', { name: 'Curry Leaf', companyName: 'Curry Leaf', order: 3, logo: '' });

test.describe.configure({ mode: 'serial' });

test.describe('event sponsors and partners over HTTP', () => {
  let page: Page;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    page = await (await browser.newContext()).newPage();
    await adminLogin(page);
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await page?.context().close();
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    writeSponsors([S1, S2, S3, S4]);
    writeEvents([makeEvent('evt-e1', { order: 0 }), makeEvent('evt-e2', { order: 1 }), makeEvent('evt-e3', { order: 2, status: 'past', date: '2025-01-01' })]);
  });

  const api = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => adminApi(page, method, path, body);
  const storedEvent = (id: string) => readStore<Event[]>('events.json').find((event) => event.id === id) as Event;
  const links = (id: string) => (storedEvent(id).sponsorLinks ?? []) as EventSponsorLink[];
  const adminEvents = async () => (((await api('GET', '/api/admin/events')).body?.events ?? []) as Event[]);

  test('without a session every way of changing links is refused and nothing is written', async ({ request }) => {
    const before = readStoreText('events.json');
    const beforeSponsors = readStoreText('sponsors.json');
    const origin = { origin: 'https://abentertainment.com.au' };
    expect((await request.put('/api/admin/events', { data: { id: 'evt-e1', sponsorLinks: [{ sponsorId: 'sp-t1', role: 'Sponsor' }] }, headers: origin })).status()).toBe(401);
    expect((await request.post('/api/admin/events', { data: { title: 'X', sponsorLinks: [] }, headers: origin })).status()).toBe(401);
    expect((await request.put('/api/admin/sponsors', { data: { id: 'sp-t1', eventLinks: [{ eventId: 'evt-e1', role: 'Sponsor' }] }, headers: origin })).status()).toBe(401);
    expect((await request.post('/api/admin/sponsors', { data: { name: 'X', eventLinks: [] }, headers: origin })).status()).toBe(401);
    expect((await request.delete('/api/admin/sponsors', { data: { id: 'sp-t1' }, headers: origin })).status()).toBe(401);
    expect((await request.post('/api/admin/events/reorder', { data: { aId: 'evt-e1', bId: 'evt-e2' }, headers: origin })).status()).toBe(401);
    expect(readStoreText('events.json')).toBe(before);
    expect(readStoreText('sponsors.json')).toBe(beforeSponsors);
  });

  test('an event is created with sponsors and partners in the admin\'s order, and the public API shows exactly the public part', async ({ request }) => {
    const created = await api('POST', '/api/admin/events', {
      title: 'Linked Gala',
      date: '2027-05-01',
      venue: 'Arts Centre',
      description: 'A gala with supporters.',
      category: 'Gala',
      sponsorLinks: [{ sponsorId: 'sp-t2', role: 'Partner' }, { sponsorId: 'sp-t1', role: 'Sponsor & Partner' }, { sponsorId: 'sp-t3', role: 'Sponsor' }],
    });
    expect(created.status).toBe(201);
    const event = created.body?.event as Event;
    expect(event.sponsorLinks).toEqual([{ sponsorId: 'sp-t2', role: 'Partner' }, { sponsorId: 'sp-t1', role: 'Sponsor & Partner' }, { sponsorId: 'sp-t3', role: 'Sponsor' }]);
    expect(links(event.id)).toEqual(event.sponsorLinks);
    expect((await adminEvents()).find((e) => e.id === event.id)?.sponsorLinks).toEqual(event.sponsorLinks);

    const shown = (await publicEvents(request)).find((e) => e.id === event.id);
    expect(shown?.eventSponsors).toEqual([
      { id: 'sp-t2', name: 'Bombay Rocks', logo: '/images/AB_Logo_transparent.png', role: 'Partner' }, // its http website is no link
      { id: 'sp-t1', name: 'Satisar Travels Pty Ltd', logo: '/images/AB_Logo_transparent.png', url: 'https://sp-t1.example.com/', role: 'Sponsor & Partner' },
    ]); // the hidden sponsor is attached but not shown
    expect(shown && ['sponsorLinks', 'sponsorIds', 'ticketsSold', 'ticketRevenue'].some((field) => field in shown)).toBe(false);
    const wire = JSON.stringify(await publicEvents(request));
    for (const secret of ['platinum', 'Internal note', '2500', '9000', 'revenue', 'contractValue', 'sp-t3', 'Hidden Co']) expect(wire).not.toContain(secret);

    // an event created without any carries no field at all, publicly or in the store
    const plain = await api('POST', '/api/admin/events', { title: 'Plain Night', date: '2027-06-01', venue: 'Somewhere', description: 'No supporters.', category: 'Night' });
    expect(plain.status).toBe(201);
    const plainId = (plain.body?.event as Event).id;
    expect('sponsorLinks' in storedEvent(plainId)).toBe(false);
    const plainPublic = (await publicEvents(request)).find((e) => e.id === plainId) as Record<string, unknown>;
    expect('eventSponsors' in plainPublic).toBe(false);
    const withEmpty = await api('POST', '/api/admin/events', { title: 'Empty List', date: '2027-07-01', venue: 'Somewhere', description: 'Sent an empty list.', category: 'Night', sponsorLinks: [] });
    expect(withEmpty.status).toBe(201);
    expect('sponsorLinks' in storedEvent((withEmpty.body?.event as Event).id)).toBe(false);
  });

  test('the links of an event change as a whole, keep their order, and an edit that does not carry them leaves them alone', async () => {
    const set = await api('PUT', '/api/admin/events', { id: 'evt-e1', sponsorLinks: [{ sponsorId: 'sp-t1', role: 'Sponsor' }, { sponsorId: 'sp-t2', role: 'Partner' }] });
    expect(set.status).toBe(200);
    expect(links('evt-e1')).toEqual([{ sponsorId: 'sp-t1', role: 'Sponsor' }, { sponsorId: 'sp-t2', role: 'Partner' }]);
    expect(storedEvent('evt-e1').updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
    // a new order and a new role
    await api('PUT', '/api/admin/events', { id: 'evt-e1', sponsorLinks: [{ sponsorId: 'sp-t2', role: 'Sponsor & Partner' }, { sponsorId: 'sp-t1', role: 'Sponsor' }] });
    expect(links('evt-e1')).toEqual([{ sponsorId: 'sp-t2', role: 'Sponsor & Partner' }, { sponsorId: 'sp-t1', role: 'Sponsor' }]);
    // an edit of the title alone: the links are exactly as they were, even though they are not in the request
    const edited = await api('PUT', '/api/admin/events', { id: 'evt-e1', title: 'A New Title' });
    expect(edited.status).toBe(200);
    expect(links('evt-e1')).toEqual([{ sponsorId: 'sp-t2', role: 'Sponsor & Partner' }, { sponsorId: 'sp-t1', role: 'Sponsor' }]);
    expect((edited.body?.event as Event).title).toBe('A New Title');
    // the same links again: nothing about the links changes
    const stamp = storedEvent('evt-e1').updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 15));
    await api('PUT', '/api/admin/events', { id: 'evt-e1', sponsorLinks: links('evt-e1') });
    expect(links('evt-e1')).toHaveLength(2);
    expect(storedEvent('evt-e1').updatedAt >= stamp).toBe(true);
    // an empty list removes the field entirely: the record is shaped as it was before any link existed
    await api('PUT', '/api/admin/events', { id: 'evt-e1', sponsorLinks: [] });
    expect('sponsorLinks' in storedEvent('evt-e1')).toBe(false);
    // ids that are not an event: 404
    expect((await api('PUT', '/api/admin/events', { id: 'evt-nope', sponsorLinks: [] })).status).toBe(404);
  });

  test('the server refuses what is not valid, says why, and changes nothing', async () => {
    writeEvents([makeEvent('evt-e1', { sponsorLinks: [{ sponsorId: 'sp-t1', role: 'Sponsor' }] }), makeEvent('evt-e2')]);
    const frozen = readStoreText('events.json');
    const frozenSponsors = readStoreText('sponsors.json');
    const bad: Array<[string, unknown, RegExp]> = [
      ['an id that is not a sponsor', [{ sponsorId: 'sp-404', role: 'Sponsor' }], /sp-404.*not a sponsor or partner that exists/],
      ['the same sponsor twice', [{ sponsorId: 'sp-t1', role: 'Sponsor' }, { sponsorId: 'sp-t2' }, { sponsorId: 'sp-t1', role: 'Partner' }], /sp-t1.*listed more than once/],
      ['a role that is too long', [{ sponsorId: 'sp-t1', role: 'x'.repeat(41) }], /role of sponsor or partner 1 must be 40 characters or fewer/],
      ['a role with a line break', [{ sponsorId: 'sp-t1', role: 'a\nb' }], /must not contain control characters/],
      ['a role that is not text', [{ sponsorId: 'sp-t1', role: 5 }], /must be text/],
      ['an entry that is not an object', ['sp-t1'], /must be an object/],
      ['an entry without an id', [{ role: 'Sponsor' }], /needs a valid sponsor id/],
      ['an id that is not safe', [{ sponsorId: '../etc/passwd' }], /needs a valid sponsor id/],
      ['not a list', { sponsorId: 'sp-t1' }, /must be a list/],
      ['too many', Array.from({ length: 101 }, (_, i) => ({ sponsorId: `sp-${i}` })), /at most 100/],
    ];
    for (const [label, sponsorLinks, message] of bad) {
      const put = await api('PUT', '/api/admin/events', { id: 'evt-e1', title: 'Should Not Be Saved', sponsorLinks });
      expect(put.status, label).toBe(400);
      expect(String(put.body?.error), label).toMatch(message);
      expect(Array.isArray(put.body?.errors), label).toBe(true);
      const post = await api('POST', '/api/admin/events', { title: 'Should Not Exist', date: '2027-01-01', venue: 'v', description: 'd', category: 'c', sponsorLinks });
      expect(post.status, label).toBe(400);
    }
    // several problems come back together
    const several = await api('PUT', '/api/admin/events', { id: 'evt-e1', sponsorLinks: [{ sponsorId: 'sp-404' }, { sponsorId: 'sp-t1', role: 'q'.repeat(50) }] });
    expect(several.body?.errors).toHaveLength(2);
    // not one byte of either store changed, and no event was created
    expect(readStoreText('events.json')).toBe(frozen);
    expect(readStoreText('sponsors.json')).toBe(frozenSponsors);
  });

  test('from the sponsor side: attach to several events with a different role on each, change one in place, detach by leaving it out', async () => {
    const first = await api('PUT', '/api/admin/sponsors', {
      id: 'sp-t1',
      eventLinks: [{ eventId: 'evt-e1', role: 'Sponsor' }, { eventId: 'evt-e2', role: 'Partner' }, { eventId: 'evt-e3', role: 'Sponsor & Partner' }],
    });
    expect(first.status).toBe(200);
    expect(first.body?.eventLinks).toEqual([{ eventId: 'evt-e1', role: 'Sponsor' }, { eventId: 'evt-e2', role: 'Partner' }, { eventId: 'evt-e3', role: 'Sponsor & Partner' }]);
    expect(links('evt-e1')).toEqual([{ sponsorId: 'sp-t1', role: 'Sponsor' }]);
    expect(links('evt-e3')).toEqual([{ sponsorId: 'sp-t1', role: 'Sponsor & Partner' }]);
    // another sponsor attaches to evt-e1 after the first: it goes after it
    await api('PUT', '/api/admin/sponsors', { id: 'sp-t2', eventLinks: [{ eventId: 'evt-e1', role: 'Partner' }] });
    expect(links('evt-e1')).toEqual([{ sponsorId: 'sp-t1', role: 'Sponsor' }, { sponsorId: 'sp-t2', role: 'Partner' }]);
    // changing a role keeps the place; leaving an event out detaches
    const second = await api('PUT', '/api/admin/sponsors', { id: 'sp-t1', eventLinks: [{ eventId: 'evt-e1', role: 'Sponsor & Partner' }, { eventId: 'evt-e3', role: 'Sponsor & Partner' }] });
    expect(second.body?.eventLinks).toEqual([{ eventId: 'evt-e1', role: 'Sponsor & Partner' }, { eventId: 'evt-e3', role: 'Sponsor & Partner' }]);
    expect(links('evt-e1')).toEqual([{ sponsorId: 'sp-t1', role: 'Sponsor & Partner' }, { sponsorId: 'sp-t2', role: 'Partner' }]);
    expect('sponsorLinks' in storedEvent('evt-e2')).toBe(false); // the last link gone, the field gone
    // an update of the sponsor's own fields that carries no eventLinks leaves its events alone
    const renamed = await api('PUT', '/api/admin/sponsors', { id: 'sp-t1', name: 'Renamed' });
    expect(renamed.status).toBe(200);
    expect('eventLinks' in (renamed.body ?? {})).toBe(false);
    expect(links('evt-e1')[0]).toEqual({ sponsorId: 'sp-t1', role: 'Sponsor & Partner' });
    // an empty list detaches it everywhere
    await api('PUT', '/api/admin/sponsors', { id: 'sp-t1', eventLinks: [] });
    expect(links('evt-e1')).toEqual([{ sponsorId: 'sp-t2', role: 'Partner' }]);
    expect('sponsorLinks' in storedEvent('evt-e3')).toBe(false);
  });

  test('a new sponsor is created with its events in one request', async () => {
    const created = await api('POST', '/api/admin/sponsors', { name: 'Brand New Partner', eventLinks: [{ eventId: 'evt-e2', role: 'Partner' }, { eventId: 'evt-e1', role: 'Sponsor' }] });
    expect(created.status).toBe(201);
    const sponsor = created.body?.sponsor as Sponsor;
    expect(created.body?.eventLinks).toEqual([{ eventId: 'evt-e1', role: 'Sponsor' }, { eventId: 'evt-e2', role: 'Partner' }]); // in the order of the events
    expect(links('evt-e1')).toEqual([{ sponsorId: sponsor.id, role: 'Sponsor' }]);
    expect(links('evt-e2')).toEqual([{ sponsorId: sponsor.id, role: 'Partner' }]);
    // without eventLinks nothing about events is touched or returned
    const solo = await api('POST', '/api/admin/sponsors', { name: 'No Events' });
    expect(solo.status).toBe(201);
    expect('eventLinks' in (solo.body ?? {})).toBe(false);
  });

  test('the sponsor side refuses what is not valid, and then neither the sponsor nor the events change', async () => {
    writeEvents([makeEvent('evt-e1', { sponsorLinks: [{ sponsorId: 'sp-t1', role: 'Sponsor' }] }), makeEvent('evt-e2')]);
    const frozenEvents = readStoreText('events.json');
    const frozenSponsors = readStoreText('sponsors.json');
    const bad: Array<[string, unknown, RegExp]> = [
      ['an event that does not exist', [{ eventId: 'evt-404', role: 'Sponsor' }], /evt-404.*not an event that exists/],
      ['the same event twice', [{ eventId: 'evt-e1' }, { eventId: 'evt-e1', role: 'Partner' }], /evt-e1.*listed more than once/],
      ['a role that is too long', [{ eventId: 'evt-e1', role: 'z'.repeat(41) }], /must be 40 characters or fewer/],
      ['a role with a control character', [{ eventId: 'evt-e1', role: 'a\tb' }], /control characters/],
      ['not a list', 'evt-e1', /must be a list/],
      ['an entry without an id', [{ role: 'Sponsor' }], /needs a valid event id/],
    ];
    for (const [label, eventLinks, message] of bad) {
      const put = await api('PUT', '/api/admin/sponsors', { id: 'sp-t1', name: 'Should Not Be Saved', eventLinks });
      expect(put.status, label).toBe(400);
      expect(String(put.body?.error), label).toMatch(message);
      const post = await api('POST', '/api/admin/sponsors', { name: 'Should Not Exist', eventLinks });
      expect(post.status, label).toBe(400);
    }
    // a sponsor that does not exist is a 404 even when the links are fine
    expect((await api('PUT', '/api/admin/sponsors', { id: 'sp-nope', eventLinks: [{ eventId: 'evt-e1', role: 'Sponsor' }] })).status).toBe(404);
    expect(readStoreText('events.json')).toBe(frozenEvents);
    expect(readStoreText('sponsors.json')).toBe(frozenSponsors);
  });

  test('the Events view and the Sponsors view are the same data: a change from either side shows at once on the other', async () => {
    // from the event side
    await api('PUT', '/api/admin/events', { id: 'evt-e1', sponsorLinks: [{ sponsorId: 'sp-t1', role: 'Sponsor' }, { sponsorId: 'sp-t2', role: 'Partner' }] });
    const fromSponsor = await api('PUT', '/api/admin/sponsors', { id: 'sp-t2', eventLinks: [{ eventId: 'evt-e1', role: 'Partner' }, { eventId: 'evt-e2', role: 'Sponsor' }] });
    // the sponsor side's answer is what the events hold, and the event side sees the change
    const held = async (sponsorId: string) =>
      (await adminEvents()).flatMap((event) => (event.sponsorLinks ?? []).filter((l) => l.sponsorId === sponsorId).map((l) => ({ eventId: event.id, role: l.role })));
    expect(fromSponsor.body?.eventLinks).toEqual(await held('sp-t2'));
    expect((await adminEvents()).find((e) => e.id === 'evt-e2')?.sponsorLinks).toEqual([{ sponsorId: 'sp-t2', role: 'Sponsor' }]);
    // the event side changes a role: what the Sponsors view loads next has it, and saving that list back changes nothing
    await api('PUT', '/api/admin/events', { id: 'evt-e2', sponsorLinks: [{ sponsorId: 'sp-t2', role: 'Sponsor & Partner' }, { sponsorId: 'sp-t4', role: 'Partner' }] });
    expect(await held('sp-t2')).toEqual([{ eventId: 'evt-e1', role: 'Partner' }, { eventId: 'evt-e2', role: 'Sponsor & Partner' }]);
    const again = await api('PUT', '/api/admin/sponsors', { id: 'sp-t2', eventLinks: await held('sp-t2') });
    expect(again.body?.eventLinks).toEqual([{ eventId: 'evt-e1', role: 'Partner' }, { eventId: 'evt-e2', role: 'Sponsor & Partner' }]);
    expect((await adminEvents()).find((e) => e.id === 'evt-e2')?.sponsorLinks).toEqual([{ sponsorId: 'sp-t2', role: 'Sponsor & Partner' }, { sponsorId: 'sp-t4', role: 'Partner' }]);
    // one organisation, three roles on three events
    await api('PUT', '/api/admin/sponsors', { id: 'sp-t4', eventLinks: [{ eventId: 'evt-e1', role: 'Sponsor' }, { eventId: 'evt-e2', role: 'Partner' }, { eventId: 'evt-e3', role: 'Sponsor & Partner' }] });
    const roles = (await adminEvents()).map((e) => e.sponsorLinks?.find((l) => l.sponsorId === 'sp-t4')?.role);
    expect(roles).toEqual(['Sponsor', 'Partner', 'Sponsor & Partner']);
  });

  test('deleting a sponsor removes it from every event; hiding it keeps the links and only the public page changes; deleting an event takes its links with it', async ({ request }) => {
    writeEvents([
      makeEvent('evt-e1', { order: 0, sponsorLinks: [{ sponsorId: 'sp-t1', role: 'Sponsor' }, { sponsorId: 'sp-t4', role: 'Partner' }] }),
      makeEvent('evt-e2', { order: 1, sponsorLinks: [{ sponsorId: 'sp-t4', role: 'Sponsor' }] }),
      makeEvent('evt-e3', { order: 2 }),
    ]);
    const untouched = JSON.stringify(storedEvent('evt-e3'));
    // hiding: the link stays in the store, the public page loses it, and showing brings it back in the same place
    expect((await api('PUT', '/api/admin/sponsors', { id: 'sp-t1', visible: false })).status).toBe(200);
    expect(links('evt-e1').map((l) => l.sponsorId)).toEqual(['sp-t1', 'sp-t4']);
    expect(((await publicEvents(request)).find((e) => e.id === 'evt-e1')?.eventSponsors ?? []).map((s) => s.id)).toEqual(['sp-t4']);
    await api('PUT', '/api/admin/sponsors', { id: 'sp-t1', visible: true });
    expect(((await publicEvents(request)).find((e) => e.id === 'evt-e1')?.eventSponsors ?? []).map((s) => s.id)).toEqual(['sp-t1', 'sp-t4']);
    // deleting: gone from every event that held it, and from nowhere else
    expect((await api('DELETE', '/api/admin/sponsors', { id: 'sp-t4' })).status).toBe(200);
    expect(links('evt-e1')).toEqual([{ sponsorId: 'sp-t1', role: 'Sponsor' }]);
    expect('sponsorLinks' in storedEvent('evt-e2')).toBe(false);
    expect(JSON.stringify(storedEvent('evt-e3'))).toBe(untouched);
    expect(JSON.stringify(await publicEvents(request))).not.toContain('sp-t4');
    expect((await api('DELETE', '/api/admin/sponsors', { id: 'sp-t4' })).status).toBe(404);
    // deleting an event removes its links with it; the sponsor's own view no longer lists it
    expect((await api('DELETE', '/api/admin/events', { id: 'evt-e1' })).status).toBe(200);
    expect((await adminEvents()).some((e) => e.id === 'evt-e1')).toBe(false);
    const view = await api('PUT', '/api/admin/sponsors', { id: 'sp-t1', name: 'Satisar Travels' });
    expect('eventLinks' in (view.body ?? {})).toBe(false);
    expect((await adminEvents()).flatMap((e) => e.sponsorLinks ?? []).some((l) => l.sponsorId === 'sp-t1')).toBe(false);
    expect((await api('DELETE', '/api/admin/events', { id: 'evt-e1' })).status).toBe(404);
  });

  test('an event that has never had links is exactly what it was in the public API, and in the store after unrelated link changes', async ({ request }) => {
    const before = readStore<Event[]>('events.json');
    // what GET /api/events returned for an event before this feature: the event minus its internal sales fields
    const expected = before.map((event) => {
      const { ticketsSold: _sold, ticketRevenue: _revenue, ...rest } = event;
      return rest;
    });
    expect(await publicEvents(request)).toEqual(expected);
    // link changes that do not concern evt-e3 leave it byte for byte as it was
    const e3 = JSON.stringify(storedEvent('evt-e3'));
    await api('PUT', '/api/admin/sponsors', { id: 'sp-t1', eventLinks: [{ eventId: 'evt-e1', role: 'Sponsor' }] });
    await api('PUT', '/api/admin/events', { id: 'evt-e2', sponsorLinks: [{ sponsorId: 'sp-t2', role: 'Partner' }] });
    expect(JSON.stringify(storedEvent('evt-e3'))).toBe(e3);
    expect(((await publicEvents(request)).find((e) => e.id === 'evt-e3') as Record<string, unknown>).eventSponsors).toBeUndefined();
  });

  test('overlapping edits from both sides all land: an event edit, a reorder and eight sponsors attaching to the same event', async () => {
    const sponsors = Array.from({ length: 8 }, (_, i) => makeSponsor(`sp-c${i}`, { order: 10 + i }));
    writeSponsors([S1, S2, S3, S4, ...sponsors]);
    const requests = [
      ...sponsors.map((sponsor) => api('PUT', '/api/admin/sponsors', { id: sponsor.id, eventLinks: [{ eventId: 'evt-e1', role: 'Partner' }] })),
      api('PUT', '/api/admin/events', { id: 'evt-e2', venue: 'Concurrent Venue' }),
      api('PUT', '/api/admin/events', { id: 'evt-e3', title: 'Concurrent Title' }),
      api('POST', '/api/admin/events/reorder', { aId: 'evt-e1', bId: 'evt-e3' }),
      api('PUT', '/api/admin/events', { id: 'evt-e2', sponsorLinks: [{ sponsorId: 'sp-t1', role: 'Sponsor' }] }),
    ];
    const answers = await Promise.all(requests);
    expect(answers.map((a) => a.status)).toEqual(Array(requests.length).fill(200));
    // every attachment, the edits and the links set from the event side are all there
    expect(links('evt-e1').map((l) => l.sponsorId).sort()).toEqual(sponsors.map((s) => s.id).sort());
    expect(storedEvent('evt-e2').venue).toBe('Concurrent Venue');
    expect(links('evt-e2')).toEqual([{ sponsorId: 'sp-t1', role: 'Sponsor' }]);
    expect(storedEvent('evt-e3').title).toBe('Concurrent Title');
    const orders = readStore<Event[]>('events.json').map((e) => e.order);
    expect(new Set(orders).size).toBe(3); // the reorder applied on top of everything, never against a stale list
  });

  test('an events file that cannot be read is never replaced: both sides refuse before anything is saved, and say it is the server\'s problem', async () => {
    const good = readStoreText('events.json');
    const sponsorsBefore = readStoreText('sponsors.json');
    writeFileSync(join(DATA_DIR, 'events.json'), '{ this is not json', 'utf-8');
    // an id the seed events know: were the events checked against the seed, this would be accepted and the sponsor saved
    const seedEventId = 'evt-shrimant-damodar-pant';
    const link = await api('PUT', '/api/admin/sponsors', { id: 'sp-t1', name: 'Not Saved', eventLinks: [{ eventId: seedEventId, role: 'Sponsor' }] });
    expect(link.status).toBe(500);
    expect(String(link.body?.error)).not.toMatch(/stack|at \w+|\.ts|events\.json/i); // nothing about the server's files or code
    expect(readStoreText('sponsors.json')).toBe(sponsorsBefore);
    expect(readStoreText('events.json')).toBe('{ this is not json');
    const edit = await api('PUT', '/api/admin/events', { id: 'evt-e1', sponsorLinks: [{ sponsorId: 'sp-t1', role: 'Sponsor' }] });
    expect(edit.status).toBe(500);
    expect(edit.body).toEqual({ error: 'Failed to update event' });
    const create = await api('POST', '/api/admin/events', { title: 'Cannot Be Created', date: '2027-01-01', venue: 'v', description: 'd', category: 'c' });
    expect(create.status).toBe(500);
    expect((await api('DELETE', '/api/admin/events', { id: 'evt-e1' })).status).toBe(500);
    expect(readStoreText('events.json')).toBe('{ this is not json');
    writeFileSync(join(DATA_DIR, 'events.json'), good, 'utf-8');
    expect((await api('PUT', '/api/admin/events', { id: 'evt-e1', sponsorLinks: [{ sponsorId: 'sp-t1', role: 'Sponsor' }] })).status).toBe(200);
  });

  test('a body that is not a JSON object is refused with 400 on every events route, and the old sponsorIds list in a request is ignored', async () => {
    const before = readStoreText('events.json');
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      const sent = await page.evaluate(async (verb) => {
        const auth = await fetch('/api/admin/auth', { credentials: 'include', cache: 'no-store' });
        const { csrfToken } = (await auth.json()) as { csrfToken?: string };
        const res = await fetch('/api/admin/events', { method: verb, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ?? '' }, credentials: 'include', body: '[1,2,3]' });
        return { status: res.status, body: await res.json() };
      }, method);
      expect(sent, method).toEqual({ status: 400, body: { error: 'Invalid request' } });
    }
    // the older ids-without-roles list is not a way to attach anything any more: only sponsorLinks is
    const put = await api('PUT', '/api/admin/events', { id: 'evt-e1', sponsorIds: ['sp-t1', 'sp-t2'] });
    expect(put.status).toBe(200);
    expect(storedEvent('evt-e1').sponsorIds).toBeUndefined();
    expect('sponsorLinks' in storedEvent('evt-e1')).toBe(false);
    const post = await api('POST', '/api/admin/events', { title: 'Old Style', date: '2027-01-01', venue: 'v', description: 'd', category: 'c', sponsorIds: ['sp-t1'] });
    expect(post.status).toBe(201);
    expect('sponsorLinks' in storedEvent((post.body?.event as Event).id)).toBe(false);
    expect(readStoreText('events.json')).not.toBe(before); // (the new event was added; evt-e1 only had its updatedAt changed)
  });
});
