/**
 * A scripted stand-in for the AI reviewer, for tests only: no network, no key. Each call to review() or fix() takes
 * the next scripted answer (a value, an Error to throw, or a function of the input); the last answer repeats.
 */

import { AiUnavailableError, type AiClient, type FixInput, type FixResult, type ReviewInput } from '@/lib/email/ai-review';
import type { AiReview, AiScores, GateIssue } from '@/lib/email/types';

type Step<I, O> = O | Error | ((input: I) => O);

export function scores(value: number, overrides: Partial<AiScores> = {}): AiScores {
  return { content: value, brand: value, tone: value, language: value, quality: value, ...overrides };
}

export function passingReview(overrides: Partial<AiReview> = {}): AiReview {
  return { provider: 'stub', model: 'stub-model', scores: scores(93), verdict: 'pass', summary: 'On brand and ready to send.', issues: [], ms: 1, ...overrides };
}

export function aiIssue(field: GateIssue['field'], severity: 'blocker' | 'major' | 'minor', message: string, dimension = 'tone'): GateIssue {
  return { source: 'ai', code: `ai_${dimension}`, field, message, suggestion: 'Rewrite it in the brand voice.', fixable: true, severity };
}

/** A failing review: the dimensions the issues concern score low, the others stay high. */
export function failingReview(issues: GateIssue[], scoreValue = 70): AiReview {
  const low: Partial<AiScores> = {};
  for (const found of issues) low[found.code.replace(/^ai_/, '') as keyof AiScores] = scoreValue;
  return passingReview({ scores: scores(93, low), verdict: 'fail', summary: 'Needs work.', issues });
}

export function fixResult(fixes: FixResult['fixes'], rationale = 'Adjusted the wording.'): FixResult {
  return { fixes, rationale, provider: 'stub', model: 'stub-model' };
}

export class StubAi implements AiClient {
  reviewCalls: ReviewInput[] = [];
  fixCalls: FixInput[] = [];
  constructor(
    private readonly reviews: Array<Step<ReviewInput, AiReview>> = [],
    private readonly fixes: Array<Step<FixInput, FixResult>> = [],
  ) {}

  private take<I, O>(steps: Array<Step<I, O>>, index: number, input: I, what: string): O {
    if (steps.length === 0) throw new AiUnavailableError('no_provider', `No scripted ${what} answer.`);
    const step = steps[Math.min(index, steps.length - 1)];
    if (step instanceof Error) throw step;
    return typeof step === 'function' ? (step as (input: I) => O)(input) : step;
  }

  async review(input: ReviewInput): Promise<AiReview> {
    const index = this.reviewCalls.length;
    this.reviewCalls.push(input);
    return this.take(this.reviews, index, input, 'review');
  }

  async fix(input: FixInput): Promise<FixResult> {
    const index = this.fixCalls.length;
    this.fixCalls.push(input);
    return this.take(this.fixes, index, input, 'fix');
  }
}
