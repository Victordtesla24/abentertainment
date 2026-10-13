/**
 * Admin-internal stores of the email capability: templates (with versions), settings and the brand
 * guidelines. All three live in the runtime data directory only (see readRuntimeJson in @/lib/data):
 * never in public/data, never in the repository's data directory. Reads are strict.
 */

import { randomBytes } from 'crypto';
import { readRuntimeJson, updateRuntimeJson } from '@/lib/data';
import { contentHash } from './hash';
import { DEFAULT_SETTINGS, SEED_WELCOME_FIELDS, defaultGuidelines, seedWelcomeTemplate } from './seed';
import {
  EMAIL_FIELDS,
  FIELD_SAVE_LIMITS,
  SINGLE_LINE_FIELDS,
  WELCOME_TEMPLATE_KEY,
  type BrandGuidelines,
  type EmailFields,
  type EmailSettings,
  type EmailTemplate,
  type TemplateVersion,
} from './types';

const TEMPLATES_FILE = 'email-templates.json';
const SETTINGS_FILE = 'email-settings.json';
const GUIDELINES_FILE = 'email-guidelines.json';

export const MAX_TEMPLATES = 50;
export const MAX_VERSIONS_PER_TEMPLATE = 40;
export const TEMPLATE_KEY_PATTERN = /^[a-z][a-z0-9_]{2,48}$/;
export const GUIDELINES_MIN_CHARS = 200;
export const GUIDELINES_MAX_CHARS = 20000;

export class EmailStoreError extends Error {
  constructor(
    public readonly code: 'not_found' | 'conflict' | 'invalid' | 'limit',
    message: string,
  ) {
    super(message);
    this.name = 'EmailStoreError';
  }
}

const invalid = (message: string) => new EmailStoreError('invalid', message);

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

export function latestVersion(template: EmailTemplate): TemplateVersion {
  return template.versions.reduce((latest, version) => (version.version > latest.version ? version : latest));
}

export function findVersion(template: EmailTemplate, version: number): TemplateVersion | undefined {
  return template.versions.find((candidate) => candidate.version === version);
}

// ─── Validation ──────────────────────────────────────────────────────────────

const CONTROL_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Validate and normalise a partial set of fields as an admin sends them. Throws EmailStoreError('invalid'). */
export function parseFieldsPatch(input: unknown): Partial<EmailFields> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('fields must be an object');
  const out: Partial<EmailFields> = {};
  for (const [name, value] of Object.entries(input as Record<string, unknown>)) {
    if (!(EMAIL_FIELDS as readonly string[]).includes(name)) throw invalid(`Unknown field "${name}"`);
    const field = name as keyof EmailFields;
    if (typeof value !== 'string') throw invalid(`${field} must be text`);
    const text = value.replace(/\r\n?/g, '\n');
    if (CONTROL_EXCEPT_WHITESPACE.test(text)) throw invalid(`${field} must not contain control characters`);
    if (SINGLE_LINE_FIELDS.includes(field) && text.includes('\n')) throw invalid(`${field} must be on one line`);
    if (text.length > FIELD_SAVE_LIMITS[field]) {
      throw invalid(`${field} must be ${FIELD_SAVE_LIMITS[field]} characters or fewer`);
    }
    out[field] = SINGLE_LINE_FIELDS.includes(field) ? text.trim() : text.replace(/[ \t]+$/gm, '').trim();
  }
  return out;
}

function parseName(value: unknown): string {
  if (typeof value !== 'string') throw invalid('name must be text');
  const name = value.trim();
  if (!name) throw invalid('name is required');
  if (name.length > 80) throw invalid('name must be 80 characters or fewer');
  if (/[\u0000-\u001f\u007f]/.test(name)) throw invalid('name must not contain control characters');
  return name;
}

function parseKey(value: unknown): string {
  if (typeof value !== 'string' || !TEMPLATE_KEY_PATTERN.test(value)) {
    throw invalid('key must be 3 to 49 characters: lower-case letters, digits and underscores, starting with a letter');
  }
  return value;
}

const BLANK_FIELDS: EmailFields = { subject: '', preheader: '', eyebrow: '', heading: '', body: '', ctaLabel: '', ctaUrl: '' };

