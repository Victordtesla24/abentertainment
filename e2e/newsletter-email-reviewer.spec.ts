/**
 * The AI reviewer chain: Anthropic first (Claude Opus 5.5, then Claude Sonnet 5.5), then OpenAI (GPT-5.4, then GPT-4.1
 * mini), then OpenRouter, with the administrator's model choice going first. In-process, against a stubbed fetch: nothing
 * here has a key or a network. The request to Anthropic's Messages API and the exact GPT-5.x payload are asserted at the
 * boundary (URL, headers, body), every fallback step is exercised, and the approval is shown to record which provider and
 * model approved it.
 *
 * Nothing is skipped silently: every call is recorded in order with its outcome (credit_exhausted, invalid_key,
 * unknown_model, rate_limited, ...), the HTTP status and the provider's message with keys and addresses removed, on the
 * review that answered, on the error when none could, on the gate round, and as the last outcome of each model in the
 * sending status the administrator sees.
 */

import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir, unitDir } from './support/email-unit';

type Ai = typeof import('@/lib/email/ai-review');
type Gate = typeof import('@/lib/email/gate');
type Store = typeof import('@/lib/email/store');
type Seed = typeof import('@/lib/email/seed');
type LayoutMod = typeof import('@/lib/email/layout');
type Sender = typeof import('@/lib/email/sender');
type ReviewerStateMod = typeof import('@/lib/email/reviewer-state');
type ScrubMod = typeof import('@/lib/email/scrub');
type AttemptRecord = import('@/lib/email/types').AiAttemptRecord;

const KEYS = { ANTHROPIC_API_KEY: 'sk-ant-test-0123456789abcdef', OPENAI_API_KEY: 'sk-openai-test-0123456789abcdef', OPENROUTER_API_KEY: 'sk-or-test-0123456789abcdef' };
const REVIEW = {
  scores: { content: 93, brand: 94, tone: 92, language: 95, quality: 93 },
  verdict: 'pass',
  summary: 'On brand and ready to send.',
  issues: [{ dimension: 'tone', field: 'body', severity: 'minor', message: 'Could be a touch warmer.', suggestion: 'Add a closing thanks.' }],
};
const FIX = { fixes: { subject: null, preheader: null, eyebrow: null, heading: null, body: 'A reworded body that is long enough to be a proper message for the readers of the newsletter. It thanks them for joining and invites them to explore the events.', ctaLabel: null, ctaUrl: null }, rationale: 'Made the body warmer.' };

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

type Step = (() => Response) | Error;
const anthropicTool = (name: string, input: unknown) => () => new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_1', name, input }] }), { status: 200, headers: { 'content-type': 'application/json' } });
const openAiText = (content: unknown) => () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
const httpError = (status: number) => () => new Response(JSON.stringify({ error: { message: 'something went wrong with sk-ant-test-0123456789abcdef' } }), { status, headers: { 'content-type': 'application/json' } });
const apiError = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
/** What Anthropic answers when the account has no credit: a 400 invalid_request_error (not a billing status). */
const CREDIT_MESSAGE = 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.';
const anthropicCreditLow = apiError(400, { type: 'error', error: { type: 'invalid_request_error', message: CREDIT_MESSAGE } });

/** A fetch that decides each answer from the request itself (which provider, which model), recording every call. */
function routedFetch(route: (call: Call) => Response | Error) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    const call: Call = { url, headers: { ...(init.headers as Record<string, string>) }, body: JSON.parse(String(init.body)) as Record<string, unknown> };
    calls.push(call);
    const out = route(call);
    if (out instanceof Error) throw out;
    return out;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function stubFetch(script: Step[]) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: { ...(init.headers as Record<string, string>) }, body: JSON.parse(String(init.body)) as Record<string, unknown> });
    const step = script[Math.min(calls.length - 1, script.length - 1)];
    if (step instanceof Error) throw step;
    return step();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test.describe.configure({ mode: 'serial' });

