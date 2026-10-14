/**
 * What the email provider last told us, kept across restarts (email-provider-state.json in the runtime data directory).
 *
 * A quota or rate-limit answer from Resend holds back AUTOMATIC attempts (a new signup, the queue sweeper) until the
 * limit should have cleared, so the site does not keep asking a provider that has said no, and the admin screen can say
 * what is wrong, when it was last tried and when the next try is due. A daily or monthly quota holds until the next UTC
 * midnight (when the daily quota resets; a monthly one is probed again each day); a rate limit holds for the provider's
 * Retry-After; an unverified domain or a bad key backs off from five minutes to an hour; a temporary error backs off from a
 * minute to half an hour. A send an administrator asks for ("send waiting welcomes", a test email) always tries the
 * provider, and any accepted send clears the hold.
 */

import { readRuntimeJson, updateRuntimeJson } from '@/lib/data';
import type { ResendResult } from './resend';

export const PROVIDER_STATE_FILE = 'email-provider-state.json';

export interface ProviderState {
  lastAttemptAt?: string;
  /** What the provider did on the last attempt: sent, or why not (retry: a temporary problem). */
  lastOutcome?: 'sent' | 'failed' | 'retry' | 'provider_not_ready' | 'rate_limited';
  /** Our short classification, for example quota_exceeded or domain_not_verified. */
  lastReason?: string;
  /** The provider's own error name, for example daily_quota_exceeded. */
  lastCode?: string;
  lastHttpStatus?: number;
  /** The provider's message with addresses removed. */
  lastDetail?: string;
  lastSuccessAt?: string;
  /** Automatic attempts wait until this time. */
  blockedUntil?: string;
  consecutiveFailures: number;
  updatedAt: string;
}

const EMPTY: ProviderState = { consecutiveFailures: 0, updatedAt: '' };

function normalise(stored: unknown): ProviderState {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { ...EMPTY };
  const state = stored as Partial<ProviderState>;
  return { ...EMPTY, ...state, consecutiveFailures: Number.isInteger(state.consecutiveFailures) ? (state.consecutiveFailures as number) : 0 };
}

export async function readProviderState(): Promise<ProviderState> {
  return normalise(await readRuntimeJson<unknown>(PROVIDER_STATE_FILE, null));
}

export function isBlocked(state: ProviderState, now: Date): boolean {
  return Boolean(state.blockedUntil) && Date.parse(state.blockedUntil as string) > now.getTime();
}

/** Midnight UTC after `now`, plus a short grace so the provider has certainly reset. */
export function nextUtcMidnight(now: Date, graceSeconds = 60): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, graceSeconds));
}

type Failure = Extract<ResendResult, { ok: false }>;

/** When automatic attempts may resume after this failure (null: the failure is about the message, not the provider). */
export function holdUntil(failure: Failure, now: Date, consecutiveFailures: number): Date | null {
  const after = (seconds: number) => new Date(now.getTime() + seconds * 1000);
  const n = Math.max(0, consecutiveFailures - 1);
  switch (failure.kind) {
    case 'rate_limited':
      if (failure.reason === 'quota_exceeded') return nextUtcMidnight(now);
      return after(Math.min(Math.max(failure.retryAfterSeconds ?? 60, 10), 3600));
    case 'provider_not_ready':
      return after(Math.min(300 * 2 ** n, 3600));
    case 'retry':
      return after(Math.min(60 * 2 ** n, 1800));
    default:
      return null;
  }
}

const OUTCOME_OF: Record<Failure['kind'], NonNullable<ProviderState['lastOutcome']>> = {
  rate_limited: 'rate_limited',
  provider_not_ready: 'provider_not_ready',
  retry: 'retry',
  rejected: 'failed',
};

/** Record the provider's answer to a send: an accepted send clears any hold; a refusal sets or extends one. */
export async function recordProviderAttempt(result: ResendResult, now: Date = new Date()): Promise<ProviderState> {
  const at = now.toISOString();
  return updateRuntimeJson<unknown, ProviderState>(PROVIDER_STATE_FILE, null, (current) => {
    const previous = normalise(current);
    let next: ProviderState;
    if (result.ok) {
      next = { consecutiveFailures: 0, lastAttemptAt: at, lastOutcome: 'sent', lastHttpStatus: result.status, lastSuccessAt: at, updatedAt: at };
    } else {
      const failures = result.kind === 'rejected' ? 0 : previous.consecutiveFailures + 1;
      const until = holdUntil(result, now, failures);
      next = {
        ...(previous.lastSuccessAt ? { lastSuccessAt: previous.lastSuccessAt } : {}),
        consecutiveFailures: failures,
        lastAttemptAt: at,
        lastOutcome: OUTCOME_OF[result.kind],
        lastReason: result.reason,
        lastCode: result.code,
        ...(result.status !== null ? { lastHttpStatus: result.status } : {}),
        ...(result.detail ? { lastDetail: result.detail } : {}),
        ...(until ? { blockedUntil: until.toISOString() } : {}),
        updatedAt: at,
      };
    }
    return { next, result: next };
  });
}