function pruneVersions(template: EmailTemplate): void {
  if (template.versions.length <= MAX_VERSIONS_PER_TEMPLATE) return;
  const newest = latestVersion(template).version;
  const removable = template.versions
    .filter((v) => v.version !== newest && v.version !== template.activeVersion && !v.approval)
    .sort((a, b) => a.version - b.version);
  while (template.versions.length > MAX_VERSIONS_PER_TEMPLATE && removable.length) {
    const drop = removable.shift()!;
    template.versions = template.versions.filter((v) => v.version !== drop.version);
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

async function readTemplates(): Promise<EmailTemplate[]> {
  const stored = await readRuntimeJson<EmailTemplate[] | null>(TEMPLATES_FILE, null);
  if (stored === null) return [seedWelcomeTemplate()];
  if (!Array.isArray(stored) || !stored.every((t) => t && typeof t.id === 'string' && Array.isArray(t.versions) && t.versions.length > 0)) {
    throw new Error(`${TEMPLATES_FILE} does not hold a list of templates`);
  }
  return stored;
}

/** All templates; before the first change the welcome template exists as its seed. */
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  return readTemplates();
}

export async function getEmailTemplateByKey(key: string): Promise<EmailTemplate | undefined> {
  return (await readTemplates()).find((template) => template.key === key);
}

/** Run a change against the template list (seeded first if the store does not exist yet). */
export async function mutateEmailTemplates<R>(
  mutate: (list: EmailTemplate[]) => { list?: EmailTemplate[]; result: R },
): Promise<R> {
  return updateRuntimeJson<EmailTemplate[] | null, R>(TEMPLATES_FILE, null, (current) => {
    const base = current === null ? [seedWelcomeTemplate()] : current;
    const { list, result } = mutate(base);
    return { next: list, result };
  });
}

export async function createEmailTemplate(input: { key: unknown; name: unknown }): Promise<EmailTemplate> {
  const key = parseKey(input.key);
  const name = parseName(input.name);
  const now = new Date().toISOString();
  return mutateEmailTemplates((list) => {
    if (list.length >= MAX_TEMPLATES) throw new EmailStoreError('limit', `At most ${MAX_TEMPLATES} templates`);
    if (list.some((t) => t.key === key)) throw new EmailStoreError('conflict', `A template with the key "${key}" already exists`);
    const fields = key === WELCOME_TEMPLATE_KEY ? { ...SEED_WELCOME_FIELDS } : { ...BLANK_FIELDS };
    const template: EmailTemplate = {
      id: newId('tpl'),
      key,
      name,
      enabled: true,
      activeVersion: null,
      versions: [{ version: 1, fields, hash: contentHash(fields), createdAt: now, createdBy: 'admin' }],
      createdAt: now,
      updatedAt: now,
    };
    return { list: [...list, template], result: template };
  });
}

export async function duplicateEmailTemplate(id: string): Promise<EmailTemplate> {
  const now = new Date().toISOString();
  return mutateEmailTemplates((list) => {
    const source = list.find((t) => t.id === id);
    if (!source) throw new EmailStoreError('not_found', 'Template not found');
    if (list.length >= MAX_TEMPLATES) throw new EmailStoreError('limit', `At most ${MAX_TEMPLATES} templates`);
    let key = `${source.key}_copy`.slice(0, 49);
    for (let n = 2; list.some((t) => t.key === key); n += 1) key = `${source.key}_copy${n}`.slice(0, 49);
    const fields = { ...latestVersion(source).fields };
    const copy: EmailTemplate = {
      id: newId('tpl'),
      key,
      name: `${source.name} (copy)`.slice(0, 80),
      // A copy never sends anything until it has been reviewed and activated itself.
      enabled: true,
      activeVersion: null,
      versions: [{ version: 1, fields, hash: contentHash(fields), createdAt: now, createdBy: 'admin', note: `Copied from ${source.key}` }],
      createdAt: now,
      updatedAt: now,
    };
    return { list: [...list, copy], result: copy };
  });
}

export interface TemplatePatch {
  name?: unknown;
  enabled?: unknown;
  fields?: unknown;
  note?: unknown;
}

/** Edit a template. Changed fields become a NEW version (an edit never alters a reviewed version). */
export async function updateEmailTemplate(id: string, patch: TemplatePatch): Promise<EmailTemplate> {
  const name = patch.name === undefined ? undefined : parseName(patch.name);
  if (patch.enabled !== undefined && typeof patch.enabled !== 'boolean') throw invalid('enabled must be true or false');
  const fieldsPatch = patch.fields === undefined ? undefined : parseFieldsPatch(patch.fields);
  let note: string | undefined;
  if (patch.note !== undefined) {
    if (typeof patch.note !== 'string' || patch.note.length > 200 || /[\u0000-\u001f\u007f]/.test(patch.note)) throw invalid('note must be one line of 200 characters or fewer');
    note = patch.note.trim() || undefined;
  }
  const now = new Date().toISOString();
  return mutateEmailTemplates((list) => {
    const index = list.findIndex((t) => t.id === id);
    if (index === -1) throw new EmailStoreError('not_found', 'Template not found');
    const template: EmailTemplate = structuredClone(list[index]);
    if (name !== undefined) template.name = name;
    if (patch.enabled !== undefined) template.enabled = patch.enabled as boolean;
    if (fieldsPatch) {
      const latest = latestVersion(template);
      const fields: EmailFields = { ...latest.fields, ...fieldsPatch };
      const hash = contentHash(fields);
      if (hash !== latest.hash) {
        template.versions.push({
          version: latest.version + 1,
          fields,
          hash,
          createdAt: now,
          createdBy: 'admin',
          parentVersion: latest.version,
          ...(note ? { note } : {}),
        });
        pruneVersions(template);
      }
    }
    template.updatedAt = now;
    const next = [...list];
    next[index] = template;
    return { list: next, result: template };
  });
}

export async function deleteEmailTemplate(id: string): Promise<EmailTemplate> {
  return mutateEmailTemplates((list) => {
    const target = list.find((t) => t.id === id);
    if (!target) throw new EmailStoreError('not_found', 'Template not found');
    return { list: list.filter((t) => t.id !== id), result: target };
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────

const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function normaliseSettings(stored: Partial<EmailSettings> | null): EmailSettings {
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function getEmailSettings(): Promise<EmailSettings> {
  return normaliseSettings(await readRuntimeJson<Partial<EmailSettings> | null>(SETTINGS_FILE, null));
}

function intInRange(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw invalid(`${name} must be a whole number from ${min} to ${max}`);
  }
  return value;
}

export function parseSettingsPatch(input: unknown): Partial<Omit<EmailSettings, 'updatedAt'>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Expected an object');
  const record = input as Record<string, unknown>;
  const allowed = ['maxFixRounds', 'qualityThreshold', 'hourlyCap', 'allowedLinkDomains', 'reviewModel'];
  for (const name of Object.keys(record)) if (!allowed.includes(name)) throw invalid(`Unknown setting "${name}"`);
  const out: Partial<Omit<EmailSettings, 'updatedAt'>> = {};
  if (record.maxFixRounds !== undefined) out.maxFixRounds = intInRange(record.maxFixRounds, 'maxFixRounds', 1, 6);
  if (record.qualityThreshold !== undefined) out.qualityThreshold = intInRange(record.qualityThreshold, 'qualityThreshold', 60, 100);
  if (record.hourlyCap !== undefined) out.hourlyCap = intInRange(record.hourlyCap, 'hourlyCap', 1, 500);
  if (record.allowedLinkDomains !== undefined) {
    if (!Array.isArray(record.allowedLinkDomains) || record.allowedLinkDomains.length === 0 || record.allowedLinkDomains.length > 25) {
      throw invalid('allowedLinkDomains must be a list of 1 to 25 domains');
    }
    const domains = record.allowedLinkDomains.map((domain) => (typeof domain === 'string' ? domain.trim().toLowerCase() : ''));
    if (!domains.every((domain) => domain.length <= 100 && HOST_PATTERN.test(domain))) {
      throw invalid('allowedLinkDomains must hold plain domain names such as example.com');
    }
    out.allowedLinkDomains = [...new Set(domains)];
  }
  if (record.reviewModel !== undefined) {
    if (typeof record.reviewModel !== 'string' || record.reviewModel.length > 80 || !/^[A-Za-z0-9._:/-]*$/.test(record.reviewModel)) {
      throw invalid('reviewModel must be a model id such as gpt-4.1-mini, or empty for the default');
    }
    out.reviewModel = record.reviewModel.trim();
  }
  return out;
}

export async function updateEmailSettings(patch: Partial<Omit<EmailSettings, 'updatedAt'>>): Promise<EmailSettings> {
  return updateRuntimeJson<Partial<EmailSettings> | null, EmailSettings>(SETTINGS_FILE, null, (current) => {
    const next: EmailSettings = { ...normaliseSettings(current), ...patch, updatedAt: new Date().toISOString() };
    return { next, result: next };
  });
}

// ─── Brand guidelines ────────────────────────────────────────────────────────

export async function getBrandGuidelines(): Promise<BrandGuidelines> {
  const stored = await readRuntimeJson<BrandGuidelines | null>(GUIDELINES_FILE, null);
  if (stored === null) return defaultGuidelines();
  if (typeof stored.text !== 'string' || typeof stored.version !== 'number') throw new Error(`${GUIDELINES_FILE} is not valid`);
  return stored;
}

export function parseGuidelinesText(value: unknown): string {
  if (typeof value !== 'string') throw invalid('text must be text');
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (text.length < GUIDELINES_MIN_CHARS) throw invalid(`The guidelines must be at least ${GUIDELINES_MIN_CHARS} characters: the reviewer judges every email against them`);
  if (text.length > GUIDELINES_MAX_CHARS) throw invalid(`The guidelines must be ${GUIDELINES_MAX_CHARS} characters or fewer`);
  if (CONTROL_EXCEPT_WHITESPACE.test(text)) throw invalid('text must not contain control characters');
  return text;
}

/** Save the guidelines; the version goes up only when the text changed (every approval is bound to the version). */
export async function saveBrandGuidelines(text: string, updatedBy: string): Promise<BrandGuidelines> {
  return updateRuntimeJson<BrandGuidelines | null, BrandGuidelines>(GUIDELINES_FILE, null, (current) => {
    const base = current ?? defaultGuidelines();
    if (base.text === text) return { result: base };
    const next: BrandGuidelines = { text, version: base.version + 1, updatedAt: new Date().toISOString(), updatedBy };
    return { next, result: next };
  });
}
