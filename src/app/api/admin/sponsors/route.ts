export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getEvents, getEventsStrict, getSponsors, updateSponsors, compareSponsorsForDisplay, removeSponsorFromEvents, replaceSponsorEventLinks } from '@/lib/data';
import { revalidateEvents, revalidateSponsors } from '@/lib/revalidate';
import { logAdminAction } from '@/lib/audit';
import { eventLinksOfSponsor, parseSponsorEventLinks, type SponsorEventLink } from '@/lib/event-sponsors';
import type { Sponsor } from '@/lib/data';

const NAME_MAX_LENGTH = 80;
const LABEL_MAX_LENGTH = 40;
const URL_MAX_LENGTH = 300;
const LOGO_MAX_LENGTH = 300;
const DESCRIPTION_MAX_LENGTH = 500;
const AMOUNT_MAX = 1_000_000_000;

/** Thrown from inside a locked update to abort it when the target sponsor does not exist. */
class SponsorNotFoundError extends Error {}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function invalidBody(): NextResponse {
  return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
}

function validationFailure(errors: string[]): NextResponse {
  return NextResponse.json({ error: errors.join('; '), errors }, { status: 400 });
}

function failure(err: unknown, action: string): NextResponse {
  if (err instanceof SponsorNotFoundError) {
    return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
  }
  console.error(`[api/admin/sponsors] failed to ${action} sponsor:`, err);
  return NextResponse.json({ error: `Failed to ${action} sponsor` }, { status: 500 });
}

function audit(request: NextRequest, action: string, details: Record<string, unknown>): void {
  try {
    logAdminAction('admin', action, '/api/admin/sponsors', getClientIp(request), details);
  } catch {
    /* audit must not block operation */
  }
}

/** Control characters (including newlines and tabs) have no place in a one-line label. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** Validate a free-text label such as the tier or category: trimmed, at most LABEL_MAX_LENGTH characters, no control characters; empty is allowed. */
function parseLabel(value: unknown, label: string): { value?: string; error?: string } {
  if (typeof value !== 'string') return { error: `${label} must be text` };
  const trimmed = value.trim();
  if (trimmed.length > LABEL_MAX_LENGTH) return { error: `${label} must be ${LABEL_MAX_LENGTH} characters or fewer` };
  if (CONTROL_CHARACTERS.test(trimmed)) return { error: `${label} must not contain control characters` };
  return { value: trimmed };
}

/** True when `value` parses as a URL with one of the given protocols and a host, and has no whitespace. */
function isUrlWithProtocol(value: string, protocols: readonly string[]): boolean {
  if (/\s/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return protocols.includes(parsed.protocol) && parsed.hostname !== '';
  } catch {
    return false;
  }
}

/** A path on this site: starts with a single "/" (not protocol-relative), no whitespace or backslashes. */
function isSiteRelativePath(value: string): boolean {
  return /^\/(?![/\\])[^\s\\]*$/.test(value);
}

interface SponsorInput {
  name?: string;
  companyName?: string;
  logo?: string;
  url?: string;
  tier?: string;
  category?: string;
  description?: string;
  order?: number;
  visible?: boolean;
  /** `null` clears the stored amount. */
  revenue?: number | null;
  contractValue?: number | null;
}

/**
 * Validate the fields present in `body`. Absent fields are left out of the
 * result, so the same parser serves create (all fields) and partial updates.
 */
