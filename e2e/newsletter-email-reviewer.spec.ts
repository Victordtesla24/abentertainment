/**
 * The AI reviewer chain: Anthropic first (Claude Opus 5.5, then Claude Sonnet 5.5), then OpenAI, then OpenRouter, with
 * the administrator's model choice going first. In-process, against a stubbed fetch: nothing here has a key or a network.
 * The request to Anthropic's Messages API is asserted at the boundary (URL, headers, forced tool call), every fallback
 * step is exercised, and the approval is shown to record which provider and model approved it.
 */

import { test, expect } from '@playwright/test';
import { cleanUnitDir, loadWithUnitDir } from './support/email-unit';

type Ai = typeof import('@/lib/email/ai-review');
type Gate = typeof import('@/lib/email/gate');
type Store = typeof import('@/lib/email/store');
type Seed = typeof import('@/lib/email/seed');
type LayoutMod = typeof import('@/lib/email/layout');

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

  test.beforeAll(() => {
    loadWithUnitDir(() => {
      ai = require('@/lib/email/ai-review') as Ai;
      gate = require('@/lib/email/gate') as Gate;
      store = require('@/lib/email/store') as Store;
      seed = require('@/lib/email/seed') as Seed;
      layoutMod = require('@/lib/email/layout') as LayoutMod;
    });
  });

  test.beforeEach(() => cleanUnitDir());

  const chain = (env: Record<string, string>, setting = '') => ai.reviewerChain(env, setting).map((a) => `${a.provider}:${a.model}`);
  const reviewInput = (model = '') => ({ fields: seed.SEED_WELCOME_FIELDS, plainText: 'plain text', guidelines: { text: seed.DEFAULT_GUIDELINES_TEXT, version: 1, updatedAt: '', updatedBy: '' }, threshold: 85, model });

  test('the default chain: Claude Opus 5.5, Claude Sonnet 5.5, then OpenAI, then OpenRouter, and only for the keys that exist', () => {
    expect(chain(KEYS)).toEqual(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain({ ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY })).toEqual(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5']);
    expect(chain({ OPENAI_API_KEY: KEYS.OPENAI_API_KEY })).toEqual(['openai:gpt-4.1-mini']);
    expect(chain({ OPENAI_API_KEY: KEYS.OPENAI_API_KEY, OPENROUTER_API_KEY: KEYS.OPENROUTER_API_KEY })).toEqual(['openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain({})).toEqual([]);
    expect(ai.configuredAiProviders(KEYS)).toEqual(['anthropic', 'openai', 'openrouter']);
    expect(ai.configuredAiProviders({ OPENAI_API_KEY: KEYS.OPENAI_API_KEY })).toEqual(['openai']);
    expect(ai.configuredAiProviders({})).toEqual([]);
    expect(ai.ANTHROPIC_DEFAULT_MODELS).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5']);
  });

  test('the administrator\'s model goes first on the provider that serves it, then the same model through OpenRouter, then the default chain', () => {
    expect(chain(KEYS, 'claude-sonnet-5-5')).toEqual(['anthropic:claude-sonnet-5-5', 'openrouter:anthropic/claude-sonnet-5-5', 'anthropic:claude-opus-5-5', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain(KEYS, 'claude-haiku-4-5')).toEqual(['anthropic:claude-haiku-4-5', 'openrouter:anthropic/claude-haiku-4-5', 'anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain(KEYS, 'anthropic/claude-opus-5-5')).toEqual(['anthropic:claude-opus-5-5', 'openrouter:anthropic/claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain(KEYS, 'gpt-4.1')).toEqual(['openai:gpt-4.1', 'openrouter:openai/gpt-4.1', 'anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain(KEYS, 'openai/gpt-4.1')).toEqual(chain(KEYS, 'gpt-4.1'));
    expect(chain(KEYS, 'google/gemini-2.5-pro')).toEqual(['openrouter:google/gemini-2.5-pro', 'anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
    // the default model chosen explicitly is the default chain
    expect(chain({ ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY }, 'claude-opus-5-5')).toEqual(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5']);
    // a model whose provider has no key: the default chain, with OpenRouter (when present) carrying the choice
    expect(chain({ ANTHROPIC_API_KEY: KEYS.ANTHROPIC_API_KEY }, 'gpt-4.1')).toEqual(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5']);
    expect(chain({ OPENROUTER_API_KEY: KEYS.OPENROUTER_API_KEY }, 'claude-sonnet-5-5')).toEqual(['openrouter:anthropic/claude-sonnet-5-5', 'openrouter:openai/gpt-4.1-mini']);
    expect(chain({ OPENAI_API_KEY: KEYS.OPENAI_API_KEY, OPENROUTER_API_KEY: KEYS.OPENROUTER_API_KEY }, 'claude-sonnet-5-5')).toEqual(['openrouter:anthropic/claude-sonnet-5-5', 'openai:gpt-4.1-mini', 'openrouter:openai/gpt-4.1-mini']);
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

    // a rejected key (401) is not retried; both Claude models are tried and then OpenAI answers
    const rejected = stubFetch([httpError(401), httpError(401), openAiText(REVIEW)]);
    const third = await ai.createAiClient({ fetchImpl: rejected.impl, env: KEYS }).review(reviewInput());
    expect(rejected.calls.map((c) => c.url)).toEqual(['https://api.anthropic.com/v1/messages', 'https://api.anthropic.com/v1/messages', 'https://api.openai.com/v1/chat/completions']);
    expect(rejected.calls[2].headers.Authorization).toBe(`Bearer ${KEYS.OPENAI_API_KEY}`);
    expect(rejected.calls[2].body).toMatchObject({ model: 'gpt-4.1-mini' });
    expect(third).toMatchObject({ provider: 'openai', model: 'gpt-4.1-mini' });

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
    // 4 attempts x 2 tries (opus, sonnet, openai, openrouter)
    expect(down.calls).toHaveLength(8);

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
});
