/**
 * What each AI reviewer model last did, kept across restarts (email-reviewer-state.json in the runtime data directory),
 * so the admin screen can show which judge is really in use and why an earlier one is not: for every (provider, model)
 * the outcome of the last call (ok, credit_exhausted, invalid_key, unknown_model, rate_limited, ...), when, the HTTP
 * status and the provider's message with keys and addresses removed. Written as each review round finishes.
 */

import { readRuntimeJson, updateRuntimeJson } from '@/lib/data';
import type { AiAttemptOutcome, AiAttemptRecord, GateRound } from './types';

export const REVIEWER_STATE_FILE = 'email-reviewer-state.json';
const MAX_ENTRIES = 40;

export interface ReviewerEntryState {
  outcome: AiAttemptOutcome;
  at: string;
  httpStatus?: number;
  code?: string;
  detail?: string;
}

export interface ReviewerState {
  entries: Record<string, ReviewerEntryState>;
  updatedAt: string;
}

export const reviewerKey = (entry: { provider: string; model: string }) => `${entry.provider}:${entry.model}`;

/** The stored state, keeping only entries of the expected shape (a hand-edited or damaged file never stops a review or the status). */
function normalise(stored: unknown): ReviewerState {
  const raw = (stored as Partial<ReviewerState> | null)?.entries;
  const entries: Record<string, ReviewerEntryState> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      const entry = value as Partial<ReviewerEntryState> | null;
      if (entry && typeof entry.outcome === 'string' && typeof entry.at === 'string') entries[key] = entry as ReviewerEntryState;
    }
  }
  return { entries, updatedAt: String((stored as Partial<ReviewerState> | null)?.updatedAt ?? '') };
}

export async function readReviewerState(): Promise<ReviewerState> {
  return normalise(await readRuntimeJson<unknown>(REVIEWER_STATE_FILE, null));
}

/** Every call a round made: those for the review and those for the fix, in the order they happened. */
export function attemptsOfRound(round: GateRound): AiAttemptRecord[] {
  return [...(round.aiAttempts ?? []), ...(round.fixAttempts ?? [])].sort((a, b) => a.at.localeCompare(b.at));
}

/** Remember the latest outcome of each model that was called (the newest call wins). */
export async function recordReviewerAttempts(attempts: readonly AiAttemptRecord[]): Promise<void> {
  if (attempts.length === 0) return;
  await updateRuntimeJson<unknown, null>(REVIEWER_STATE_FILE, null, (current) => {
    const state = normalise(current);
    for (const attempt of [...attempts].sort((a, b) => a.at.localeCompare(b.at))) {
      const known = state.entries[reviewerKey(attempt)];
      if (known && known.at > attempt.at) continue; // two reviews can finish out of order: the newer call stays the last word
      state.entries[reviewerKey(attempt)] = {
        outcome: attempt.outcome,
        at: attempt.at,
        ...(attempt.httpStatus !== undefined ? { httpStatus: attempt.httpStatus } : {}),
        ...(attempt.code ? { code: attempt.code } : {}),
        ...(attempt.detail ? { detail: attempt.detail } : {}),
      };
    }
    const keys = Object.keys(state.entries).sort((a, b) => state.entries[b].at.localeCompare(state.entries[a].at));
    for (const old of keys.slice(MAX_ENTRIES)) delete state.entries[old];
    state.updatedAt = new Date().toISOString();
    return { next: state, result: null };
  });
}
