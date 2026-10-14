/**
 * Which sponsors and partners an event shows, and in which role.
 *
 * ONE source of truth: the `sponsorLinks` list on the event record (an ordered list of { sponsorId, role }). The Events
 * and the Sponsors views of the admin portal both read and write it through the functions here, so they cannot
 * disagree: a link seen from a sponsor IS the entry on that event. One organisation can hold a different role on each
 * event (a sponsor of one, a partner of another, "Sponsor & Partner" of a third); within one event it appears once.
 *
 * Everything in this file is pure (no file or network access) so the rules are tested on their own and can run in the
 * browser as well as on the server. The stores, locking and atomic writes live in src/lib/data.ts (updateEvents).
 *
 * Rules:
 *  - ids are checked on every write: a link must name a sponsor (or, from the sponsor side, an event) that exists;
 *  - no duplicates: an organisation is linked to an event at most once (a repeat is refused on write, and the first
 *    occurrence wins when a hand-edited file holds one);
 *  - the role is free text of at most ROLE_MAX_LENGTH characters (suggestions: ROLE_SUGGESTIONS);
 *  - deleting an event removes its links with it; deleting a sponsor removes its links from every event
 *    (removeSponsorLinks); hiding a sponsor keeps the links but the public projection leaves it out;
 *  - a link whose sponsor no longer exists is ignored when the public page is built and dropped on the next write;
 *  - what reaches the browser is the public projection only: id, name, logo, website (https only) and role. Never the
 *    tier, revenue, contract value or description of the sponsor, and never a hidden sponsor.
 */

import type { Event, EventSponsorLink, PublicEventSponsor, Sponsor } from '@/lib/data';

/** The same limit as the sponsor's own free-text labels (tier, category). */
export const ROLE_MAX_LENGTH = 40;
/** Suggestions for the free-text role; any other text is accepted. */
export const ROLE_SUGGESTIONS = ['Sponsor', 'Partner', 'Sponsor & Partner'] as const;
export const MAX_LINKS_PER_EVENT = 100;
export const MAX_EVENTS_PER_SPONSOR = 500;

/** The ids this site generates (sp-1781332168263, evt-1791911034858, evt-some-slug-1791911034858) and nothing that could be markup or a path. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
/** Control characters (including newlines and tabs) have no place in a one-line label. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** A link seen from the sponsor's side: the event it is attached to and the role it holds there. */
export interface SponsorEventLink {
  eventId: string;
  role: string;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/** A role read from stored data: trimmed, whitespace collapsed, cut to the limit. Anything that is not text is no role. */
export function readRole(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, ROLE_MAX_LENGTH).trim() : '';
}

/**
 * The links an event holds, in display order, one per organisation. Reads `sponsorLinks`; a record that only has the
 * older `sponsorIds` list (no role) counts as links with no role. Entries without a usable id and repeats of an id are
 * left out (the first wins).
 */
export function linksOf(event: Pick<Event, 'sponsorLinks' | 'sponsorIds'>): EventSponsorLink[] {
  const raw: unknown[] = Array.isArray(event.sponsorLinks)
    ? event.sponsorLinks
    : Array.isArray(event.sponsorIds)
      ? event.sponsorIds.map((sponsorId) => ({ sponsorId, role: '' }))
      : [];
  const seen = new Set<string>();
  const links: EventSponsorLink[] = [];
  for (const entry of raw) {
    const sponsorId = entry && typeof entry === 'object' ? (entry as { sponsorId?: unknown }).sponsorId : undefined;
    if (typeof sponsorId !== 'string' || !ID_PATTERN.test(sponsorId) || seen.has(sponsorId)) continue;
    seen.add(sponsorId);
    links.push({ sponsorId, role: readRole((entry as { role?: unknown }).role) });
  }
  return links;
}

