/**
 * The send log: one entry per attempt to send an email, kept in the runtime data directory only
 * (email-send-log.json: never mirrored to public/data or the repository, gitignored).
 *
 * Entries hold the recipient MASKED (j***@example.com), the provider's message id, the outcome and a short reason:
 * never an API key, a whole address or a message body. The log is also what the hourly sending cap counts, so a
 * slot is reserved under the file lock before a message goes out ("reserved") and settled afterwards, which keeps
 * parallel sends from overshooting the cap and leaves a visible trace if the process dies mid-send.
 * The newest MAX_LOG_ENTRIES are kept.
 */

import { randomBytes } from 'crypto';
import { readRuntimeJson, updateRuntimeJson } from '@/lib/data';

export const SEND_LOG_FILE = 'email-send-log.json';
export const MAX_LOG_ENTRIES = 2000;

export type SendKind = 'welcome' | 'test' | 'unsubscribe';

/**
 * reserved: in flight (or the process died mid-send); sent: accepted by the provider; failed: refused for good;
 * retry: a temporary problem, will be tried again; blocked: not sent because a check or the configuration said no;
 * provider_not_ready: the provider cannot send yet (domain not verified, bad key); rate_limited: a cap or the
 * provider's limit; skipped: deliberately not sent (switched off, unsubscribed); unsubscribed: the recipient followed
 * the unsubscribe link (kind "unsubscribe") and was removed from the list.
 */
export type SendOutcome = 'reserved' | 'sent' | 'failed' | 'retry' | 'blocked' | 'provider_not_ready' | 'rate_limited' | 'skipped' | 'unsubscribed';

export interface SendLogEntry {
  id: string;
  at: string;
  kind: SendKind;
  outcome: SendOutcome;
  /** The recipient, masked. */
  to: string;
  subscriberId?: string;
  templateKey: string;
  version?: number;
  layoutVersion?: string;
  /** The provider's message id (Resend), present when the provider accepted the message. */
  messageId?: string;
  httpStatus?: number;
  /** The provider's error name, or our own code. */
  code?: string;
  /** Our short classification, for example "domain_not_verified" or "not_approved". */
  reason?: string;
  /** The provider's message with addresses removed, or the gate's issue codes. */
  detail?: string;
  /** Who started it. */
  by: 'system' | 'admin';
  updatedAt?: string;
}

export type NewSendLogEntry = Omit<SendLogEntry, 'id' | 'at' | 'updatedAt'>;

function newId(now: Date): string {
  return `sl-${now.getTime()}-${randomBytes(3).toString('hex')}`;
}

function isEntry(value: unknown): value is SendLogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && typeof entry.at === 'string' && typeof entry.outcome === 'string' && typeof entry.kind === 'string';
}

async function readAll(): Promise<SendLogEntry[]> {
  const stored = await readRuntimeJson<unknown>(SEND_LOG_FILE, []);
  if (!Array.isArray(stored)) throw new Error(`${SEND_LOG_FILE} does not hold a list`);
  return stored.filter(isEntry);
}

/** Newest first. */
export async function readSendLog(filter: { kind?: SendKind; outcome?: SendOutcome; limit?: number } = {}): Promise<SendLogEntry[]> {
  const all = (await readAll()).reverse();
  const matching = all.filter((entry) => (!filter.kind || entry.kind === filter.kind) && (!filter.outcome || entry.outcome === filter.outcome));
  return matching.slice(0, Math.max(1, Math.min(filter.limit ?? 200, MAX_LOG_ENTRIES)));
}

export async function appendSendLog(entry: NewSendLogEntry, now: Date = new Date()): Promise<SendLogEntry> {
  const stored: SendLogEntry = { ...entry, id: newId(now), at: now.toISOString() };
  await updateRuntimeJson<unknown, null>(SEND_LOG_FILE, [], (current) => {
    const list = Array.isArray(current) ? current.filter(isEntry) : [];
    return { next: [...list, stored].slice(-MAX_LOG_ENTRIES), result: null };
  });
  return stored;
}

/** Messages that count against the hourly cap: those the provider accepted and those still in flight, within the last hour. */
export function countSlots(entries: readonly SendLogEntry[], now: Date, windowMs = 3_600_000): number {
  const since = now.getTime() - windowMs;
  return entries.filter((entry) => (entry.outcome === 'sent' || entry.outcome === 'reserved') && Date.parse(entry.at) > since).length;
}

export async function countSentLastHour(now: Date = new Date()): Promise<number> {
  return countSlots(await readAll(), now);
}

/** Take one hourly slot and record the attempt as "reserved" in the same locked step; refuse when the cap is reached. */
export async function reserveSendSlot(input: { cap: number; entry: NewSendLogEntry; now?: Date }): Promise<{ ok: true; entry: SendLogEntry } | { ok: false; used: number }> {
  const now = input.now ?? new Date();
  return updateRuntimeJson<unknown, { ok: true; entry: SendLogEntry } | { ok: false; used: number }>(SEND_LOG_FILE, [], (current) => {
    const list = Array.isArray(current) ? current.filter(isEntry) : [];
    const used = countSlots(list, now);
    if (used >= input.cap) return { result: { ok: false, used } };
    const entry: SendLogEntry = { ...input.entry, outcome: 'reserved', id: newId(now), at: now.toISOString() };
    return { next: [...list, entry].slice(-MAX_LOG_ENTRIES), result: { ok: true, entry } };
  });
}

/** Settle a reserved entry (or amend any entry) with its outcome. */
export async function settleSendLog(id: string, patch: Partial<Omit<SendLogEntry, 'id' | 'at'>>, now: Date = new Date()): Promise<SendLogEntry | undefined> {
  return updateRuntimeJson<unknown, SendLogEntry | undefined>(SEND_LOG_FILE, [], (current) => {
    const list = Array.isArray(current) ? current.filter(isEntry) : [];
    const index = list.findIndex((entry) => entry.id === id);
    if (index === -1) return { result: undefined };
    const settled: SendLogEntry = { ...list[index], ...patch, updatedAt: now.toISOString() };
    const next = [...list];
    next[index] = settled;
    return { next, result: settled };
  });
}