function parseSponsorInput(body: Record<string, unknown>): { input: SponsorInput; errors: string[] } {
  const input: SponsorInput = {};
  const errors: string[] = [];

  for (const [key, label] of [['name', 'Name'], ['companyName', 'Company name']] as const) {
    const value = body[key];
    if (value === undefined) continue;
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) errors.push(`${label} is required`);
    else if (trimmed.length > NAME_MAX_LENGTH) errors.push(`${label} must be ${NAME_MAX_LENGTH} characters or fewer`);
    else input[key] = trimmed;
  }

  if (body.logo !== undefined) {
    const logo = typeof body.logo === 'string' ? body.logo.trim() : null;
    if (logo === null) errors.push('Logo must be text');
    else if (logo.length > LOGO_MAX_LENGTH) errors.push(`Logo must be ${LOGO_MAX_LENGTH} characters or fewer`);
    else if (logo !== '' && !isSiteRelativePath(logo) && !isUrlWithProtocol(logo, ['https:'])) {
      errors.push('Logo must be an uploaded file, a site path starting with / or an https:// URL');
    } else input.logo = logo;
  }

  if (body.url !== undefined) {
    const url = typeof body.url === 'string' ? body.url.trim() : null;
    if (url === null) errors.push('Website URL must be text');
    else if (url.length > URL_MAX_LENGTH) errors.push(`Website URL must be ${URL_MAX_LENGTH} characters or fewer`);
    else if (url !== '' && !isUrlWithProtocol(url, ['http:', 'https:'])) {
      errors.push('Website URL must start with http:// or https:// (for example https://example.com)');
    } else input.url = url;
  }

  if (body.tier !== undefined) {
    const tier = parseLabel(body.tier, 'Tier');
    if (tier.error) errors.push(tier.error);
    else input.tier = tier.value;
  }

  if (body.category !== undefined) {
    const category = parseLabel(body.category, 'Category');
    if (category.error) errors.push(category.error);
    else input.category = category.value;
  }

  if (body.description !== undefined) {
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    if (description === null) errors.push('Description must be text');
    else if (description.length > DESCRIPTION_MAX_LENGTH) errors.push(`Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer`);
    else input.description = description;
  }

  if (body.visible !== undefined) {
    if (typeof body.visible === 'boolean') input.visible = body.visible;
    else errors.push('Visible must be true or false');
  }

  if (body.order !== undefined) {
    if (typeof body.order === 'number' && Number.isSafeInteger(body.order) && body.order >= 0) input.order = body.order;
    else errors.push('Order must be a whole number of 0 or more');
  }

  for (const [key, label] of [['revenue', 'Revenue'], ['contractValue', 'Contract value']] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (value === null) input[key] = null;
    else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= AMOUNT_MAX) input[key] = value;
    else errors.push(`${label} must be a number between 0 and ${AMOUNT_MAX}`);
  }

  return { input, errors };
}

/**
 * Validate the events an admin attached a sponsor to (`eventLinks`: [{ eventId, role }], the whole list for this
 * sponsor): every id must be an event that exists, none may repeat, every role must be valid text. Absent means the
 * request does not touch the links. The events are read strictly: when the store cannot be read the request fails here,
 * before the sponsor is saved, instead of being checked against the seed events.
 */
async function parseEventLinks(body: Record<string, unknown>): Promise<{ links?: SponsorEventLink[]; errors: string[] }> {
  if (body.eventLinks === undefined) return { errors: [] };
  const known = new Set((await getEventsStrict()).map((event) => event.id));
  const parsed = parseSponsorEventLinks(body.eventLinks, known);
  return parsed.errors.length > 0 ? { errors: parsed.errors } : { links: parsed.links, errors: [] };
}

/**
 * Store the sponsor's links in the events (one locked write of the events store, after the sponsor itself is saved) and
 * answer with what the events now hold for it. A failure here leaves the sponsor saved: the response says so.
 */
async function applyEventLinks(sponsor: Sponsor, links: SponsorEventLink[] | undefined): Promise<{ eventLinks?: SponsorEventLink[]; changed: boolean }> {
  if (links === undefined) return { changed: false };
  const changedEventIds = await replaceSponsorEventLinks(sponsor.id, links);
  if (changedEventIds.length > 0) revalidateEvents();
  return { eventLinks: eventLinksOfSponsor(await getEvents(), sponsor.id), changed: changedEventIds.length > 0 };
}