/** The same links, seen from one sponsor: every event that holds it, with the role it has there. */
export function eventLinksOfSponsor(events: readonly Event[], sponsorId: string): SponsorEventLink[] {
  const found: SponsorEventLink[] = [];
  for (const event of events) {
    const link = linksOf(event).find((candidate) => candidate.sponsorId === sponsorId);
    if (link) found.push({ eventId: event.id, role: link.role });
  }
  return found;
}

// ─── Validation of what an admin sends ───────────────────────────────────────

/** A role from an admin: text, trimmed, at most ROLE_MAX_LENGTH characters, no control characters; absent or empty means none. */
export function parseRole(value: unknown): { role?: string; error?: string } {
  if (value === undefined || value === null) return { role: '' };
  if (typeof value !== 'string') return { error: 'must be text' };
  const trimmed = value.trim();
  if (trimmed.length > ROLE_MAX_LENGTH) return { error: `must be ${ROLE_MAX_LENGTH} characters or fewer` };
  if (CONTROL_CHARACTERS.test(trimmed)) return { error: 'must not contain control characters' };
  return { role: trimmed };
}

/**
 * Validate the links an admin sends for ONE event. Every id must be a sponsor in `knownSponsorIds`, none may repeat, the
 * list is bounded and every role is valid. All problems are reported together, in words for the form.
 */
export function parseEventSponsorLinks(input: unknown, knownSponsorIds: ReadonlySet<string>): { links: EventSponsorLink[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(input)) return { links: [], errors: ['Sponsors and partners must be a list'] };
  if (input.length > MAX_LINKS_PER_EVENT) errors.push(`An event can have at most ${MAX_LINKS_PER_EVENT} sponsors and partners`);
  const seen = new Set<string>();
  const links: EventSponsorLink[] = [];
  input.slice(0, MAX_LINKS_PER_EVENT).forEach((entry, index) => {
    const place = `Sponsor or partner ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${place} must be an object with a sponsor id and a role`);
      return;
    }
    const { sponsorId, role } = entry as { sponsorId?: unknown; role?: unknown };
    if (typeof sponsorId !== 'string' || !ID_PATTERN.test(sponsorId)) {
      errors.push(`${place} needs a valid sponsor id`);
      return;
    }
    if (!knownSponsorIds.has(sponsorId)) {
      errors.push(`${place} (${sponsorId}) is not a sponsor or partner that exists`);
      return;
    }
    if (seen.has(sponsorId)) {
      errors.push(`${place} (${sponsorId}) is listed more than once`);
      return;
    }
    seen.add(sponsorId);
    const parsed = parseRole(role);
    if (parsed.error) {
      errors.push(`The role of ${place.toLowerCase()} ${parsed.error}`);
      return;
    }
    links.push({ sponsorId, role: parsed.role ?? '' });
  });
  return { links: errors.length ? [] : links, errors };
}

/** The same checks for the links an admin sends for ONE sponsor: every id must be an event in `knownEventIds`. */
export function parseSponsorEventLinks(input: unknown, knownEventIds: ReadonlySet<string>): { links: SponsorEventLink[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(input)) return { links: [], errors: ['Events must be a list'] };
  if (input.length > MAX_EVENTS_PER_SPONSOR) errors.push(`A sponsor or partner can be attached to at most ${MAX_EVENTS_PER_SPONSOR} events`);
  const seen = new Set<string>();
  const links: SponsorEventLink[] = [];
  input.slice(0, MAX_EVENTS_PER_SPONSOR).forEach((entry, index) => {
    const place = `Event ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${place} must be an object with an event id and a role`);
      return;
    }
    const { eventId, role } = entry as { eventId?: unknown; role?: unknown };
    if (typeof eventId !== 'string' || !ID_PATTERN.test(eventId)) {
      errors.push(`${place} needs a valid event id`);
      return;
    }
    if (!knownEventIds.has(eventId)) {
      errors.push(`${place} (${eventId}) is not an event that exists`);
      return;
    }
    if (seen.has(eventId)) {
      errors.push(`${place} (${eventId}) is listed more than once`);
      return;
    }
    seen.add(eventId);
    const parsed = parseRole(role);
    if (parsed.error) {
      errors.push(`The role for ${place.toLowerCase()} ${parsed.error}`);
      return;
    }
    links.push({ eventId, role: parsed.role ?? '' });
  });
  return { links: errors.length ? [] : links, errors };
}

