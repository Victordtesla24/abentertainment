/**
 * Sponsors and partners on events: the model and the data layer, in-process (no server, no browser).
 *
 * The links between events and organisations live in ONE place, the `sponsorLinks` list on the event record, and are
 * read and written only through src/lib/event-sponsors.ts and the locked updates in src/lib/data.ts. These tests pin the
 * rules: validation of ids, roles and duplicates, the changes made from either side, the clean-up when a sponsor is
 * deleted or hidden, atomic and strict writes, and the public projection (public fields only, hidden sponsors never).
 *
 * Everything runs against a throw-away data directory (see support/email-unit.ts); nothing here touches the checkout.
 */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir, unitDir } from './support/email-unit';

type Model = typeof import('@/lib/event-sponsors');
type Data = typeof import('@/lib/data');
type EventRecord = import('@/lib/data').Event;
type SponsorRecord = import('@/lib/data').Sponsor;

const NOW = '2026-10-14T05:00:00.000Z';

function makeEvent(id: string, extra: Partial<EventRecord> = {}): EventRecord {
  return {
    id,
    title: `Event ${id}`,
    slug: id.replace(/^evt-/, ''),
    date: '2026-12-01',
    venue: 'Hamer Hall',
    description: 'A short description.',
    price: 50,
    currency: 'AUD',
    status: 'upcoming',
    ticketStatus: 'available',
    image: '',
    category: 'Concert',
    ticketsSold: 12,
    ticketRevenue: 600,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

function makeSponsor(id: string, extra: Partial<SponsorRecord> = {}): SponsorRecord {
  return {
    id,
    name: `Name ${id}`,
    companyName: `Company ${id}`,
    logo: `/api/uploads/sponsors/${id}.png`,
    url: `https://${id}.example.com`,
    tier: 'platinum',
    category: 'Partner',
    description: 'Internal notes that must not be public.',
    revenue: 1000,
    contractValue: 5000,
    order: 0,
    visible: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

const idsOf = (sponsors: readonly { id: string }[]) => sponsors.map((s) => s.id);

test.describe.configure({ mode: 'serial' });

test.describe('sponsors and partners on events (model and data layer)', () => {
  let model: Model;
  let data: Data;

  test.beforeAll(() => {
    loadWithUnitDir(() => {
      model = require('@/lib/event-sponsors') as Model;
      data = require('@/lib/data') as Data;
    });
  });

  test.beforeEach(() => cleanUnitDir());

  const write = (file: string, value: unknown) => writeFileSync(join(unitDir(), file), JSON.stringify(value, null, 2), 'utf-8');
  const read = <T>(file: string): T => JSON.parse(readFileSync(join(unitDir(), file), 'utf-8')) as T;
  const raw = (file: string) => readFileSync(join(unitDir(), file), 'utf-8');

  // ─── roles ────────────────────────────────────────────────────────────────

  test('a role is free text of at most 40 characters, with three suggestions', () => {
    expect(model.ROLE_SUGGESTIONS).toEqual(['Sponsor', 'Partner', 'Sponsor & Partner']);
    expect(model.ROLE_MAX_LENGTH).toBe(40);
    expect(model.parseRole(undefined)).toEqual({ role: '' });
    expect(model.parseRole(null)).toEqual({ role: '' });
    expect(model.parseRole('  Media Partner  ')).toEqual({ role: 'Media Partner' });
    expect(model.parseRole('x'.repeat(40))).toEqual({ role: 'x'.repeat(40) });
    expect(model.parseRole('x'.repeat(41))).toEqual({ error: 'must be 40 characters or fewer' });
    expect(model.parseRole('Gold\nSponsor')).toEqual({ error: 'must not contain control characters' });
    expect(model.parseRole('Tab\there')).toEqual({ error: 'must not contain control characters' });
    expect(model.parseRole(42)).toEqual({ error: 'must be text' });
    expect(model.parseRole({})).toEqual({ error: 'must be text' });
    // free text includes anything a person might type
    expect(model.parseRole('Official Food & Beverage Partner')).toEqual({ role: 'Official Food & Beverage Partner' });
    expect(model.parseRole('Sponsor <b>')).toEqual({ role: 'Sponsor <b>' }); // stored as text; every screen escapes it
    // stored data is read leniently: collapsed, trimmed, cut
    expect(model.readRole('  Co   Presenter \n')).toBe('Co Presenter');
    expect(model.readRole('y'.repeat(60))).toBe('y'.repeat(40));
    expect(model.readRole(7)).toBe('');
  });

  // ─── reading ──────────────────────────────────────────────────────────────

  test('the links of an event: sponsorLinks first, the older sponsorIds as links without a role, repeats and bad ids dropped', () => {
    expect(model.linksOf(makeEvent('evt-a'))).toEqual([]);
    expect(model.linksOf(makeEvent('evt-a', { sponsorLinks: [{ sponsorId: 'sp-1', role: 'Sponsor' }, { sponsorId: 'sp-2', role: 'Partner' }] }))).toEqual([
      { sponsorId: 'sp-1', role: 'Sponsor' },
      { sponsorId: 'sp-2', role: 'Partner' },
    ]);
    // the older list is read as links with no role
    expect(model.linksOf(makeEvent('evt-a', { sponsorIds: ['sp-1', 'sp-2'] }))).toEqual([
      { sponsorId: 'sp-1', role: '' },
      { sponsorId: 'sp-2', role: '' },
    ]);
    // sponsorLinks wins when both exist
    expect(model.linksOf(makeEvent('evt-a', { sponsorIds: ['sp-9'], sponsorLinks: [{ sponsorId: 'sp-1', role: 'Partner' }] }))).toEqual([{ sponsorId: 'sp-1', role: 'Partner' }]);
    // hand-edited data: a repeat keeps its first place and role; entries without a usable id are ignored
    const messy = [
      { sponsorId: 'sp-1', role: 'First' },
      { sponsorId: 'sp-2', role: 7 },
      { sponsorId: 'sp-1', role: 'Second' },
      { sponsorId: '' },
      { sponsorId: '../etc/passwd', role: 'x' },
      { sponsorId: 42 },
      null,
      'sp-3',
    ] as unknown as EventRecord['sponsorLinks'];
    expect(model.linksOf(makeEvent('evt-a', { sponsorLinks: messy }))).toEqual([
      { sponsorId: 'sp-1', role: 'First' },
      { sponsorId: 'sp-2', role: '' },
    ]);
    expect(model.linksOf(makeEvent('evt-a', { sponsorLinks: 'not a list' as unknown as EventRecord['sponsorLinks'] }))).toEqual([]);
  });

  test('the same links seen from one sponsor: every event that holds it, with its role there', () => {
    const events = [
      makeEvent('evt-1', { sponsorLinks: [{ sponsorId: 'sp-a', role: 'Sponsor' }, { sponsorId: 'sp-b', role: 'Partner' }] }),
      makeEvent('evt-2'),
      makeEvent('evt-3', { sponsorLinks: [{ sponsorId: 'sp-b', role: 'Sponsor & Partner' }] }),
    ];
    expect(model.eventLinksOfSponsor(events, 'sp-b')).toEqual([{ eventId: 'evt-1', role: 'Partner' }, { eventId: 'evt-3', role: 'Sponsor & Partner' }]);
    expect(model.eventLinksOfSponsor(events, 'sp-a')).toEqual([{ eventId: 'evt-1', role: 'Sponsor' }]);
    expect(model.eventLinksOfSponsor(events, 'sp-none')).toEqual([]);
  });

  // ─── validation ───────────────────────────────────────────────────────────

  test('what an admin sends for one event is validated: ids must exist, nothing repeats, roles are text, all problems come back together', () => {
    const known = new Set(['sp-1', 'sp-2', 'sp-3']);
    expect(model.parseEventSponsorLinks([], known)).toEqual({ links: [], errors: [] });
    expect(model.parseEventSponsorLinks([{ sponsorId: 'sp-2', role: 'Partner' }, { sponsorId: 'sp-1' }], known)).toEqual({
      links: [{ sponsorId: 'sp-2', role: 'Partner' }, { sponsorId: 'sp-1', role: '' }],
      errors: [],
    });
    // not a list
    expect(model.parseEventSponsorLinks('sp-1', known).errors).toEqual(['Sponsors and partners must be a list']);
    expect(model.parseEventSponsorLinks({ sponsorId: 'sp-1' }, known).errors).toEqual(['Sponsors and partners must be a list']);
    expect(model.parseEventSponsorLinks(null, known).errors).toEqual(['Sponsors and partners must be a list']);
    // an id that does not exist, an entry that is not an object, a missing or unsafe id
    expect(model.parseEventSponsorLinks([{ sponsorId: 'sp-404', role: 'Sponsor' }], known).errors).toEqual(['Sponsor or partner 1 (sp-404) is not a sponsor or partner that exists']);
    expect(model.parseEventSponsorLinks(['sp-1'], known).errors).toEqual(['Sponsor or partner 1 must be an object with a sponsor id and a role']);
    expect(model.parseEventSponsorLinks([null], known).errors).toEqual(['Sponsor or partner 1 must be an object with a sponsor id and a role']);
    expect(model.parseEventSponsorLinks([{ role: 'Sponsor' }], known).errors).toEqual(['Sponsor or partner 1 needs a valid sponsor id']);
    expect(model.parseEventSponsorLinks([{ sponsorId: '../x' }], known).errors).toEqual(['Sponsor or partner 1 needs a valid sponsor id']);
    expect(model.parseEventSponsorLinks([{ sponsorId: 7 }], known).errors).toEqual(['Sponsor or partner 1 needs a valid sponsor id']);
    // no duplicates
    expect(model.parseEventSponsorLinks([{ sponsorId: 'sp-1' }, { sponsorId: 'sp-2' }, { sponsorId: 'sp-1', role: 'Partner' }], known).errors).toEqual(['Sponsor or partner 3 (sp-1) is listed more than once']);
    // role problems name the entry
    expect(model.parseEventSponsorLinks([{ sponsorId: 'sp-1', role: 'x'.repeat(41) }], known).errors).toEqual(['The role of sponsor or partner 1 must be 40 characters or fewer']);
    expect(model.parseEventSponsorLinks([{ sponsorId: 'sp-1', role: 5 }], known).errors).toEqual(['The role of sponsor or partner 1 must be text']);
    // several problems at once, in order, and no links are returned when there is any
    const several = model.parseEventSponsorLinks([{ sponsorId: 'sp-404' }, { sponsorId: 'sp-1', role: 'a\nb' }, { sponsorId: 'sp-2' }], known);
    expect(several.errors).toEqual(['Sponsor or partner 1 (sp-404) is not a sponsor or partner that exists', 'The role of sponsor or partner 2 must not contain control characters']);
    expect(several.links).toEqual([]);
    // bounded
    const many = Array.from({ length: 101 }, (_, i) => ({ sponsorId: `sp-${i}` }));
    expect(model.parseEventSponsorLinks(many, new Set(many.map((m) => m.sponsorId))).errors).toEqual(['An event can have at most 100 sponsors and partners']);
    const exactly = Array.from({ length: 100 }, (_, i) => ({ sponsorId: `sp-${i}` }));
    expect(model.parseEventSponsorLinks(exactly, new Set(exactly.map((m) => m.sponsorId))).errors).toEqual([]);
  });

  test('what an admin sends for one sponsor is validated the same way: events must exist, nothing repeats', () => {
    const known = new Set(['evt-1', 'evt-2']);
    expect(model.parseSponsorEventLinks([{ eventId: 'evt-2', role: 'Partner' }], known)).toEqual({ links: [{ eventId: 'evt-2', role: 'Partner' }], errors: [] });
    expect(model.parseSponsorEventLinks('evt-1', known).errors).toEqual(['Events must be a list']);
    expect(model.parseSponsorEventLinks([{ eventId: 'evt-404' }], known).errors).toEqual(['Event 1 (evt-404) is not an event that exists']);
    expect(model.parseSponsorEventLinks([{ eventId: 'evt-1' }, { eventId: 'evt-1' }], known).errors).toEqual(['Event 2 (evt-1) is listed more than once']);
    expect(model.parseSponsorEventLinks([{ eventId: 'evt-1', role: 'q'.repeat(41) }], known).errors).toEqual(['The role for event 1 must be 40 characters or fewer']);
    expect(model.parseSponsorEventLinks([{ role: 'Sponsor' }], known).errors).toEqual(['Event 1 needs a valid event id']);
    expect(model.parseSponsorEventLinks([42], known).errors).toEqual(['Event 1 must be an object with an event id and a role']);
  });

  // ─── changing links (pure) ────────────────────────────────────────────────

  test('the links of one event are replaced as a whole; an event without links carries no field at all', () => {
    const plain = makeEvent('evt-a');
    // nothing to change: the very same object comes back, updatedAt untouched
    expect(model.withLinks(plain, [], NOW)).toBe(plain);
    const linked = model.withLinks(plain, [{ sponsorId: 'sp-1', role: 'Sponsor' }, { sponsorId: 'sp-2', role: 'Partner' }], NOW);
    expect(linked.sponsorLinks).toEqual([{ sponsorId: 'sp-1', role: 'Sponsor' }, { sponsorId: 'sp-2', role: 'Partner' }]);
    expect(linked.updatedAt).toBe(NOW);
    expect(linked).toMatchObject({ id: 'evt-a', title: 'Event evt-a', ticketsSold: 12 }); // everything else is as it was
    expect(plain.sponsorLinks).toBeUndefined(); // the input is never modified
    // the same links again: no change
    expect(model.withLinks(linked, [{ sponsorId: 'sp-1', role: 'Sponsor' }, { sponsorId: 'sp-2', role: 'Partner' }], '2027-01-01T00:00:00.000Z')).toBe(linked);
    // a new order, or a new role, is a change
    expect(model.withLinks(linked, [{ sponsorId: 'sp-2', role: 'Partner' }, { sponsorId: 'sp-1', role: 'Sponsor' }], NOW).sponsorLinks?.map((l) => l.sponsorId)).toEqual(['sp-2', 'sp-1']);
    expect(model.withLinks(linked, [{ sponsorId: 'sp-1', role: 'Sponsor & Partner' }, { sponsorId: 'sp-2', role: 'Partner' }], NOW).sponsorLinks?.[0].role).toBe('Sponsor & Partner');
    // emptying the list removes the field, so the record looks as it did before the feature
    const emptied = model.withLinks(linked, [], NOW);
    expect('sponsorLinks' in emptied).toBe(false);
    expect(Object.keys(emptied).sort()).toEqual(Object.keys({ ...plain, updatedAt: NOW }).sort());
    // the older list is replaced by the new representation on the first write
    const legacy = makeEvent('evt-b', { sponsorIds: ['sp-1'] });
    const converted = model.withLinks(legacy, [{ sponsorId: 'sp-1', role: '' }], NOW);
    expect(converted.sponsorLinks).toEqual([{ sponsorId: 'sp-1', role: '' }]);
    expect('sponsorIds' in converted).toBe(false);
    // setEventLinks touches only the named event
    const list = [plain, makeEvent('evt-c')];
    const after = model.setEventLinks(list, 'evt-c', [{ sponsorId: 'sp-1', role: 'Sponsor' }], NOW);
    expect(after[0]).toBe(plain);
    expect(after[1].sponsorLinks).toEqual([{ sponsorId: 'sp-1', role: 'Sponsor' }]);
  });

  test('from the sponsor side: attach, change the role in place, detach; other sponsors and untouched events are left exactly as they were', () => {
    const e1 = makeEvent('evt-1', { sponsorLinks: [{ sponsorId: 'sp-other', role: 'Sponsor' }, { sponsorId: 'sp-a', role: 'Partner' }] });
    const e2 = makeEvent('evt-2');
    const e3 = makeEvent('evt-3', { sponsorLinks: [{ sponsorId: 'sp-a', role: 'Sponsor' }] });
    const e4 = makeEvent('evt-4', { sponsorLinks: [{ sponsorId: 'sp-other', role: 'Partner' }] });
    const result = model.setSponsorLinks([e1, e2, e3, e4], 'sp-a', [{ eventId: 'evt-1', role: 'Sponsor & Partner' }, { eventId: 'evt-2', role: 'Sponsor' }], NOW);
    // e1: the role changes in place (its position is kept); e2: attached at the end; e3: detached; e4: untouched
    expect(result.events[0].sponsorLinks).toEqual([{ sponsorId: 'sp-other', role: 'Sponsor' }, { sponsorId: 'sp-a', role: 'Sponsor & Partner' }]);
    expect(result.events[1].sponsorLinks).toEqual([{ sponsorId: 'sp-a', role: 'Sponsor' }]);
    expect('sponsorLinks' in result.events[2]).toBe(false);
    expect(result.events[3]).toBe(e4);
    expect(result.changedEventIds).toEqual(['evt-1', 'evt-2', 'evt-3']);
    expect(result.events.slice(0, 3).every((e) => e.updatedAt === NOW)).toBe(true);
    // asking for what is already there changes nothing
    const again = model.setSponsorLinks(result.events, 'sp-a', [{ eventId: 'evt-1', role: 'Sponsor & Partner' }, { eventId: 'evt-2', role: 'Sponsor' }], '2027-01-01T00:00:00.000Z');
    expect(again.changedEventIds).toEqual([]);
    again.events.forEach((event, index) => expect(event).toBe(result.events[index]));
    // the same organisation with a different role on different events (sponsor of one, partner of another, both of a third)
    const roles = model.setSponsorLinks([makeEvent('evt-x'), makeEvent('evt-y'), makeEvent('evt-z')], 'sp-a', [
      { eventId: 'evt-x', role: 'Sponsor' },
      { eventId: 'evt-y', role: 'Partner' },
      { eventId: 'evt-z', role: 'Sponsor & Partner' },
    ], NOW);
    expect(roles.events.map((e) => e.sponsorLinks?.[0].role)).toEqual(['Sponsor', 'Partner', 'Sponsor & Partner']);
  });

  test('deleting a sponsor removes it from every event that holds it and nothing else', () => {
    const e1 = makeEvent('evt-1', { sponsorLinks: [{ sponsorId: 'sp-a', role: 'Sponsor' }, { sponsorId: 'sp-b', role: 'Partner' }] });
    const e2 = makeEvent('evt-2', { sponsorLinks: [{ sponsorId: 'sp-a', role: 'Partner' }] });
    const e3 = makeEvent('evt-3');
    const result = model.removeSponsorLinks([e1, e2, e3], 'sp-a', NOW);
    expect(result.changedEventIds).toEqual(['evt-1', 'evt-2']);
    expect(result.events[0].sponsorLinks).toEqual([{ sponsorId: 'sp-b', role: 'Partner' }]);
    expect('sponsorLinks' in result.events[1]).toBe(false); // the last link gone: the field is gone
    expect(result.events[2]).toBe(e3);
    expect(model.removeSponsorLinks([e1, e2, e3], 'sp-none', NOW).changedEventIds).toEqual([]);
  });

  // ─── the public projection ────────────────────────────────────────────────

  test('what the public page gets: public fields only, in the admin\'s order, hidden and missing sponsors left out, https links only', () => {
    const sponsors = new Map<string, SponsorRecord>([
      ['sp-1', makeSponsor('sp-1', { name: 'Food Core', companyName: '  Food Core Marketing Pty Ltd ' })],
      ['sp-2', makeSponsor('sp-2', { companyName: undefined, name: ' Curry Leaf ', url: 'http://curry.example.com' })],
      ['sp-3', makeSponsor('sp-3', { visible: false })],
      ['sp-4', makeSponsor('sp-4', { url: 'javascript:alert(1)', logo: 'javascript:alert(1)' })],
      ['sp-5', makeSponsor('sp-5', { url: 'https://user:pass@secret.example.com', logo: '//evil.example/x.png' })],
      ['sp-6', makeSponsor('sp-6', { url: 'https://has space.example.com', logo: '' })],
      ['sp-7', makeSponsor('sp-7', { name: '   ', companyName: '' })],
      ['sp-8', makeSponsor('sp-8', { url: ' https://Real.Example.com/path?q=1 ', logo: 'https://cdn.example.com/logo.png' })],
    ]);
    const links = ['sp-8', 'sp-1', 'sp-404', 'sp-3', 'sp-2', 'sp-4', 'sp-5', 'sp-6', 'sp-7'].map((sponsorId, i) => ({ sponsorId, role: i % 2 ? 'Partner' : 'Sponsor' }));
    const out = model.resolveEventSponsors(links, sponsors);
    expect(idsOf(out)).toEqual(['sp-8', 'sp-1', 'sp-2', 'sp-4', 'sp-5', 'sp-6']); // the admin's order; hidden (3), missing (404) and nameless (7) are out
    const byId = Object.fromEntries(out.map((s) => [s.id, s]));
    expect(byId['sp-1']).toEqual({ id: 'sp-1', name: 'Food Core Marketing Pty Ltd', logo: '/api/uploads/sponsors/sp-1.png', url: 'https://sp-1.example.com/', role: 'Partner' });
    expect(byId['sp-2'].name).toBe('Curry Leaf'); // no company name: the display name
    expect('url' in byId['sp-2']).toBe(false); // http is not a link
    expect(byId['sp-4']).toEqual({ id: 'sp-4', name: 'Company sp-4', logo: '', role: 'Partner' }); // no script URL anywhere
    expect(byId['sp-5']).toEqual({ id: 'sp-5', name: 'Company sp-5', logo: '', role: 'Sponsor' }); // credentials and protocol-relative logos refused
    expect(byId['sp-6'].logo).toBe('');
    expect('url' in byId['sp-6']).toBe(false);
    expect(byId['sp-8']).toEqual({ id: 'sp-8', name: 'Company sp-8', logo: 'https://cdn.example.com/logo.png', url: 'https://real.example.com/path?q=1', role: 'Sponsor' });
    // never anything but the five public fields, whatever the sponsor record holds
    for (const sponsor of out) expect(Object.keys(sponsor).every((key) => ['id', 'name', 'logo', 'url', 'role'].includes(key))).toBe(true);
    const text = JSON.stringify(out);
    for (const secret of ['platinum', 'Internal notes', '1000', '5000', 'tier', 'revenue', 'contractValue', 'description']) expect(text).not.toContain(secret);
  });

  test('a list that already carries the public projection (the export build reads one from the live API) is re-checked field by field', () => {
    const carried = [
      { id: 'sp-1', name: ' Food Core ', logo: '/api/uploads/sponsors/a.png', url: 'https://food.example.com', role: ' Sponsor ', tier: 'platinum', revenue: 5, contractValue: 9, description: 'secret' },
      { id: 'sp-1', name: 'Repeat', logo: '', role: '' },
      { id: 'sp-2', name: 'Plain', logo: 'javascript:alert(1)', url: 'javascript:alert(1)', role: 'Partner' },
      { id: '../x', name: 'Bad id', logo: '', role: '' },
      { id: 'sp-3', name: '   ', logo: '', role: '' },
      'not an object',
      null,
    ];
    const out = model.readPublicEventSponsors(carried);
    expect(out).toEqual([
      { id: 'sp-1', name: 'Food Core', logo: '/api/uploads/sponsors/a.png', url: 'https://food.example.com/', role: 'Sponsor' },
      { id: 'sp-2', name: 'Plain', logo: '', role: 'Partner' },
    ]);
    expect(model.readPublicEventSponsors(undefined)).toEqual([]);
    expect(model.readPublicEventSponsors('x')).toEqual([]);
    // an event with its own links is resolved from them; one that only carries a projection keeps that
    const sponsors = new Map([['sp-1', makeSponsor('sp-1')]]);
    const withLinks = makeEvent('evt-a', { sponsorLinks: [{ sponsorId: 'sp-1', role: 'Partner' }], eventSponsors: [{ id: 'zz', name: 'Stale', logo: '', role: '' }] });
    expect(idsOf(model.publicEventSponsorsOf(withLinks, sponsors))).toEqual(['sp-1']);
    const carriedOnly = makeEvent('evt-b', { eventSponsors: [{ id: 'sp-2', name: 'From the API', logo: '', role: 'Sponsor' }] });
    expect(idsOf(model.publicEventSponsorsOf(carriedOnly, sponsors))).toEqual(['sp-2']);
    expect(model.publicEventSponsorsOf(makeEvent('evt-c'), sponsors)).toEqual([]);
  });

  test('grouping by role: groups in the order each role first appears, organisations in the admin\'s order, case and spacing ignored', () => {
    const mk = (id: string, role: string) => ({ id, name: id, logo: '', role });
    const groups = model.groupEventSponsorsByRole([mk('a', 'Partner'), mk('b', 'Sponsor'), mk('c', 'partner '), mk('d', ''), mk('e', 'Sponsor'), mk('f', '')]);
    expect(groups.map((g) => [g.label, idsOf(g.sponsors)])).toEqual([
      ['Partner', ['a', 'c']],
      ['Sponsor', ['b', 'e']],
      ['', ['d', 'f']],
    ]);
    expect(model.groupEventSponsorsByRole([])).toEqual([]);
    expect(model.safeHttpsUrl('https://example.com')).toBe('https://example.com/');
    expect(model.safeHttpsUrl('http://example.com')).toBeUndefined();
    expect(model.safeHttpsUrl('')).toBeUndefined();
    expect(model.safeHttpsUrl(undefined)).toBeUndefined();
    expect(model.safeHttpsUrl(`https://example.com/${'a'.repeat(300)}`)).toBeUndefined();
    expect(model.safeLogo('/images/x.png')).toBe('/images/x.png');
    expect(model.safeLogo('//evil.example/x.png')).toBe('');
    expect(model.safeLogo('/a b.png')).toBe('');
    expect(model.safeLogo('data:image/png;base64,AAAA')).toBe('');
  });

  test('the heading over a group: the role as typed, a closing Sponsor or Partner in the plural for several organisations, "Supporters" for no role', () => {
    expect(model.roleGroupHeading('Sponsor', 1)).toBe('Sponsor');
    expect(model.roleGroupHeading('Sponsor', 3)).toBe('Sponsors');
    expect(model.roleGroupHeading('Partner', 2)).toBe('Partners');
    expect(model.roleGroupHeading('Sponsor & Partner', 1)).toBe('Sponsor & Partner');
    expect(model.roleGroupHeading('Sponsor & Partner', 2)).toBe('Sponsors & Partners');
    expect(model.roleGroupHeading('Media Partner', 4)).toBe('Media Partners');
    expect(model.roleGroupHeading('Title Sponsor', 2)).toBe('Title Sponsors');
    expect(model.roleGroupHeading('SPONSOR', 2)).toBe('SPONSORS');
    expect(model.roleGroupHeading('Official Sponsor of the Night', 2)).toBe('Official Sponsor of the Night'); // not a closing word
    expect(model.roleGroupHeading('Sponsors', 2)).toBe('Sponsors'); // already plural
    expect(model.roleGroupHeading('Presented by', 5)).toBe('Presented by');
    expect(model.roleGroupHeading('  Co-Presenter ', 2)).toBe('Co-Presenter');
    expect(model.roleGroupHeading('', 3)).toBe('Supporters');
    expect(model.roleGroupHeading('   ', 1)).toBe('Supporters');
  });

  // ─── the data layer ───────────────────────────────────────────────────────

  test('updateEvents: overlapping updates both land, nothing is written when nothing changes, and an unreadable file is never replaced', async () => {
    write('events.json', [makeEvent('evt-1'), makeEvent('evt-2')]);
    // fifty overlapping changes, each reading the list the one before wrote: none is lost
    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        data.updateEvents((events) => ({ events: events.map((e) => (e.id === 'evt-1' ? { ...e, capacity: (e.capacity ?? 0) + 1 } : e)), result: i })),
      ),
    );
    expect(read<EventRecord[]>('events.json').find((e) => e.id === 'evt-1')?.capacity).toBe(50);
    // a mutation that returns no events writes nothing
    const before = raw('events.json');
    const mtime = statSync(join(unitDir(), 'events.json')).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await data.updateEvents(() => ({ result: 'untouched' }))).toBe('untouched');
    expect(raw('events.json')).toBe(before);
    expect(statSync(join(unitDir(), 'events.json')).mtimeMs).toBe(mtime);
    // a mutation that throws aborts without writing, and the next update still works
    await expect(data.updateEvents(() => { throw new Error('abort'); })).rejects.toThrow('abort');
    expect(raw('events.json')).toBe(before);
    await data.updateEvents((events) => ({ events: events.map((e) => ({ ...e, venue: 'Somewhere' })), result: null }));
    expect(read<EventRecord[]>('events.json').every((e) => e.venue === 'Somewhere')).toBe(true);
    // a file that exists but cannot be read is not replaced by the seed events, and neither is one that is not a list
    writeFileSync(join(unitDir(), 'events.json'), '{ this is not json', 'utf-8');
    await expect(data.updateEvents((events) => ({ events, result: null }))).rejects.toThrow();
    expect(raw('events.json')).toBe('{ this is not json');
    writeFileSync(join(unitDir(), 'events.json'), '{"not":"a list"}', 'utf-8');
    await expect(data.updateEvents((events) => ({ events, result: null }))).rejects.toThrow('does not hold a list');
    expect(raw('events.json')).toBe('{"not":"a list"}');
  });

  test('getEventsStrict: the seed events when there is no file yet, an error for a file that cannot be read or is not a list', async () => {
    // no file (first run): the seed events, as getEvents serves them
    expect((await data.getEventsStrict()).length).toBeGreaterThan(0);
    expect((await data.getEventsStrict()).map((e) => e.id)).toEqual((await data.getEvents()).map((e) => e.id));
    write('events.json', [makeEvent('evt-1')]);
    expect((await data.getEventsStrict()).map((e) => e.id)).toEqual(['evt-1']);
    writeFileSync(join(unitDir(), 'events.json'), '{ not json', 'utf-8');
    await expect(data.getEventsStrict()).rejects.toThrow();
    expect((await data.getEvents()).length).toBeGreaterThan(1); // the lenient read still serves the seed, as pages always did
    writeFileSync(join(unitDir(), 'events.json'), '{"a":1}', 'utf-8');
    await expect(data.getEventsStrict()).rejects.toThrow('does not hold a list');
  });

  test('deleting a sponsor takes it off every event in ONE write; events that never held it keep their exact stored text', async () => {
    const plain = makeEvent('evt-plain');
    const held = makeEvent('evt-held', { sponsorLinks: [{ sponsorId: 'sp-a', role: 'Sponsor' }, { sponsorId: 'sp-b', role: 'Partner' }] });
    const only = makeEvent('evt-only', { sponsorLinks: [{ sponsorId: 'sp-a', role: 'Partner' }] });
    write('events.json', [plain, held, only]);
    const changed = await data.removeSponsorFromEvents('sp-a');
    expect(changed).toEqual(['evt-held', 'evt-only']);
    const after = read<EventRecord[]>('events.json');
    expect(after.find((e) => e.id === 'evt-held')?.sponsorLinks).toEqual([{ sponsorId: 'sp-b', role: 'Partner' }]);
    expect('sponsorLinks' in (after.find((e) => e.id === 'evt-only') as object)).toBe(false);
    expect(after.find((e) => e.id === 'evt-plain')).toEqual(plain); // not one field of it changed
    // a sponsor nobody holds: nothing is written at all
    const snapshot = raw('events.json');
    const stamp = statSync(join(unitDir(), 'events.json')).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await data.removeSponsorFromEvents('sp-nobody')).toEqual([]);
    expect(raw('events.json')).toBe(snapshot);
    expect(statSync(join(unitDir(), 'events.json')).mtimeMs).toBe(stamp);
  });

  test('replacing one sponsor\'s events changes only those events, and the public mirror never carries a link', async () => {
    write('events.json', [makeEvent('evt-1'), makeEvent('evt-2', { sponsorLinks: [{ sponsorId: 'sp-a', role: 'Partner' }] }), makeEvent('evt-3')]);
    const changed = await data.replaceSponsorEventLinks('sp-a', [{ eventId: 'evt-1', role: 'Sponsor' }, { eventId: 'evt-2', role: 'Partner' }]);
    expect(changed).toEqual(['evt-1']);
    const stored = read<EventRecord[]>('events.json');
    expect(stored.map((e) => e.sponsorLinks?.map((l) => `${l.sponsorId}:${l.role}`) ?? null)).toEqual([['sp-a:Sponsor'], ['sp-a:Partner'], null]);
    // the copy that is mirrored for the public site has no sponsor links, no ids, no ticket sales
    const mirror = JSON.parse(readFileSync(join(unitDir(), 'repo-root', 'public', 'data', 'events.json'), 'utf-8')) as Array<Record<string, unknown>>;
    expect(mirror).toHaveLength(3);
    for (const event of mirror) {
      for (const field of ['sponsorLinks', 'sponsorIds', 'eventSponsors', 'ticketsSold', 'ticketRevenue']) expect(field in event).toBe(false);
    }
  });

  test('the public projections: the listing is unchanged, the event page and the API get the visible organisations, never anything internal', async () => {
    const sponsors = [
      makeSponsor('sp-1', { order: 0 }),
      makeSponsor('sp-2', { order: 1, visible: false }),
      makeSponsor('sp-3', { order: 2, companyName: 'Three Pty Ltd', url: '' }),
    ];
    const plain = makeEvent('evt-plain');
    const linked = makeEvent('evt-linked', {
      slug: 'linked',
      sponsorLinks: [{ sponsorId: 'sp-3', role: 'Partner' }, { sponsorId: 'sp-2', role: 'Sponsor' }, { sponsorId: 'sp-gone', role: 'Sponsor' }, { sponsorId: 'sp-1', role: 'Sponsor & Partner' }],
    });
    write('sponsors.json', sponsors);
    write('events.json', [plain, linked]);

    // the listing pages: no sponsor data at all, whatever links exist
    const listing = await data.getPublicEvents();
    for (const event of listing) {
      for (const field of ['sponsorLinks', 'sponsorIds', 'eventSponsors', 'ticketsSold', 'ticketRevenue']) expect(field in event).toBe(false);
    }
    // the detail projection (the API and the event page)
    const details = await data.getPublicEventDetails();
    const detailPlain = details.find((e) => e.id === 'evt-plain') as EventRecord;
    const detailLinked = details.find((e) => e.id === 'evt-linked') as EventRecord;
    expect('eventSponsors' in detailPlain).toBe(false); // an event without any is exactly what it was
    expect(detailPlain).toEqual(listing.find((e) => e.id === 'evt-plain'));
    expect(detailLinked.eventSponsors).toEqual([
      { id: 'sp-3', name: 'Three Pty Ltd', logo: '/api/uploads/sponsors/sp-3.png', role: 'Partner' }, // no url: nothing to link to
      { id: 'sp-1', name: 'Company sp-1', logo: '/api/uploads/sponsors/sp-1.png', url: 'https://sp-1.example.com/', role: 'Sponsor & Partner' },
    ]); // sp-2 is hidden and sp-gone does not exist: neither appears, in the admin's order otherwise
    for (const field of ['sponsorLinks', 'sponsorIds', 'ticketsSold', 'ticketRevenue']) expect(field in detailLinked).toBe(false);
    const wire = JSON.stringify(details);
    for (const secret of ['platinum', 'Internal notes', 'revenue', 'contractValue', 'sp-2', 'sp-gone', 'tier', 'description":"Internal']) expect(wire).not.toContain(secret);
    // the event page by slug
    const page = await data.getPublicEventBySlug('linked');
    expect(page?.eventSponsors?.map((s) => s.id)).toEqual(['sp-3', 'sp-1']);
    expect(await data.getPublicEventBySlug('nothing-here')).toBeNull();
    // hiding the sponsor takes it off the page at once (the link stays); showing it brings it back in the same place
    write('sponsors.json', sponsors.map((s) => (s.id === 'sp-1' ? { ...s, visible: false } : s)));
    expect((await data.getPublicEventBySlug('linked'))?.eventSponsors?.map((s) => s.id)).toEqual(['sp-3']);
    expect(read<EventRecord[]>('events.json').find((e) => e.id === 'evt-linked')?.sponsorLinks).toHaveLength(4);
    write('sponsors.json', sponsors.map((s) => (s.id === 'sp-2' ? { ...s, visible: true } : s)));
    expect((await data.getPublicEventBySlug('linked'))?.eventSponsors?.map((s) => s.id)).toEqual(['sp-3', 'sp-2', 'sp-1']);
    // deleting the sponsor from the store: ignored on the page even before the links are cleaned up
    write('sponsors.json', sponsors.filter((s) => s.id !== 'sp-3'));
    expect((await data.getPublicEventBySlug('linked'))?.eventSponsors?.map((s) => s.id)).toEqual(['sp-1']);
    // an event with only the older sponsorIds list shows them (no role)
    write('events.json', [makeEvent('evt-old', { slug: 'old', sponsorIds: ['sp-1'] })]);
    expect((await data.getPublicEventBySlug('old'))?.eventSponsors).toEqual([{ id: 'sp-1', name: 'Company sp-1', logo: '/api/uploads/sponsors/sp-1.png', url: 'https://sp-1.example.com/', role: '' }]);
  });

  test('the export build\'s copy: an event that already carries eventSponsors keeps them on its page, and nothing else sees them', async () => {
    // data/events.json in the export build holds what GET /api/events returned
    write('sponsors.json', [makeSponsor('sp-1')]);
    write('events.json', [makeEvent('evt-a', { slug: 'a', eventSponsors: [{ id: 'sp-9', name: 'Carried', logo: '', role: 'Partner' }] }), makeEvent('evt-b', { slug: 'b' })]);
    expect((await data.getPublicEventBySlug('a'))?.eventSponsors).toEqual([{ id: 'sp-9', name: 'Carried', logo: '', role: 'Partner' }]);
    expect('eventSponsors' in ((await data.getPublicEventBySlug('b')) as object)).toBe(false);
    for (const event of await data.getPublicEvents()) expect('eventSponsors' in event).toBe(false);
    // the gallery page, the sitemap and the rest read getEvents: the pinned organisations are for the event page alone
    const everything = await data.getEvents();
    expect(everything.map((event) => event.id)).toEqual(['evt-a', 'evt-b']);
    for (const event of everything) expect('eventSponsors' in event).toBe(false);
  });

  test('an event record that has never had links is byte-for-byte what it was after an unrelated change elsewhere', async () => {
    const original = [makeEvent('evt-1'), makeEvent('evt-2', { hook: 'A hook', cast: 'Cast list' })];
    write('events.json', original);
    // neither a sponsor delete nor a link change that does not concern them rewrites these events
    await data.removeSponsorFromEvents('sp-x');
    await data.replaceSponsorEventLinks('sp-x', []);
    expect(existsSync(join(unitDir(), 'events.json'))).toBe(true);
    expect(read<EventRecord[]>('events.json')).toEqual(original);
    expect(raw('events.json')).toBe(JSON.stringify(original, null, 2));
  });
});
