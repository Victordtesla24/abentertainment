/**
 * Quality reviews can take a while (several AI calls), longer than the static host's proxy waits for a reply. A review
 * therefore runs as a job in this server process: the request that starts it gets the result if it finishes quickly
 * and a "running" answer otherwise, and the admin screen polls for the rounds as they complete. The finished result is
 * also saved on the template version, so nothing depends on this memory afterwards.
 */

import type { GateResult, GateRound } from './types';

export interface ReviewJob {
  key: string;
  status: 'running' | 'done' | 'error';
  startedAt: string;
  finishedAt?: string;
  rounds: GateRound[];
  result?: GateResult;
  approvedVersion?: number | null;
  error?: string;
}

const KEEP_MS = 30 * 60_000;
const jobs = new Map<string, ReviewJob>();
const waiters = new Map<string, Promise<ReviewJob>>();

function sweep(): void {
  const cutoff = Date.now() - KEEP_MS;
  for (const [key, job] of jobs) {
    if (job.status !== 'running' && job.finishedAt && Date.parse(job.finishedAt) < cutoff) jobs.delete(key);
  }
}

export function reviewJobKey(templateId: string, version: number): string {
  return `${templateId}:${version}`;
}

export function getReviewJob(key: string): ReviewJob | undefined {
  return jobs.get(key);
}

/** Start the job, or join the one already running for this version. */
export function startReviewJob(
  key: string,
  run: (onRound: (round: GateRound) => void) => Promise<{ result: GateResult; approvedVersion: number | null }>,
): { job: ReviewJob; done: Promise<ReviewJob> } {
  sweep();
  const existing = jobs.get(key);
  const joined = waiters.get(key);
  if (existing && existing.status === 'running' && joined) return { job: existing, done: joined };

  const job: ReviewJob = { key, status: 'running', startedAt: new Date().toISOString(), rounds: [] };
  jobs.set(key, job);
  const done = run((round) => {
    job.rounds = [...job.rounds.filter((r) => r.round !== round.round), round].sort((a, b) => a.round - b.round);
  })
    .then(({ result, approvedVersion }) => {
      job.status = 'done';
      job.result = result;
      job.rounds = result.rounds;
      job.approvedVersion = approvedVersion;
      job.finishedAt = new Date().toISOString();
      return job;
    })
    .catch((err: unknown) => {
      job.status = 'error';
      job.error = err instanceof Error ? err.name : 'error';
      job.finishedAt = new Date().toISOString();
      return job;
    })
    .finally(() => {
      waiters.delete(key);
    });
  waiters.set(key, done);
  return { job, done };
}