// ─── Changing the links (pure: the caller stores the result atomically) ──────

const sameLinks = (a: readonly EventSponsorLink[], b: readonly EventSponsorLink[]): boolean =>
  a.length === b.length && a.every((link, index) => link.sponsorId === b[index].sponsorId && link.role === b[index].role);

/**
 * The event with exactly these links. An empty list removes the field, so an event without links looks exactly as it did
 * before the feature existed. The older `sponsorIds` list is dropped once links are written (one representation). Nothing
 * changes, `updatedAt` included, when the links are the ones the event already has.
 */
export function withLinks(event: Event, links: readonly EventSponsorLink[], now: string): Event {
  const current = linksOf(event);
  if (sameLinks(current, links) && Array.isArray(event.sponsorLinks) === (links.length > 0) && event.sponsorIds === undefined) return event;
  const next: Event = { ...event, updatedAt: now };
  delete next.sponsorIds;
  if (links.length > 0) next.sponsorLinks = links.map((link) => ({ sponsorId: link.sponsorId, role: link.role }));
  else delete next.sponsorLinks;
  return next;
}

/** Replace the links of one event (the event form). Other events are returned untouched. */
export function setEventLinks(events: readonly Event[], eventId: string, links: readonly EventSponsorLink[], now: string): Event[] {
  return events.map((event) => (event.id === eventId ? withLinks(event, links, now) : event));
}

/**
 * Replace every link of ONE sponsor across all events (the sponsor form): events in `desired` get the sponsor with that
 * role (appended after the others when it was not there, role updated in place when it was), events not in `desired`
 * lose it. Events whose links do not change are returned as the same objects.
 */
export function setSponsorLinks(events: readonly Event[], sponsorId: string, desired: readonly SponsorEventLink[], now: string): { events: Event[]; changedEventIds: string[] } {
  const wanted = new Map(desired.map((link) => [link.eventId, link.role]));
  const changedEventIds: string[] = [];
  const next = events.map((event) => {
    const current = linksOf(event);
    const index = current.findIndex((link) => link.sponsorId === sponsorId);
    let links: EventSponsorLink[];
    if (wanted.has(event.id)) {
      const role = wanted.get(event.id) ?? '';
      links = index === -1 ? [...current, { sponsorId, role }] : current.map((link, i) => (i === index ? { sponsorId, role } : link));
    } else {
      links = index === -1 ? current : current.filter((_, i) => i !== index);
    }
    const updated = withLinks(event, links, now);
    if (updated !== event) changedEventIds.push(event.id);
    return updated;
  });
  return { events: next, changedEventIds };
}

/** Remove a sponsor from every event that holds it (the sponsor was deleted). */
export function removeSponsorLinks(events: readonly Event[], sponsorId: string, now: string): { events: Event[]; changedEventIds: string[] } {
  return setSponsorLinks(events, sponsorId, [], now);
}

// ─── The public projection ───────────────────────────────────────────────────

/** A website the page may link to: a valid https address with a host, no credentials, no spaces. Anything else is no link. */
export function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text || text.length > 300 || /\s/.test(text)) return undefined;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'https:' || parsed.hostname === '' || parsed.username !== '' || parsed.password !== '') return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

/** A logo the page may load: empty (the name is shown instead), a path on this site, or an https address. */
export function safeLogo(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text.length > 300) return '';
  if (/^\/(?![/\\])[^\s\\]*$/.test(text)) return text;
  return safeHttpsUrl(text) ?? '';
}