test.describe('AI reviewer chain', () => {
  let ai: Ai;
  let gate: Gate;
  let store: Store;
  let seed: Seed;
  let layoutMod: LayoutMod;
  let sender: Sender;
  let reviewerState: ReviewerStateMod;
  let scrub: ScrubMod;

  test.beforeAll(() => {
    loadWithUnitDir(() => {
      ai = require('@/lib/email/ai-review') as Ai;
      gate = require('@/lib/email/gate') as Gate;
      store = require('@/lib/email/store') as Store;
      seed = require('@/lib/email/seed') as Seed;
      layoutMod = require('@/lib/email/layout') as LayoutMod;
      sender = require('@/lib/email/sender') as Sender;
      reviewerState = require('@/lib/email/reviewer-state') as ReviewerStateMod;
      scrub = require('@/lib/email/scrub') as ScrubMod;
    });
  });

  test.beforeEach(() => cleanUnitDir());

  const chain = (env: Record<string, string>, setting = '') => ai.reviewerChain(env, setting).map((a) => `${a.provider}:${a.model}`);
  const reviewInput = (model = '') => ({ fields: seed.SEED_WELCOME_FIELDS, plainText: 'plain text', guidelines: { text: seed.DEFAULT_GUIDELINES_TEXT, version: 1, updatedAt: '', updatedBy: '' }, threshold: 85, model });

  test('the default chain: Claude Opus 5.5, Claude Sonnet 5.5, GPT-5.4, GPT-4.1 mini, then OpenRouter, and only for the keys that exist', () => {
    expect(chain(KEYS)).toEqual(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.4', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain({ ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY })).toEqual(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5']);
    expect(chain({ OPENAI_API_KEY: KEYS.OPENAI_API_KEY })).toEqual(['openai:gpt-5.4', 'openai:gpt-4.1-mini']);
    expect(chain({ OPENAI_API_KEY: KEYS.OPENAI_API_KEY, OPENROUTER_API_KEY: KEYS.OPENROUTER_API_KEY })).toEqual(['openai:gpt-5.4', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain({})).toEqual([]);
    expect(ai.configuredAiProviders(KEYS)).toEqual(['anthropic', 'openai', 'openrouter']);
    expect(ai.configuredAiProviders({ OPENAI_API_KEY: KEYS.OPENAI_API_KEY })).toEqual(['openai']);
    expect(ai.configuredAiProviders({})).toEqual([]);
    expect(ai.ANTHROPIC_DEFAULT_MODELS).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5']);
    expect(ai.OPENAI_DEFAULT_MODELS).toEqual(['gpt-5.4', 'gpt-4.1-mini']);
  });

  test('the administrator\'s model goes first on the provider that serves it, then the same model through OpenRouter, then the default chain', () => {
    expect(chain(KEYS, 'claude-sonnet-5-5')).toEqual(['anthropic:claude-sonnet-5-5', 'openrouter:anthropic/claude-sonnet-5-5', 'anthropic:claude-opus-5-5', 'openai:gpt-5.4', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain(KEYS, 'claude-haiku-4-5')).toEqual(['anthropic:claude-haiku-4-5', 'openrouter:anthropic/claude-haiku-4-5', 'anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.4', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain(KEYS, 'anthropic/claude-opus-5-5')).toEqual(['anthropic:claude-opus-5-5', 'openrouter:anthropic/claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.4', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain(KEYS, 'gpt-4.1')).toEqual(['openai:gpt-4.1', 'openrouter:openai/gpt-4.1', 'anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.4', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain(KEYS, 'openai/gpt-4.1')).toEqual(chain(KEYS, 'gpt-4.1'));
    // GPT-5.4 chosen explicitly: it goes first (and again through OpenRouter), and is not repeated further down the chain
    expect(chain(KEYS, 'gpt-5.4')).toEqual(['openai:gpt-5.4', 'openrouter:openai/gpt-5.4', 'anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain({ OPENAI_API_KEY: KEYS.OPENAI_API_KEY }, 'gpt-5.4')).toEqual(['openai:gpt-5.4', 'openai:gpt-4.1-mini']);
    expect(chain(KEYS, 'google/gemini-2.5-pro')).toEqual(['openrouter:google/gemini-2.5-pro', 'anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.4', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    // the default model chosen explicitly is the default chain
    expect(chain({ ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY }, 'claude-opus-5-5')).toEqual(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5']);
    // a model whose provider has no key: the default chain, with OpenRouter (when present) carrying the choice
    expect(chain({ ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY }, 'gpt-4.1')).toEqual(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5']);
    expect(chain({ OPENROUTER_API_KEY: KEYS.OPENROUTER_API_KEY }, 'claude-sonnet-5-5')).toEqual(['openrouter:anthropic/claude-sonnet-5-5', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain({ OPENAI_API_KEY: KEYS.OPENAI_API_KEY, OPENROUTER_API_KEY: KEYS.OPENROUTER_API_KEY }, 'claude-sonnet-5-5')).toEqual(['openrouter:anthropic/claude-sonnet-5-5', 'openai:gpt-5.4', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
  });

  test('the request to Anthropic: Messages API, x-api-key, a forced tool call whose schema is the answer; the answer is read from the tool call', async () => {
    const stub = stubFetch([anthropicTool('email_review', REVIEW)]);
    const client = ai.createAiClient({ fetchImpl: stub.impl, env: KEYS });
    const review = await client.review(reviewInput());
    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0];
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.headers).toEqual({ 'Content-Type': 'application/json', 'x-api-key': KEYS.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' });
    expect(call.headers.Authorization).toBeUndefined();
    expect(call.body).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 3000, tool_choice: { type: 'tool', name: 'email_review' } });
    expect(typeof call.body.system).toBe('string');
    expect(call.body.messages).toEqual([{ role: 'user', content: expect.stringContaining('The AB Entertainment Community') }]);
    const tools = call.body.tools as Array<{ name: string; input_schema: { type: string; required: string[] } }>;
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({ name: 'email_review', input_schema: { type: 'object', required: ['scores', 'verdict', 'summary', 'issues'] } });
    expect('temperature' in call.body).toBe(false);
    expect(JSON.stringify(call.body)).not.toContain(KEYS.ANTHROPIC_API_KEY);
    expect(review).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', verdict: 'pass', scores: REVIEW.scores });
    expect(review.issues).toMatchObject([{ code: 'ai_tone', field: 'body', severity: 'minor', source: 'ai' }]);

    const fixStub = stubFetch([anthropicTool('email_fix', FIX)]);
    const fix = await ai.createAiClient({ fetchImpl: fixStub.impl, env: KEYS }).fix({ fields: seed.SEED_WELCOME_FIELDS, issues: [], changeable: ['body'], guidelines: reviewInput().guidelines, threshold: 85, model: '', allowedLinkDomains: ['abentertainment.com.au'] });
    expect(fixStub.calls[0].body).toMatchObject({ model: 'claude-opus-5-5', tool_choice: { type: 'tool', name: 'email_fix' } });
    expect(fix).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', rationale: 'Made the body warmer.' });
    expect(fix.fixes.body).toContain('A reworded body');
  });

  test('fallback: an unknown model moves on to Sonnet, an overload is retried once then moves on, all of Anthropic down moves to OpenAI, and nothing leaks a key', async () => {
    // Opus is not found (404): straight to Sonnet, no retry
    const notFound = stubFetch([httpError(404), anthropicTool('email_review', REVIEW)]);
    const first = await ai.createAiClient({ fetchImpl: notFound.impl, env: KEYS }).review(reviewInput());
    expect(notFound.calls.map((c) => c.body.model)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5']);
    expect(first).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-5-5' });

    // Opus is overloaded (529): retried once, then Sonnet
    const overloaded = stubFetch([httpError(529), httpError(529), anthropicTool('email_review', REVIEW)]);
    const second = await ai.createAiClient({ fetchImpl: overloaded.impl, env: KEYS }).review(reviewInput());
    expect(overloaded.calls.map((c) => c.body.model)).toEqual(['claude-opus-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5']);
    expect(second.model).toBe('claude-sonnet-5-5');

    // a rejected key (401) is not retried; both Claude models are tried and then OpenAI's GPT-5.4 answers
    const rejected = stubFetch([httpError(401), httpError(401), openAiText(REVIEW)]);
    const third = await ai.createAiClient({ fetchImpl: rejected.impl, env: KEYS }).review(reviewInput());
    expect(rejected.calls.map((c) => c.url)).toEqual(['https://api.anthropic.com/v1/messages', 'https://api.anthropic.com/v1/messages', 'https://api.openai.com/v1/chat/completions']);
    expect(rejected.calls[2].headers.Authorization).toBe(`Bearer ${KEYS.OPENAI_API_KEY}`);
    expect(rejected.calls[2].body).toMatchObject({ model: 'gpt-5.4' });
    expect(third).toMatchObject({ provider: 'openai', model: 'gpt-5.4' });

    // a network failure, then an answer that is not the expected shape: Opus has had its two tries, so Sonnet answers
    const odd = stubFetch([new TypeError('fetch failed'), anthropicTool('email_review', { scores: { content: 90 } }), anthropicTool('email_review', REVIEW)]);
    const fourth = await ai.createAiClient({ fetchImpl: odd.impl, env: KEYS }).review(reviewInput());
    expect(odd.calls.map((c) => c.body.model)).toEqual(['claude-opus-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5']);
    expect(fourth).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-5-5' });

    // everything fails: the error names the provider and the status, never a key
    const down = stubFetch([httpError(500)]);
    const failure = await ai.createAiClient({ fetchImpl: down.impl, env: KEYS }).review(reviewInput()).catch((err: Error) => err);
    expect(failure).toBeInstanceOf(ai.AiUnavailableError);
    expect((failure as Error).message).toMatch(/openrouter reviewer answered HTTP 500/);
    for (const key of Object.values(KEYS)) expect((failure as Error).message).not.toContain(key);
    // 5 models x 2 tries (opus, sonnet, gpt-5.4, gpt-4.1-mini, openrouter)
    expect(down.calls).toHaveLength(10);

    // no tool call in the answer is an unusable answer, not a pass
    const refusal = stubFetch([() => new Response(JSON.stringify({ content: [{ type: 'text', text: 'I cannot help with that.' }] }), { status: 200 })]);
    const unusable = await ai.createAiClient({ fetchImpl: refusal.impl, env: { ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY } }).review(reviewInput()).catch((err: Error) => err);
    expect(unusable).toBeInstanceOf(ai.AiInvalidResponseError);
    expect(refusal.calls).toHaveLength(4); // opus x2, sonnet x2
  });

  test('the administrator\'s model is used first, and no key at all is "unavailable"', async () => {
    const stub = stubFetch([anthropicTool('email_review', REVIEW)]);
    const review = await ai.createAiClient({ fetchImpl: stub.impl, env: KEYS }).review(reviewInput('claude-sonnet-5-5'));
    expect(stub.calls[0].body.model).toBe('claude-sonnet-5-5');
    expect(review.model).toBe('claude-sonnet-5-5');
    const openAi = stubFetch([openAiText(REVIEW)]);
    const viaOpenAi = await ai.createAiClient({ fetchImpl: openAi.impl, env: KEYS }).review(reviewInput('gpt-4.1'));
    expect(openAi.calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect(viaOpenAi).toMatchObject({ provider: 'openai', model: 'gpt-4.1' });
    const none = await ai.createAiClient({ fetchImpl: stub.impl, env: {} }).review(reviewInput()).catch((err: Error) => err);
    expect(none).toBeInstanceOf(ai.AiUnavailableError);
    expect((none as Error).message).toContain('ANTHROPIC_API_KEY');
    // the loopback override (tests only) is honoured for a loopback address and ignored for anything else
    expect(ai.resolveProviders({ ...KEYS, EMAIL_AI_BASE_URL: 'http://127.0.0.1:3198' }).map((p) => p.url)).toEqual(['http://127.0.0.1:3198/v1/messages', 'http://127.0.0.1:3198/v1/chat/completions', 'https://openrouter.ai/api/v1/chat/completions']);
    expect(ai.resolveProviders({ ...KEYS, EMAIL_AI_BASE_URL: 'https://evil.example' }).map((p) => p.url)).toEqual(['https://api.anthropic.com/v1/messages', 'https://api.openai.com/v1/chat/completions', 'https://openrouter.ai/api/v1/chat/completions']);
  });

  test('every approval records which provider and model approved it, and changing the reviewer model does not void it', async () => {
    const layout = layoutMod.getLayout();
    const guidelines = await store.getBrandGuidelines();
    const settings = await store.getEmailSettings();
    const template = (await store.getEmailTemplates())[0];
    const stub = stubFetch([anthropicTool('email_review', { ...REVIEW, issues: [] })]);
    const client = ai.createAiClient({ fetchImpl: stub.impl, env: KEYS });
    const result = await gate.runGate({ fields: template.versions[0].fields, settings, guidelines }, { layout, ai: client, ctx: gate.reviewContext() });
    expect(result).toMatchObject({ passed: true, stopReason: 'passed' });
    expect(result.rounds[0].ai).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5' });
    const approval = gate.buildApproval(result, layout, guidelines);
    expect(approval).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5' });
    await store.recordGateOutcome(template.id, 1, { result, approval });
    const active = await store.setActiveVersion(template.id, 1, () => null);
    const version = active.versions[0];
    expect(version.approval).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', scores: { content: 93 } });

    // the reviewer model is a setting; changing it leaves the approval standing (it is not part of what the approval binds)
    await store.updateEmailSettings({ reviewModel: 'gpt-4.1' });
    expect((await store.getEmailSettings()).reviewModel).toBe('gpt-4.1');
    expect(gate.approvalState(version, layout, guidelines)).toEqual({ state: 'approved' });
    const sent = gate.verifyForSend({ template: active, settings: await store.getEmailSettings(), guidelines, layout, ctx: gate.reviewContext() });
    expect(sent.ok).toBe(true);
    expect(version.approval?.model).toBe('claude-opus-5-5'); // and the approval still says which model approved it
    expect(stub.calls).toHaveLength(1); // the send check made no AI call
  });

  // ─── Nothing is skipped silently: every call is recorded, named and shown ──────────────────────────────────────────

  test('classification: every way a call can fail has a name, and an Anthropic account with no credit is credit_exhausted', () => {
    // [what it is, status, error type, error code, message, expected outcome]
    const cases: Array<[string, number, string, string, string, string]> = [
      ['Anthropic: no credit (a 400, not a billing status)', 400, 'invalid_request_error', '', CREDIT_MESSAGE, 'credit_exhausted'],
      ['OpenAI: no quota', 429, 'insufficient_quota', 'insufficient_quota', 'You exceeded your current quota, please check your plan and billing details.', 'credit_exhausted'],
      ['OpenAI: billing hard limit', 400, 'invalid_request_error', 'billing_hard_limit_reached', 'Billing hard limit has been reached', 'credit_exhausted'],
      ['OpenRouter: payment required', 402, '', '402', 'Insufficient credits. Add more using https://openrouter.ai/credits', 'credit_exhausted'],
      ['Anthropic: rejected key', 401, 'authentication_error', '', 'invalid x-api-key', 'invalid_key'],
      ['OpenAI: rejected key', 401, 'invalid_request_error', 'invalid_api_key', 'Incorrect API key provided.', 'invalid_key'],
      ['OpenRouter: dead key', 401, '', '401', 'User not found.', 'invalid_key'],
      ['Anthropic: the key may not use this', 403, 'permission_error', '', 'Your API key does not have permission to use the specified resource.', 'forbidden'],
      ['Anthropic: no such model', 404, 'not_found_error', '', 'model: claude-opus-9', 'unknown_model'],
      ['OpenAI: no such model', 404, 'invalid_request_error', 'model_not_found', 'The model `gpt-9` does not exist or you do not have access to it.', 'unknown_model'],
      ['no such model, said in a 400', 400, 'invalid_request_error', '', 'The model gpt-9 does not exist', 'unknown_model'],
      ['Anthropic: rate limit', 429, 'rate_limit_error', '', 'Number of request tokens has exceeded your per-minute rate limit', 'rate_limited'],
      ['OpenAI: rate limit', 429, 'requests', 'rate_limit_exceeded', 'Rate limit reached for gpt-5.4 on requests per min.', 'rate_limited'],
      ['Anthropic: overloaded', 529, 'overloaded_error', '', 'Overloaded', 'overloaded'],
      ['a server error', 500, 'api_error', '', 'Internal server error', 'server_error'],
      ['a gateway error', 502, '', '', '', 'server_error'],
      ['a gateway timeout', 504, '', '', '', 'timeout'],
      ['a refused request', 400, 'invalid_request_error', '', 'max_tokens: must be greater than 0', 'bad_request'],
      ['an error with no body', 418, '', '', '', 'bad_request'],
    ];
    for (const [what, status, type, code, message, expected] of cases) expect(ai.classifyHttpFailure(status, type, code, message), what).toBe(expected);
    // only OpenAI's reasoning models get the reasoning-model request
    for (const model of ['gpt-5', 'gpt-5.4', 'gpt-5-mini', 'gpt-6', 'o3', 'o4-mini']) expect(ai.isReasoningModel(model), model).toBe(true);
    for (const model of ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'claude-opus-5-5', 'openai/gpt-5.4', 'google/gemini-2.5-pro']) expect(ai.isReasoningModel(model), model).toBe(false);
  });

  test('each failure is recorded with its outcome, status and code, and only what may clear by itself is tried again', async () => {
    const anthropicOnly = { ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY };
    const openAiOnly = { OPENAI_API_KEY: KEYS.OPENAI_API_KEY };
    const routerOnly = { OPENROUTER_API_KEY: KEYS.OPENROUTER_API_KEY };
    const tool = (input: unknown) => anthropicTool('email_review', input);
    const notJson = () => new Response('<html>Bad gateway</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    const noToolCall = () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'I cannot help with that.' }] }), { status: 200 });
    const abort = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    // [what, script, the keys present, the outcome of every call in order, how many requests were made]
    const rows: Array<[string, Step[], Record<string, string>, string[], number]> = [
      ['Anthropic account with no credit', [anthropicCreditLow], anthropicOnly, ['credit_exhausted', 'credit_exhausted'], 2],
      ['rejected key', [apiError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })], anthropicOnly, ['invalid_key', 'invalid_key'], 2],
      ['key that may not use the model', [apiError(403, { type: 'error', error: { type: 'permission_error', message: 'Your API key does not have permission to use the specified resource.' } })], anthropicOnly, ['forbidden', 'forbidden'], 2],
      ['no such model', [apiError(404, { type: 'error', error: { type: 'not_found_error', message: 'model: claude-opus-5-5' } })], anthropicOnly, ['unknown_model', 'unknown_model'], 2],
      ['refused request', [apiError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens: must be greater than 0' } })], anthropicOnly, ['bad_request', 'bad_request'], 2],
      ['rate limit (tried once more on each model)', [apiError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'Rate limit reached' } })], anthropicOnly, ['rate_limited', 'rate_limited', 'rate_limited', 'rate_limited'], 4],
      ['overload (tried once more on each model)', [apiError(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } })], anthropicOnly, ['overloaded', 'overloaded', 'overloaded', 'overloaded'], 4],
      ['server error (tried once more on each model)', [apiError(500, { type: 'error', error: { type: 'api_error', message: 'Internal server error' } })], anthropicOnly, ['server_error', 'server_error', 'server_error', 'server_error'], 4],
      ['network failure (tried once more on each model)', [new TypeError('fetch failed')], anthropicOnly, ['network', 'network', 'network', 'network'], 4],
      ['a call that timed out (tried once more on each model)', [abort], anthropicOnly, ['timeout', 'timeout', 'timeout', 'timeout'], 4],
      ['an answer with no tool call', [noToolCall], anthropicOnly, ['bad_shape', 'bad_shape', 'bad_shape', 'bad_shape'], 4],
      ['an answer that is not JSON', [notJson], anthropicOnly, ['bad_shape', 'bad_shape', 'bad_shape', 'bad_shape'], 4],
      ['an answer of the wrong shape', [tool({ scores: { content: 90 } })], anthropicOnly, ['bad_shape', 'bad_shape', 'bad_shape', 'bad_shape'], 4],
      ['OpenAI account with no quota', [apiError(429, { error: { message: 'You exceeded your current quota, please check your plan and billing details.', type: 'insufficient_quota', code: 'insufficient_quota' } })], openAiOnly, ['credit_exhausted', 'credit_exhausted'], 2],
      ['OpenRouter dead key', [apiError(401, { error: { message: 'User not found.', code: 401 } })], routerOnly, ['invalid_key'], 1],
      ['OpenRouter account with no credit', [apiError(402, { error: { message: 'Insufficient credits. Add more using https://openrouter.ai/credits', code: 402 } })], routerOnly, ['credit_exhausted'], 1],
    ];
    for (const [what, script, env, outcomes, requests] of rows) {
      const stub = stubFetch(script);
      const error = (await ai.createAiClient({ fetchImpl: stub.impl, env }).review(reviewInput()).catch((err: Error) => err)) as Error & { attempts: AttemptRecord[] };
      expect(error, what).toBeInstanceOf(Error);
      expect(error.attempts.map((a) => a.outcome), what).toEqual(outcomes);
      expect(stub.calls, what).toHaveLength(requests);
    }

    // what is recorded for one of them, in full: the credit failure on Opus, then on Sonnet (never retried), in order
    const credit = stubFetch([anthropicCreditLow]);
    const failure = (await ai.createAiClient({ fetchImpl: credit.impl, env: anthropicOnly }).review(reviewInput()).catch((err: Error) => err)) as InstanceType<typeof ai.AiUnavailableError>;
    expect(failure).toBeInstanceOf(ai.AiUnavailableError);
    expect(failure).toMatchObject({ reason: 'http', message: 'The anthropic reviewer answered HTTP 400.' });
    expect(failure.attempts).toHaveLength(2);
    expect(failure.attempts[0]).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', attempt: 1, outcome: 'credit_exhausted', httpStatus: 400, code: 'invalid_request_error', detail: CREDIT_MESSAGE });
    expect(failure.attempts[1]).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-5-5', attempt: 1, outcome: 'credit_exhausted', httpStatus: 400 });
    expect(Number.isNaN(Date.parse(failure.attempts[0].at))).toBe(false);
    expect(failure.attempts[0].ms).toBeGreaterThanOrEqual(0);
    // a retried model is recorded once per try, numbered
    const limited = stubFetch([apiError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'Rate limit reached' } })]);
    const waiting = (await ai.createAiClient({ fetchImpl: limited.impl, env: anthropicOnly }).review(reviewInput()).catch((err: Error) => err)) as InstanceType<typeof ai.AiUnavailableError>;
    expect(waiting.attempts.map((a) => [a.model, a.attempt, a.httpStatus])).toEqual([['claude-opus-5-5', 1, 429], ['claude-opus-5-5', 2, 429], ['claude-sonnet-5-5', 1, 429], ['claude-sonnet-5-5', 2, 429]]);
    // the codes that say what went wrong inside an answer that was not usable
    const shape = (script: Step) => stubFetch([script]);
    for (const [script, code, what] of [[noToolCall, 'no_tool_call', 'no tool call'], [notJson, 'not_json', 'not JSON'], [tool({ scores: { content: 90 } }), 'wrong_shape', 'wrong shape']] as Array<[Step, string, string]>) {
      const invalid = (await ai.createAiClient({ fetchImpl: shape(script).impl, env: anthropicOnly }).review(reviewInput()).catch((err: Error) => err)) as InstanceType<typeof ai.AiInvalidResponseError>;
      expect(invalid, what).toBeInstanceOf(ai.AiInvalidResponseError);
      expect(invalid.attempts.map((a) => a.code), what).toEqual([code, code, code, code]);
    }
    // OpenRouter says "User not found." with a numeric code
    const dead = stubFetch([apiError(401, { error: { message: 'User not found.', code: 401 } })]);
    const router = (await ai.createAiClient({ fetchImpl: dead.impl, env: routerOnly }).review(reviewInput()).catch((err: Error) => err)) as InstanceType<typeof ai.AiUnavailableError>;
    expect(router.attempts[0]).toMatchObject({ provider: 'openrouter', model: 'openai/gpt-4.1-mini', outcome: 'invalid_key', httpStatus: 401, code: '401', detail: 'User not found.' });
  });

  test('a call that is never answered is cut off by the timeout and recorded as one', async () => {
    const hang = (async (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })));
      })) as unknown as typeof fetch;
    const error = (await ai.createAiClient({ fetchImpl: hang, env: { ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY }, timeoutMs: 30 }).review(reviewInput()).catch((err: Error) => err)) as InstanceType<typeof ai.AiUnavailableError>;
    expect(error).toBeInstanceOf(ai.AiUnavailableError);
    expect(error.reason).toBe('timeout');
    expect(error.attempts.map((a) => [a.model, a.attempt, a.outcome, a.code, a.httpStatus ?? null])).toEqual([
      ['claude-opus-5-5', 1, 'timeout', 'timeout', null],
      ['claude-opus-5-5', 2, 'timeout', 'timeout', null],
      ['claude-sonnet-5-5', 1, 'timeout', 'timeout', null],
      ['claude-sonnet-5-5', 2, 'timeout', 'timeout', null],
    ]);
  });

  test('an answer whose body is still arriving when the timeout hits is a timeout, not an answer that was not JSON', async () => {
    const slowBody = (async (_url: string, init: RequestInit) => ({
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })));
        }),
    })) as unknown as typeof fetch;
    const error = (await ai.createAiClient({ fetchImpl: slowBody, env: { OPENAI_API_KEY: KEYS.OPENAI_API_KEY }, timeoutMs: 30 }).review(reviewInput()).catch((err: Error) => err)) as InstanceType<typeof ai.AiUnavailableError>;
    expect(error).toBeInstanceOf(ai.AiUnavailableError);
    expect(error.reason).toBe('timeout');
    expect(error.attempts.map((a) => [a.model, a.attempt, a.outcome, a.httpStatus ?? null])).toEqual([
      ['gpt-5.4', 1, 'timeout', 200],
      ['gpt-5.4', 2, 'timeout', 200],
      ['gpt-4.1-mini', 1, 'timeout', 200],
      ['gpt-4.1-mini', 2, 'timeout', 200],
    ]);
  });

  test('the incident: Claude has no credit, so Opus and Sonnet are skipped without a retry, GPT-5.4 judges, and the review says why', async () => {
    const stub = routedFetch((call) => (call.url.startsWith('https://api.anthropic.com') ? anthropicCreditLow() : openAiText(REVIEW)()));
    const client = ai.createAiClient({ fetchImpl: stub.impl, env: KEYS });
    const review = await client.review(reviewInput());
    // exactly three requests: no retry of an account that has no credit, and nothing after the first answer
    expect(stub.calls.map((c) => `${new URL(c.url).hostname} ${String(c.body.model)}`)).toEqual(['api.anthropic.com claude-opus-5-5', 'api.anthropic.com claude-sonnet-5-5', 'api.openai.com gpt-5.4']);
    expect(review).toMatchObject({ provider: 'openai', model: 'gpt-5.4', verdict: 'pass' });
    expect(review.attempts?.map((a) => [a.provider, a.model, a.attempt, a.outcome, a.httpStatus ?? null])).toEqual([
      ['anthropic', 'claude-opus-5-5', 1, 'credit_exhausted', 400],
      ['anthropic', 'claude-sonnet-5-5', 1, 'credit_exhausted', 400],
      ['openai', 'gpt-5.4', 1, 'ok', null],
    ]);
    expect(review.attempts?.[0]).toMatchObject({ code: 'invalid_request_error', detail: CREDIT_MESSAGE });
    expect(review.attempts?.[2].detail).toBeUndefined();
    for (const key of Object.values(KEYS)) expect(JSON.stringify(review)).not.toContain(key);

    // the fix step records its calls the same way
    const fixStub = routedFetch((call) => (call.url.startsWith('https://api.anthropic.com') ? anthropicCreditLow() : openAiText(FIX)()));
    const fix = await ai.createAiClient({ fetchImpl: fixStub.impl, env: KEYS }).fix({ fields: seed.SEED_WELCOME_FIELDS, issues: [], changeable: ['body'], guidelines: reviewInput().guidelines, threshold: 85, model: '', allowedLinkDomains: ['abentertainment.com.au'] });
    expect(fix).toMatchObject({ provider: 'openai', model: 'gpt-5.4' });
    expect(fix.attempts?.map((a) => `${a.model}:${a.outcome}`)).toEqual(['claude-opus-5-5:credit_exhausted', 'claude-sonnet-5-5:credit_exhausted', 'gpt-5.4:ok']);
    expect(fixStub.calls).toHaveLength(3);
  });

  test('what a provider says is kept without a key or an address', async () => {
    const env = { ANTHROPIC_API_KEY: 'plain-secret-without-a-prefix', OPENAI_API_KEY: KEYS.OPENAI_API_KEY };
    const message = `Invalid credentials plain-secret-without-a-prefix and sk-ant-api03-AbCdEf0123456789 for abhi.sarkar@example.com ${'Z'.repeat(40)}\n\n   extra   spaces`;
    const stub = routedFetch((call) => (call.url.startsWith('https://api.anthropic.com') ? apiError(401, { type: 'error', error: { type: 'authentication_error', message } })() : openAiText(REVIEW)()));
    const review = await ai.createAiClient({ fetchImpl: stub.impl, env }).review(reviewInput());
    expect(review.attempts?.[0]).toMatchObject({ outcome: 'invalid_key', detail: 'Invalid credentials [key] and [key] for [address] [token] extra spaces' });
    const kept = JSON.stringify(review.attempts);
    for (const secret of ['plain-secret-without-a-prefix', 'AbCdEf0123456789', 'abhi.sarkar', 'example.com', 'ZZZZZZZZ']) expect(kept, secret).not.toContain(secret);

    // the same through the error when nothing could answer
    const down = routedFetch(() => apiError(401, { type: 'error', error: { type: 'authentication_error', message } })());
    const error = (await ai.createAiClient({ fetchImpl: down.impl, env }).review(reviewInput()).catch((err: Error) => err)) as InstanceType<typeof ai.AiUnavailableError>;
    expect(JSON.stringify(error.attempts)).not.toContain('plain-secret-without-a-prefix');
    expect(error.message).not.toContain('plain-secret-without-a-prefix');

    // the scrubbing itself
    expect(scrub.scrubDetail('Bad key sk-ant-api03-AbCdEf0123456789 for abhi@example.com')).toBe('Bad key [key] for [address]');
    expect(scrub.scrubDetail('re_local_test_0123456789abcdef was refused')).toBe('[key] was refused');
    expect(scrub.scrubDetail('Rate limit reached for gpt-5.4 in organization org-AbCdEf0123456789xyz on tokens per min (TPM), project proj_Zz9Yy8Xx7Ww6')).toBe('Rate limit reached for gpt-5.4 in organization [account] on tokens per min (TPM), project [account]');
    expect(scrub.scrubDetail('custom-secret-value', ['custom-secret-value'])).toBe('[key]');
    expect(scrub.scrubDetail('short', ['ort'])).toBe('short'); // a secret too short to be one is not searched for
    expect(scrub.scrubDetail('Please re-authenticate and try again')).toBe('Please re-authenticate and try again'); // plain words are not keys
    expect(scrub.scrubDetail(`${'word '.repeat(100)}`)).toHaveLength(199);
    expect(scrub.scrubDetail('line one\n\n   line two')).toBe('line one line two');
    expect(scrub.scrubDetail(undefined)).toBe('');
    expect(scrub.scrubDetail(42)).toBe('');
  });

  test('the request to OpenAI: GPT-5.x gets the reasoning-model shape from the official docs, the older models keep theirs', async () => {
    const only = { OPENAI_API_KEY: KEYS.OPENAI_API_KEY };
    const five = stubFetch([openAiText(REVIEW)]);
    const review = await ai.createAiClient({ fetchImpl: five.impl, env: only }).review(reviewInput());
    const call = five.calls[0];
    expect(call.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(call.headers).toEqual({ 'Content-Type': 'application/json', Authorization: `Bearer ${KEYS.OPENAI_API_KEY}` });
    // exactly these fields: max_completion_tokens (not max_tokens), reasoning_effort, and none of temperature, top_p, max_tokens
    expect(Object.keys(call.body).sort()).toEqual(['max_completion_tokens', 'messages', 'model', 'reasoning_effort', 'response_format']);
    expect(call.body).toMatchObject({ model: 'gpt-5.4', max_completion_tokens: 16000, reasoning_effort: 'medium' });
    const messages = call.body.messages as Array<{ role: string; content: string }>;
    expect(messages.map((m) => m.role)).toEqual(['developer', 'user']);
    expect(messages[0].content).toContain('quality reviewer');
    expect(messages[1].content).toContain('The AB Entertainment Community');
    const format = call.body.response_format as { type: string; json_schema: { name: string; strict: boolean; schema: { type: string; additionalProperties: boolean; required: string[] } } };
    expect(format.type).toBe('json_schema');
    expect(format.json_schema).toMatchObject({ name: 'email_review', strict: true, schema: { type: 'object', additionalProperties: false, required: ['scores', 'verdict', 'summary', 'issues'] } });
    expect(review).toMatchObject({ provider: 'openai', model: 'gpt-5.4', verdict: 'pass', scores: REVIEW.scores });
    expect(JSON.stringify(call.body)).not.toContain(KEYS.OPENAI_API_KEY);

    // the fix step has the same shape with its own schema
    const fixStub = stubFetch([openAiText(FIX)]);
    await ai.createAiClient({ fetchImpl: fixStub.impl, env: only }).fix({ fields: seed.SEED_WELCOME_FIELDS, issues: [], changeable: ['body'], guidelines: reviewInput().guidelines, threshold: 85, model: '', allowedLinkDomains: ['abentertainment.com.au'] });
    expect(Object.keys(fixStub.calls[0].body).sort()).toEqual(['max_completion_tokens', 'messages', 'model', 'reasoning_effort', 'response_format']);
    expect(fixStub.calls[0].body).toMatchObject({ model: 'gpt-5.4', max_completion_tokens: 16000, reasoning_effort: 'medium', response_format: { type: 'json_schema', json_schema: { name: 'email_fix', strict: true } } });
    expect((fixStub.calls[0].body.messages as Array<{ role: string }>).map((m) => m.role)).toEqual(['developer', 'user']);

    // GPT-4.1 mini keeps the chat shape it always had
    const mini = stubFetch([openAiText(REVIEW)]);
    await ai.createAiClient({ fetchImpl: mini.impl, env: only }).review(reviewInput('gpt-4.1-mini'));
    expect(Object.keys(mini.calls[0].body).sort()).toEqual(['max_tokens', 'messages', 'model', 'response_format', 'temperature']);
    expect(mini.calls[0].body).toMatchObject({ model: 'gpt-4.1-mini', temperature: 0.2, max_tokens: 2000, response_format: { type: 'json_schema' } });
    expect((mini.calls[0].body.messages as Array<{ role: string }>).map((m) => m.role)).toEqual(['system', 'user']);

    // an administrator-chosen reasoning model (o3) gets the reasoning shape; OpenRouter keeps the chat shape whatever the model
    const o3 = stubFetch([openAiText(REVIEW)]);
    await ai.createAiClient({ fetchImpl: o3.impl, env: only }).review(reviewInput('o3'));
    expect(o3.calls[0].body).toMatchObject({ model: 'o3', max_completion_tokens: 16000, reasoning_effort: 'medium' });
    expect('temperature' in o3.calls[0].body || 'max_tokens' in o3.calls[0].body).toBe(false);
    const routed = stubFetch([openAiText(REVIEW)]);
    await ai.createAiClient({ fetchImpl: routed.impl, env: { OPENROUTER_API_KEY: KEYS.OPENROUTER_API_KEY } }).review(reviewInput('openai/gpt-5.4'));
    expect(routed.calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(routed.calls[0].body).toMatchObject({ model: 'openai/gpt-5.4', temperature: 0.2, max_tokens: 2000, response_format: { type: 'json_object' } });
  });

  test('a model that does not take reasoning_effort is asked again without it, once; any other refusal moves on to the next model', async () => {
    const only = { OPENAI_API_KEY: KEYS.OPENAI_API_KEY };
    const unsupported = apiError(400, { error: { message: "Unsupported value: 'reasoning_effort' does not support 'medium' with this model.", type: 'invalid_request_error', param: 'reasoning_effort', code: 'unsupported_value' } });
    const stub = stubFetch([unsupported, openAiText(REVIEW)]);
    const review = await ai.createAiClient({ fetchImpl: stub.impl, env: only }).review(reviewInput());
    expect(stub.calls.map((c) => [c.body.model, 'reasoning_effort' in c.body])).toEqual([['gpt-5.4', true], ['gpt-5.4', false]]);
    expect(stub.calls[1].body).toMatchObject({ max_completion_tokens: 16000, response_format: { type: 'json_schema' } });
    expect(review).toMatchObject({ provider: 'openai', model: 'gpt-5.4' });
    expect(review.attempts?.map((a) => [a.model, a.outcome, a.httpStatus ?? null])).toEqual([['gpt-5.4', 'bad_request', 400], ['gpt-5.4', 'ok', null]]);

    // a refusal that names it only in its words (no param) is answered the same way
    const unknownArgument = apiError(400, { error: { message: 'Unrecognized request argument supplied: reasoning_effort', type: 'invalid_request_error', param: null, code: null } });
    const worded = stubFetch([unknownArgument, openAiText(REVIEW)]);
    const viaWords = await ai.createAiClient({ fetchImpl: worded.impl, env: only }).review(reviewInput());
    expect(worded.calls.map((c) => [c.body.model, 'reasoning_effort' in c.body])).toEqual([['gpt-5.4', true], ['gpt-5.4', false]]);
    expect(viaWords.model).toBe('gpt-5.4');

    // asked without it and refused again: not a third time; the next model
    const stubborn = stubFetch([unsupported, unsupported, openAiText(REVIEW)]);
    const next = await ai.createAiClient({ fetchImpl: stubborn.impl, env: only }).review(reviewInput());
    expect(stubborn.calls.map((c) => c.body.model)).toEqual(['gpt-5.4', 'gpt-5.4', 'gpt-4.1-mini']);
    expect(next.model).toBe('gpt-4.1-mini');

    // any other 400 is not retried: it moves straight on to the next model, whose request is the older chat shape
    const other = apiError(400, { error: { message: "Unsupported parameter: 'max_completion_tokens' is not supported with this model.", type: 'invalid_request_error', param: 'max_completion_tokens', code: 'unsupported_parameter' } });
    const second = stubFetch([other, openAiText(REVIEW)]);
    const moved = await ai.createAiClient({ fetchImpl: second.impl, env: only }).review(reviewInput());
    expect(second.calls.map((c) => c.body.model)).toEqual(['gpt-5.4', 'gpt-4.1-mini']);
    expect(second.calls[1].body).toMatchObject({ temperature: 0.2, max_tokens: 2000 });
    expect(moved.attempts?.map((a) => [a.model, a.outcome])).toEqual([['gpt-5.4', 'bad_request'], ['gpt-4.1-mini', 'ok']]);
  });

  test('the gate keeps every call of every round: the model it fell back to, the fix, and the rounds after', async () => {
    const layout = layoutMod.getLayout();
    const guidelines = await store.getBrandGuidelines();
    const settings = await store.getEmailSettings();
    const template = (await store.getEmailTemplates())[0];
    const failing = { ...REVIEW, scores: { content: 90, brand: 88, tone: 70, language: 92, quality: 86 }, verdict: 'fail', summary: 'Too casual.', issues: [{ dimension: 'tone', field: 'body', severity: 'major', message: 'Too casual for the brand voice.', suggestion: 'Raise the register.' }] };
    const passing = { ...REVIEW, issues: [] };
    const rewrite = { ...FIX, fixes: { ...FIX.fixes, body: 'Thank you for joining the AB Entertainment community. Your place in this audience is a privilege, and it is warmly welcomed.\n\nAB Entertainment presents the performing arts of India and Maharashtra to Melbourne with meticulous care, so that you, and those who join you, may experience an evening like no other.' } };
    let reviews = 0;
    const stub = routedFetch((call) => {
      if (call.url.startsWith('https://api.anthropic.com')) return anthropicCreditLow();
      const name = (call.body.response_format as { json_schema: { name: string } }).json_schema.name;
      if (name === 'email_fix') return openAiText(rewrite)();
      reviews += 1;
      return openAiText(reviews === 1 ? failing : passing)();
    });
    const result = await gate.runGate({ fields: template.versions[0].fields, settings, guidelines }, { layout, ai: ai.createAiClient({ fetchImpl: stub.impl, env: KEYS }), ctx: gate.reviewContext() });
    expect(result).toMatchObject({ passed: true, stopReason: 'passed' });
    expect(result.rounds).toHaveLength(2);
    const names = (attempts?: AttemptRecord[]) => attempts?.map((a) => `${a.model}:${a.outcome}`);
    const SKIPPED_THEN_GPT = ['claude-opus-5-5:credit_exhausted', 'claude-sonnet-5-5:credit_exhausted', 'gpt-5.4:ok'];
    expect(names(result.rounds[0].aiAttempts)).toEqual(SKIPPED_THEN_GPT);
    expect(names(result.rounds[0].fixAttempts)).toEqual(SKIPPED_THEN_GPT);
    expect(names(result.rounds[1].aiAttempts)).toEqual(SKIPPED_THEN_GPT);
    expect(result.rounds[1].fixAttempts).toBeUndefined();
    expect(stub.calls).toHaveLength(9);
    expect(result.rounds[0].ai).toMatchObject({ provider: 'openai', model: 'gpt-5.4' });
    expect('attempts' in (result.rounds[0].ai ?? {})).toBe(false); // kept once, on the round
    expect(gate.buildApproval(result, layout, guidelines)).toMatchObject({ provider: 'openai', model: 'gpt-5.4' });

    // the record stays with the version, so it can be read again after a reload
    const approval = gate.buildApproval(result, layout, guidelines);
    await store.recordGateOutcome(template.id, 1, { result, approval });
    const stored = (await store.getEmailTemplates())[0].versions[0].review;
    expect(names(stored?.rounds[0].aiAttempts)).toEqual(SKIPPED_THEN_GPT);
    expect(stored?.rounds[0].aiAttempts?.[0]).toMatchObject({ outcome: 'credit_exhausted', httpStatus: 400, detail: CREDIT_MESSAGE });
  });

  test('when no model can judge, the round says so and lists every model that was asked, and the gate blocks', async () => {
    const layout = layoutMod.getLayout();
    const guidelines = await store.getBrandGuidelines();
    const settings = await store.getEmailSettings();
    const template = (await store.getEmailTemplates())[0];
    const dead = routedFetch((call) => {
      if (call.url.startsWith('https://api.anthropic.com')) return anthropicCreditLow();
      if (call.url.startsWith('https://api.openai.com')) return apiError(429, { error: { message: 'You exceeded your current quota, please check your plan and billing details.', type: 'insufficient_quota', code: 'insufficient_quota' } })();
      return apiError(401, { error: { message: 'User not found.', code: 401 } })();
    });
    const blocked = await gate.runGate({ fields: template.versions[0].fields, settings, guidelines }, { layout, ai: ai.createAiClient({ fetchImpl: dead.impl, env: KEYS }), ctx: gate.reviewContext() });
    expect(blocked).toMatchObject({ passed: false, stopReason: 'ai_unavailable' });
    const round = blocked.rounds[0];
    expect(round).toMatchObject({ ai: null, aiError: 'unavailable', aiErrorDetail: 'The openrouter reviewer answered HTTP 401.' });
    expect(round.aiAttempts?.map((a) => `${a.provider}:${a.model}:${a.outcome}`)).toEqual([
      'anthropic:claude-opus-5-5:credit_exhausted',
      'anthropic:claude-sonnet-5-5:credit_exhausted',
      'openai:gpt-5.4:credit_exhausted',
      'openai:gpt-4.1-mini:credit_exhausted',
      'openrouter:openai/gpt-4.1-mini:invalid_key',
    ]);
    expect(dead.calls).toHaveLength(5); // none of them is a kind of failure that is tried again
    for (const key of Object.values(KEYS)) expect(JSON.stringify(blocked)).not.toContain(key);

    // an answer that cannot be used is recorded the same way
    const odd = routedFetch(() => new Response(JSON.stringify({ content: [{ type: 'text', text: 'No.' }] }), { status: 200 }));
    const unusable = await gate.runGate({ fields: template.versions[0].fields, settings, guidelines }, { layout, ai: ai.createAiClient({ fetchImpl: odd.impl, env: { ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY } }), ctx: gate.reviewContext() });
    expect(unusable.rounds[0]).toMatchObject({ aiError: 'invalid_response' });
    expect(unusable.rounds[0].aiAttempts?.map((a) => `${a.model}#${a.attempt}:${a.outcome}:${a.code}`)).toEqual([
      'claude-opus-5-5#1:bad_shape:no_tool_call',
      'claude-opus-5-5#2:bad_shape:no_tool_call',
      'claude-sonnet-5-5#1:bad_shape:no_tool_call',
      'claude-sonnet-5-5#2:bad_shape:no_tool_call',
    ]);
  });

  test('the last outcome of each model is kept and shown: which judge is in use, and why the ones before it are not', async () => {
    const at = (second: number) => `2026-10-14T01:00:${String(second).padStart(2, '0')}.000Z`;
    const attempt = (provider: AttemptRecord['provider'], model: string, outcome: AttemptRecord['outcome'], second: number, extra: Partial<AttemptRecord> = {}): AttemptRecord => ({ provider, model, attempt: 1, outcome, ms: 120, at: at(second), ...extra });
    const credit = { httpStatus: 400, code: 'invalid_request_error', detail: CREDIT_MESSAGE };

    // before anything has been called: nothing is known, and the first model is the one in use
    const fresh = await sender.getSendingStatus({ env: KEYS });
    expect(fresh.reviewer.availability.every((entry) => entry.outcome === null && entry.at === null && entry.httpStatus === null && entry.code === null && entry.detail === null)).toBe(true);
    expect(fresh.reviewer.inUse).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' });

    // the incident, as the review leaves it
    await reviewerState.recordReviewerAttempts([
      attempt('anthropic', 'claude-opus-5-5', 'credit_exhausted', 1, credit),
      attempt('anthropic', 'claude-sonnet-5-5', 'credit_exhausted', 2, credit),
      attempt('openai', 'gpt-5.4', 'ok', 9),
    ]);
    const status = await sender.getSendingStatus({ env: KEYS });
    expect(status.reviewer.availability).toEqual([
      { provider: 'anthropic', model: 'claude-opus-5-5', outcome: 'credit_exhausted', at: at(1), httpStatus: 400, code: 'invalid_request_error', detail: CREDIT_MESSAGE },
      { provider: 'anthropic', model: 'claude-sonnet-5-5', outcome: 'credit_exhausted', at: at(2), httpStatus: 400, code: 'invalid_request_error', detail: CREDIT_MESSAGE },
      { provider: 'openai', model: 'gpt-5.4', outcome: 'ok', at: at(9), httpStatus: null, code: null, detail: null },
      { provider: 'openai', model: 'gpt-4.1-mini', outcome: null, at: null, httpStatus: null, code: null, detail: null },
      { provider: 'openrouter', model: 'openai/gpt-4.1-mini', outcome: null, at: null, httpStatus: null, code: null, detail: null },
    ]);
    expect(status.reviewer.inUse).toEqual({ provider: 'openai', model: 'gpt-5.4' });
    expect(status.reviewer.chain).toEqual(status.reviewer.availability.map(({ provider, model }) => ({ provider, model })));

    // the file holds the outcomes and no key
    const raw = readFileSync(join(unitDir(), 'email-reviewer-state.json'), 'utf-8');
    expect(Object.keys((JSON.parse(raw) as { entries: Record<string, unknown> }).entries)).toEqual(expect.arrayContaining(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.4']));
    for (const key of Object.values(KEYS)) expect(raw).not.toContain(key);

    // a later outcome replaces an earlier one completely: once credit is added, Opus is the judge again
    await reviewerState.recordReviewerAttempts([attempt('anthropic', 'claude-opus-5-5', 'ok', 20)]);
    const topped = await sender.getSendingStatus({ env: KEYS });
    expect(topped.reviewer.availability[0]).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5', outcome: 'ok', at: at(20), httpStatus: null, code: null, detail: null });
    expect(topped.reviewer.inUse).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' });
    // a review that finished late must not overwrite what a newer call showed
    await reviewerState.recordReviewerAttempts([attempt('anthropic', 'claude-opus-5-5', 'credit_exhausted', 5, credit)]);
    expect((await sender.getSendingStatus({ env: KEYS })).reviewer.availability[0].outcome).toBe('ok');

    // the administrator's model goes first, and what is known about it is looked up by provider and model
    await store.updateEmailSettings({ reviewModel: 'claude-sonnet-5-5' });
    const chosen = await sender.getSendingStatus({ env: KEYS });
    expect(chosen.reviewer.setting).toBe('claude-sonnet-5-5');
    expect(chosen.reviewer.availability.map((entry) => `${entry.provider}:${entry.model}=${entry.outcome}`)).toEqual([
      'anthropic:claude-sonnet-5-5=credit_exhausted',
      'openrouter:anthropic/claude-sonnet-5-5=null',
      'anthropic:claude-opus-5-5=ok',
      'openai:gpt-5.4=ok',
      'openai:gpt-4.1-mini=null',
      'openrouter:openai/gpt-4.1-mini=null',
    ]);
    expect(chosen.reviewer.inUse).toEqual({ provider: 'openrouter', model: 'anthropic/claude-sonnet-5-5' }); // never called: not known to be failing
    await store.updateEmailSettings({ reviewModel: '' });

    // every model failing the last time it was asked: nothing is "in use"
    const onlyTwoProviders = { ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY, OPENAI_API_KEY: KEYS.OPENAI_API_KEY };
    await reviewerState.recordReviewerAttempts([
      attempt('anthropic', 'claude-opus-5-5', 'credit_exhausted', 30, credit),
      attempt('anthropic', 'claude-sonnet-5-5', 'credit_exhausted', 31, credit),
      attempt('openai', 'gpt-5.4', 'rate_limited', 32, { httpStatus: 429, code: 'rate_limit_exceeded', detail: 'Rate limit reached.' }),
      attempt('openai', 'gpt-4.1-mini', 'timeout', 33, { code: 'timeout', detail: 'No answer in time.' }),
    ]);
    const stuck = await sender.getSendingStatus({ env: onlyTwoProviders });
    expect(stuck.reviewer.inUse).toBeNull();
    expect(stuck.reviewer.availability.map((entry) => entry.outcome)).toEqual(['credit_exhausted', 'credit_exhausted', 'rate_limited', 'timeout']);
    // no key at all: nothing to show
    const none = await sender.getSendingStatus({ env: {} });
    expect(none.reviewer).toEqual({ setting: '', chain: [], availability: [], inUse: null });
  });

  test('the reviewer state is bounded, tolerates damage, and a round\'s calls are read in the order they were made', async () => {
    const at = (n: number) => new Date(Date.UTC(2026, 9, 14, 1, 0, n)).toISOString();
    const many: AttemptRecord[] = Array.from({ length: 45 }, (_, n) => ({ provider: 'openrouter', model: `vendor/model-${n}`, attempt: 1, outcome: 'ok', ms: 5, at: at(n) }));
    await reviewerState.recordReviewerAttempts(many);
    const kept = Object.keys((await reviewerState.readReviewerState()).entries);
    expect(kept).toHaveLength(40);
    expect(kept).toContain('openrouter:vendor/model-44');
    expect(kept).not.toContain('openrouter:vendor/model-0'); // the oldest are forgotten first

    // a damaged file does not stop the status or a review: entries of the wrong shape are ignored
    const file = join(unitDir(), 'email-reviewer-state.json');
    writeFileSync(file, JSON.stringify({ entries: { 'anthropic:claude-opus-5-5': 'oops', 'openai:gpt-5.4': { outcome: 'ok' }, 'openai:gpt-4.1-mini': { outcome: 'ok', at: at(1) } }, updatedAt: 'x' }), 'utf-8');
    const status = await sender.getSendingStatus({ env: KEYS });
    expect(status.reviewer.availability.map((entry) => entry.outcome)).toEqual([null, null, null, 'ok', null]);
    writeFileSync(file, '{ this is not json', 'utf-8');
    const unreadable = await sender.getSendingStatus({ env: KEYS });
    expect(unreadable.reviewer.availability.every((entry) => entry.outcome === null)).toBe(true);
    expect(unreadable.reviewer.inUse).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' });

    // a round's review and fix calls, oldest first
    const round = { round: 1, aiAttempts: [{ provider: 'openai', model: 'gpt-5.4', attempt: 1, outcome: 'ok', ms: 1, at: at(10) }], fixAttempts: [{ provider: 'anthropic', model: 'claude-opus-5-5', attempt: 1, outcome: 'credit_exhausted', ms: 1, at: at(5) }] } as unknown as import('@/lib/email/types').GateRound;
    expect(reviewerState.attemptsOfRound(round).map((a) => a.model)).toEqual(['claude-opus-5-5', 'gpt-5.4']);
    expect(reviewerState.attemptsOfRound({ round: 2 } as unknown as import('@/lib/email/types').GateRound)).toEqual([]);
  });
});