function linksFailure(sponsor: Sponsor, err: unknown, action: string): NextResponse {
  console.error(`[api/admin/sponsors] the sponsor was ${action}, but its events could not be updated:`, err);
  return NextResponse.json(
    { error: `The sponsor was ${action}, but its events could not be updated. Open it again to retry.`, sponsor },
    { status: 500 },
  );
}

function newSponsorId(existing: Sponsor[]): string {
  const taken = new Set(existing.map((sponsor) => sponsor.id));
  const base = `sp-${Date.now()}`;
  let candidate = base;
  for (let suffix = 1; taken.has(candidate); suffix += 1) candidate = `${base}-${suffix}`;
  return candidate;
}

/** A new sponsor goes to the end of the carousel: one past the highest existing `order`. */
function nextOrder(existing: Sponsor[]): number {
  return existing.reduce((highest, sponsor) => (typeof sponsor.order === 'number' && sponsor.order > highest ? sponsor.order : highest), -1) + 1;
}

function applySponsorInput(existing: Sponsor, input: SponsorInput, now: string): Sponsor {
  const { revenue, contractValue, ...fields } = input;
  const updated: Sponsor = { ...existing, ...fields };
  if (revenue === null) delete updated.revenue;
  else if (revenue !== undefined) updated.revenue = revenue;
  if (contractValue === null) delete updated.contractValue;
  else if (contractValue !== undefined) updated.contractValue = contractValue;
  if (Object.keys(input).length > 0) updated.updatedAt = now;
  return updated;
}

