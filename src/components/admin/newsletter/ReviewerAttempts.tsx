'use client';
import type { SendingStatus } from '@/lib/email/sender';
import type { AiAttemptOutcome, AiAttemptRecord } from '@/lib/email/types';
import { Badge, formatDate, type Tone } from './shared';

/**
 * Which AI model judged an email, and why an earlier one did not: every call the reviewer made is listed in the order it
 * was made ("Claude Opus 5.5 skipped: Anthropic account credit balance too low"), and the sending status shows what each
 * model in the chain did the last time it was asked. The words here are the only place the outcome codes become text.
 */

const PROVIDER_NAME: Record<string, string> = { anthropic: 'Anthropic', openai: 'OpenAI', openrouter: 'OpenRouter' };

const MODEL_NAME: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'gpt-5.4': 'GPT-5.4',
  'gpt-4.1': 'GPT-4.1',
  'gpt-4.1-mini': 'GPT-4.1 mini',
};

export const providerName = (provider: string): string => PROVIDER_NAME[provider] ?? provider;

/** "Claude Opus 5.5", "GPT-5.4 (OpenAI)", "GPT-4.1 mini (OpenRouter)": a model as an administrator knows it. */
export function modelLabel(provider: string, model: string): string {
  const bare = model.includes('/') ? model.slice(model.indexOf('/') + 1) : model;
  const claude = /^claude-(opus|sonnet|haiku)-(\d+)-(\d+)$/.exec(bare);
  const name = MODEL_NAME[bare] ?? (claude ? `Claude ${claude[1][0].toUpperCase()}${claude[1].slice(1)} ${claude[2]}.${claude[3]}` : bare);
  if (provider === 'anthropic' && /^Claude /.test(name)) return name;
  return `${name} (${providerName(provider)})`;
}

/** Why a call did not produce the review, as a short phrase that follows "skipped:". */
export function outcomeText(provider: string, outcome: AiAttemptOutcome): string {
  const who = providerName(provider);
  switch (outcome) {
    case 'ok':
      return 'answered';
    case 'credit_exhausted':
      return `${who} account credit balance too low`;
    case 'invalid_key':
      return `${who} rejected the API key`;
    case 'forbidden':
      return `${who} does not allow this key to use the model`;
    case 'unknown_model':
      return `${who} has no model with this name`;
    case 'rate_limited':
      return `${who} rate limit reached`;
    case 'overloaded':
      return `${who} is overloaded`;
    case 'server_error':
      return `${who} had a server error`;
    case 'timeout':
      return `${who} did not answer in time`;
    case 'network':
      return `${who} could not be reached`;
    case 'bad_shape':
      return 'the answer was not in the expected form';
    case 'bad_request':
      return `${who} refused the request`;
    default:
      return String(outcome).replace(/_/g, ' ');
  }
}

/** Outcomes that will not change until someone acts (a top-up, a new key); the rest may clear by themselves. */
const LASTING: ReadonlySet<string> = new Set(['credit_exhausted', 'invalid_key', 'forbidden', 'unknown_model', 'bad_request']);

const detailLine = (entry: { httpStatus?: number | null; code?: string | null; detail?: string | null }): string => {
  const head = [entry.httpStatus ? `HTTP ${entry.httpStatus}` : '', entry.code ?? ''].filter(Boolean).join(', ');
  return [head, entry.detail ?? ''].filter(Boolean).join(': ');
};

/** One sentence per call: "Claude Opus 5.5 skipped: Anthropic account credit balance too low." / "GPT-5.4 (OpenAI) judged this round." */
export function attemptSentence(attempt: Pick<AiAttemptRecord, 'provider' | 'model' | 'outcome' | 'attempt'>, okVerb: string): string {
  const label = modelLabel(attempt.provider, attempt.model);
  if (attempt.outcome === 'ok') return `${label} ${okVerb}.`;
  return `${label}${attempt.attempt > 1 ? ' (second try)' : ''} skipped: ${outcomeText(attempt.provider, attempt.outcome)}.`;
}

/** Every call made for a review (or a fix) in order, so it is plain which model judged and why the ones before it did not. */
export function AttemptList({ attempts, heading, okVerb, testId }: { attempts: readonly AiAttemptRecord[] | undefined; heading: string; okVerb: string; testId: string }) {
  if (!attempts || attempts.length === 0) return null;
  return (
    <div data-testid={testId}>
      <p className="text-[11px] text-white/35 font-body mb-1">{heading}</p>
      <ol className="space-y-1.5">
        {attempts.map((attempt, index) => {
          const detail = attempt.outcome === 'ok' ? '' : detailLine(attempt);
          return (
            <li key={`${attempt.provider}-${attempt.model}-${attempt.attempt}-${index}`} data-testid="review-attempt" data-outcome={attempt.outcome} className="text-[12px] font-body leading-relaxed">
              <span className="inline-block mr-2 align-middle">
                <Badge tone={attempt.outcome === 'ok' ? 'good' : LASTING.has(attempt.outcome) ? 'bad' : 'gold'}>{attempt.outcome === 'ok' ? 'Judged' : 'Skipped'}</Badge>
              </span>
              <span className="text-white/75">{attemptSentence(attempt, okVerb)}</span>
              {detail && <span className="block text-[11px] text-white/35 mt-0.5 [overflow-wrap:anywhere]">{detail}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type Reviewer = SendingStatus['reviewer'];

/** What each model in the chain did the last time it was asked, and which one the next review is expected to be judged by. */
export function ReviewerAvailability({ reviewer }: { reviewer: Reviewer }) {
  if (reviewer.chain.length === 0) return null;
  const first = reviewer.chain[0];
  const inUse = reviewer.inUse;
  return (
    <div data-testid="reviewer-availability" className="mt-2 space-y-2">
      <ul className="space-y-1.5">
        {reviewer.availability.map((entry) => {
          const outcome = entry.outcome as AiAttemptOutcome | null;
          const tone: Tone = outcome === null ? 'muted' : outcome === 'ok' ? 'good' : LASTING.has(outcome) ? 'bad' : 'gold';
          const detail = outcome && outcome !== 'ok' ? detailLine(entry) : '';
          return (
            <li key={`${entry.provider}-${entry.model}`} data-testid="reviewer-availability-entry" data-outcome={outcome ?? 'untried'} className="text-[12px] font-body leading-relaxed text-left">
              <span className="inline-block mr-2 align-middle">
                <Badge tone={tone}>{outcome === null ? 'Not tried yet' : outcome === 'ok' ? 'Working' : 'Skipped'}</Badge>
              </span>
              <span className="text-white/75">{modelLabel(entry.provider, entry.model)}</span>
              <span className="text-white/45">
                {outcome === null ? '' : outcome === 'ok' ? `: answered the last time it was asked (${formatDate(entry.at)})` : `: ${outcomeText(entry.provider, outcome)} (${formatDate(entry.at)})`}
              </span>
              {detail && <span className="block text-[11px] text-white/35 mt-0.5 [overflow-wrap:anywhere]">{detail}</span>}
            </li>
          );
        })}
      </ul>
      <p data-testid="reviewer-in-use" className="text-[12px] text-white/60 font-body text-left">
        {inUse
          ? inUse.provider === first.provider && inUse.model === first.model
            ? `The next review is expected to be judged by ${modelLabel(inUse.provider, inUse.model)}.`
            : `The next review is expected to be judged by ${modelLabel(inUse.provider, inUse.model)}, because the models before it in the list could not be used when last asked. They are tried first at every review and take over as soon as they answer.`
          : 'No model in the list answered the last time it was asked. Every review tries them all again.'}
      </p>
    </div>
  );
}