/** The public face of one sponsor for one event, or null when it has no usable name. Only public fields are read. */
function publicSponsor(sponsor: Sponsor, role: string): PublicEventSponsor | null {
  const name = (sponsor.companyName ?? '').trim() || (sponsor.name ?? '').trim();
  if (!name) return null;
  const url = safeHttpsUrl(sponsor.url);
  return { id: sponsor.id, name, logo: safeLogo(sponsor.logo), ...(url ? { url } : {}), role };
}

/**
 * The organisations to show on an event page, in the admin's order: every link whose sponsor exists and is not hidden.
 * `sponsorsById` may hold hidden sponsors; they are left out here too.
 */
export function resolveEventSponsors(links: readonly EventSponsorLink[], sponsorsById: ReadonlyMap<string, Sponsor>): PublicEventSponsor[] {
  const out: PublicEventSponsor[] = [];
  for (const link of links) {
    const sponsor = sponsorsById.get(link.sponsorId);
    if (!sponsor || sponsor.visible === false) continue;
    const projected = publicSponsor(sponsor, link.role);
    if (projected) out.push(projected);
  }
  return out;
}

/** A list that already carries the public projection (the export build reads one from the live API): re-checked field by field, never trusted. */
export function readPublicEventSponsors(value: unknown): PublicEventSponsor[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: PublicEventSponsor[] = [];
  for (const entry of value.slice(0, MAX_LINKS_PER_EVENT)) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, name, logo, url, role } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !ID_PATTERN.test(id) || seen.has(id)) continue;
    if (typeof name !== 'string' || !name.trim()) continue;
    seen.add(id);
    const link = safeHttpsUrl(url);
    out.push({ id, name: name.trim().slice(0, 80), logo: safeLogo(logo), ...(link ? { url: link } : {}), role: readRole(role) });
  }
  return out;
}

/**
 * What the public page gets for an event. Built from the event's own links when it has them (the canonical store); an
 * event that carries an already-projected `eventSponsors` list instead (the data the export build fetches from the
 * public API) is read as it is, re-checked.
 */
export function publicEventSponsorsOf(event: Event, sponsorsById: ReadonlyMap<string, Sponsor>): PublicEventSponsor[] {
  if (Array.isArray(event.sponsorLinks) || Array.isArray(event.sponsorIds)) return resolveEventSponsors(linksOf(event), sponsorsById);
  return readPublicEventSponsors(event.eventSponsors);
}

/**
 * Group the organisations of an event by role for display: groups in the order each role first appears in the admin's
 * list, organisations in the admin's order inside a group. Roles match ignoring case and spacing; the first spelling is
 * the label. Organisations with no role form a group with an empty label.
 */
export function groupEventSponsorsByRole(sponsors: readonly PublicEventSponsor[]): Array<{ key: string; label: string; sponsors: PublicEventSponsor[] }> {
  const groups = new Map<string, { key: string; label: string; sponsors: PublicEventSponsor[] }>();
  for (const sponsor of sponsors) {
    const label = (sponsor.role ?? '').trim();
    const key = label.toLowerCase();
    const group = groups.get(key);
    if (group) group.sponsors.push(sponsor);
    else groups.set(key, { key, label, sponsors: [sponsor] });
  }
  return [...groups.values()];
}

/**
 * The heading over one group of the public section. It is the role as the admin typed it. When the group holds several
 * organisations, a closing "Sponsor" or "Partner" is put in the plural ("Partner" -> "Partners", "Media Partner" ->
 * "Media Partners", "Sponsor & Partner" -> "Sponsors & Partners"); any other wording is left exactly as typed. The group
 * of organisations without a role is headed "Supporters".
 */
export function roleGroupHeading(label: string, count: number): string {
  const text = label.trim();
  if (!text) return 'Supporters';
  if (count < 2) return text;
  return text.replace(/\b(?:sponsor|partner)\b/gi, (word, offset: number, whole: string) => {
    const rest = whole.slice(offset + word.length);
    const closes = rest.trim() === '' || /^\s*&\s*(?:sponsor|partner)\s*$/i.test(rest);
    if (!closes) return word;
    return word === word.toUpperCase() ? `${word}S` : `${word}s`;
  });
}