export const GET = withAuth(async () => {
  try {
    const sponsors = [...(await getSponsors())].sort(compareSponsorsForDisplay);
    return NextResponse.json({ sponsors });
  } catch (err) {
    return failure(err, 'load');
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return invalidBody();

  const { input, errors } = parseSponsorInput(body);
  if (body.name === undefined) errors.unshift('Name is required');

  let eventLinks: SponsorEventLink[] | undefined;
  try {
    const parsedLinks = await parseEventLinks(body);
    errors.push(...parsedLinks.errors);
    eventLinks = parsedLinks.links;
  } catch (err) {
    return failure(err, 'create');
  }
  if (errors.length > 0 || input.name === undefined) return validationFailure(errors);
  const name = input.name;

  let sponsor: Sponsor;
  try {
    sponsor = await updateSponsors((current) => {
      const now = new Date().toISOString();
      const created: Sponsor = {
        id: newSponsorId(current),
        name,
        // Clients that predate the company-name field omit it; the name stands in.
        companyName: input.companyName ?? name,
        logo: input.logo ?? '',
        url: input.url ?? '',
        tier: input.tier ?? '',
        category: input.category ?? '',
        description: input.description ?? '',
        ...(typeof input.revenue === 'number' ? { revenue: input.revenue } : {}),
        ...(typeof input.contractValue === 'number' ? { contractValue: input.contractValue } : {}),
        order: input.order ?? nextOrder(current),
        visible: input.visible ?? true,
        updatedAt: now,
        createdAt: now,
      };
      return { sponsors: [...current, created], result: created };
    });
  } catch (err) {
    return failure(err, 'create');
  }
  revalidateSponsors();
  audit(request, 'SPONSOR_CREATE', { sponsorId: sponsor.id, name: sponsor.name });

  try {
    const applied = await applyEventLinks(sponsor, eventLinks);
    if (eventLinks) audit(request, 'SPONSOR_EVENT_LINKS', { sponsorId: sponsor.id, events: eventLinks.length, changed: applied.changed });
    return NextResponse.json({ sponsor, ...(applied.eventLinks ? { eventLinks: applied.eventLinks } : {}) }, { status: 201 });
  } catch (err) {
    return linksFailure(sponsor, err, 'created');
  }
});

/**
 * Persist a new display order in one locked write. `orderedIds` lists sponsor
 * ids top to bottom; sponsors it omits keep their relative order after them.
 * Every sponsor ends up with order = its position, which also repairs gaps and
 * duplicates left by earlier piecemeal edits.
 */
async function reorderSponsors(request: NextRequest, orderedIds: unknown): Promise<NextResponse> {
  if (
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    orderedIds.some((id) => typeof id !== 'string' || !id) ||
    new Set(orderedIds).size !== orderedIds.length
  ) {
    return validationFailure(['orderedIds must be a non-empty list of distinct sponsor ids']);
  }
  const ids = orderedIds as string[];

  try {
    const sponsors = await updateSponsors((current) => {
      const byId = new Map(current.map((sponsor) => [sponsor.id, sponsor]));
      const listed: Sponsor[] = [];
      for (const id of ids) {
        const sponsor = byId.get(id);
        if (!sponsor) throw new SponsorNotFoundError();
        listed.push(sponsor);
      }
      const listedIds = new Set(ids);
      const rest = current.filter((sponsor) => !listedIds.has(sponsor.id)).sort(compareSponsorsForDisplay);
      const now = new Date().toISOString();
      const next = [...listed, ...rest].map((sponsor, position) =>
        sponsor.order === position ? sponsor : { ...sponsor, order: position, updatedAt: now },
      );
      return { sponsors: next, result: next };
    });
    revalidateSponsors();
    audit(request, 'SPONSOR_REORDER', { count: sponsors.length });
    return NextResponse.json({ sponsors });
  } catch (err) {
    return failure(err, 'reorder');
  }
}

export const PUT = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return invalidBody();

  if (body.orderedIds !== undefined) return reorderSponsors(request, body.orderedIds);

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return validationFailure(['Sponsor id is required']);

  const { input, errors } = parseSponsorInput(body);

  let eventLinks: SponsorEventLink[] | undefined;
  try {
    const parsedLinks = await parseEventLinks(body);
    errors.push(...parsedLinks.errors);
    eventLinks = parsedLinks.links;
  } catch (err) {
    return failure(err, 'update');
  }
  if (errors.length > 0) return validationFailure(errors);

  let sponsor: Sponsor;
  try {
    sponsor = await updateSponsors((current) => {
      const index = current.findIndex((candidate) => candidate.id === id);
      if (index === -1) throw new SponsorNotFoundError();
      const updated = applySponsorInput(current[index], input, new Date().toISOString());
      const next = [...current];
      next[index] = updated;
      return { sponsors: next, result: updated };
    });
  } catch (err) {
    return failure(err, 'update');
  }
  revalidateSponsors();
  audit(request, 'SPONSOR_UPDATE', { sponsorId: sponsor.id, name: sponsor.name, fields: Object.keys(input) });

  try {
    const applied = await applyEventLinks(sponsor, eventLinks);
    if (eventLinks) audit(request, 'SPONSOR_EVENT_LINKS', { sponsorId: sponsor.id, events: eventLinks.length, changed: applied.changed });
    return NextResponse.json({ sponsor, ...(applied.eventLinks ? { eventLinks: applied.eventLinks } : {}) });
  } catch (err) {
    return linksFailure(sponsor, err, 'updated');
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return invalidBody();

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return validationFailure(['Sponsor id is required']);

  try {
    const removed = await updateSponsors((current) => {
      const target = current.find((candidate) => candidate.id === id);
      if (!target) throw new SponsorNotFoundError();
      return { sponsors: current.filter((candidate) => candidate.id !== id), result: target };
    });
    revalidateSponsors();
    audit(request, 'SPONSOR_DELETE', { sponsorId: removed.id, name: removed.name });

    // The sponsor's links go with it. Should this fail the sponsor is still gone and nothing can show it: a link to a
    // sponsor that does not exist is ignored when the pages are built and dropped the next time the event is saved.
    try {
      const changed = await removeSponsorFromEvents(removed.id);
      if (changed.length > 0) {
        revalidateEvents();
        audit(request, 'SPONSOR_EVENT_LINKS', { sponsorId: removed.id, removedFromEvents: changed.length });
      }
    } catch (err) {
      console.error('[api/admin/sponsors] the sponsor was deleted, but its links could not be removed from the events:', err);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return failure(err, 'delete');
  }
});
