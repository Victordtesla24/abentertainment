/**
 * Newsletter email quality gate — in-process tests, then the review endpoints over HTTP
 *
 * The deterministic rules, the AI reviewer's client (against a stubbed fetch, no key, no network), the fix loop (against
 * a scripted AI stand-in), the hash-bound approval and the check made again at every send. Tests render with the TEST
 * FIXTURE layout (e2e/fixtures) so each rule can be broken one thing at a time; the real brand layout has its own spec
 * (newsletter-email-layout.spec.ts). Nothing talks to a real AI service.
 */

import { test, expect, Page } from '@playwright/test';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir } from './support/email-unit';
import { makeFixtureLayout } from './fixtures/email-layout-fixture';
import { StubAi, aiIssue, failingReview, fixResult, passingReview, scores } from './fixtures/email-ai-stub';
import { HARNESS, HARNESS_SKIP } from './support/email-http';

type Rules = typeof import('@/lib/email/gate-rules');
type GateMod = typeof import('@/lib/email/gate');
type AiMod = typeof import('@/lib/email/ai-review');
type Store = typeof import('@/lib/email/store');
type Seed = typeof import('@/lib/email/seed');
type Types = typeof import('@/lib/email/types');
type Ctx = typeof import('@/lib/email/context');
type Layout = typeof import('@/lib/email/layout');
type Tokens = typeof import('@/lib/email/design-tokens');
type Hash = typeof import('@/lib/email/hash');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? '';
const HAS_ADMIN_CREDS = Boolean(process.env.ADMIN_TEST_PASSWORD);

test.describe.configure({ mode: 'serial' });

test.describe('quality gate (in-process)', () => {
  let rules: Rules;
  let gate: GateMod;
  let ai: AiMod;
  let store: Store;
  let seed: Seed;
  let types: Types;
  let context: Ctx;
  let shipped: Layout;
  let tokens: Tokens;
  let hash: Hash;

  test.beforeAll(() => {
    loadWithUnitDir(() => {
      rules = require('@/lib/email/gate-rules') as Rules;
      gate = require('@/lib/email/gate') as GateMod;
      ai = require('@/lib/email/ai-review') as AiMod;
      store = require('@/lib/email/store') as Store;
      seed = require('@/lib/email/seed') as Seed;
      types = require('@/lib/email/types') as Types;
      context = require('@/lib/email/context') as Ctx;
      shipped = require('@/lib/email/layout') as Layout;
      tokens = require('@/lib/email/design-tokens') as Tokens;
      hash = require('@/lib/email/hash') as Hash;
    });
  });

  test.beforeEach(() => cleanUnitDir());

  const UNSUBSCRIBE = 'https://abentertainment.com.au/api/newsletter/unsubscribe?t=test-token';
  const ctx = () => context.buildRenderContext(UNSUBSCRIBE);
  const settings = (overrides: Partial<import('@/lib/email/types').EmailSettings> = {}) => ({ ...seed.DEFAULT_SETTINGS, ...overrides });
  const fields = (overrides: Partial<import('@/lib/email/types').EmailFields> = {}) => ({ ...seed.SEED_WELCOME_FIELDS, ...overrides });
  const check = (overrides: Partial<import('@/lib/email/types').EmailFields> = {}, layout = makeFixtureLayout(), s = settings()) =>
    rules.runDeterministicChecks({ fields: fields(overrides), settings: s, layout, ctx: ctx() });
  const codes = (found: { issues: Array<{ code: string }> }) => found.issues.map((i) => i.code);

  // ─── deterministic rules ───────────────────────────────────────────────────

  test('the seeded welcome copy passes every deterministic check, and the message it renders is complete', () => {
    const outcome = check();
    expect(outcome.issues, JSON.stringify(outcome.issues.map((i) => `${i.code}: ${i.message}`))).toEqual([]);
    const rendered = outcome.rendered!;
    for (const part of [rendered.html, rendered.text]) {
      expect(part).toContain(UNSUBSCRIBE);
      expect(part).toContain('AB Entertainment');
      expect(part).toContain('Melbourne');
      expect(part).toContain('abhi@abentertainment.com.au');
    }
    expect(rendered.html).toContain(`<img src="${ctx().logoUrl}" alt="AB Entertainment"`);
    expect(ctx().logoUrl).toBe('https://abentertainment.com.au/images/AB_Logo_transparent-256w.png');
  });

  test('required fields and editorial limits', () => {
    expect(codes(check({ subject: '' }))).toContain('subject_missing');
    expect(codes(check({ subject: 'Hi' }))).toContain('subject_too_short');
    expect(codes(check({ subject: 'A'.repeat(1) + 'b'.repeat(80) }))).toContain('subject_too_long');
    expect(codes(check({ preheader: '' }))).toContain('preheader_missing');
    expect(codes(check({ preheader: 'Too short.' }))).toContain('preheader_length');
    expect(codes(check({ preheader: 'p'.repeat(141) }))).toContain('preheader_length');
    expect(codes(check({ eyebrow: 'e'.repeat(41) }))).toContain('eyebrow_too_long');
    expect(codes(check({ eyebrow: '' }))).not.toContain('eyebrow_too_long'); // the eyebrow is optional
    expect(codes(check({ heading: '' }))).toContain('heading_missing');
    expect(codes(check({ heading: 'H'.repeat(81) }))).toContain('heading_length');
    expect(codes(check({ body: '' }))).toContain('body_missing');
    expect(codes(check({ body: 'Far too short to be a message.' }))).toContain('body_too_short');
    expect(codes(check({ body: `${'Word '.repeat(600)}end` }))).toContain('body_too_long');
    expect(codes(check({ ctaLabel: '', ctaUrl: '' }))).toEqual([]); // a call to action is optional as a whole
  });

  test('placeholders, lorem ipsum, TODO markers and unrendered variables are blocked in every field', () => {
    const bad = ['Lorem ipsum dolor sit amet', 'TODO: fix this later', 'Dear {{first_name}}', 'Hello [Name]', 'Hello [insert name here]', 'Your ${name} ticket', 'Value is undefined', 'TBD', 'Hello %NAME%', 'Hello <%= name %>'];
    for (const text of bad) {
      for (const field of ['subject', 'heading', 'body'] as const) {
        const base = field === 'body' ? `${seed.SEED_WELCOME_FIELDS.body}\n\n${text}` : text.length < 8 ? `${text} and more words` : text;
        expect(codes(check({ [field]: base })), `${field}: ${text}`).toContain('placeholder_found');
      }
    }
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nSee [the events page](https://abentertainment.com.au/events/) for details.` }))).not.toContain('placeholder_found');
  });

  test('no emoji or emoticon anywhere; the copyright and trade mark signs are fine', () => {
    for (const text of ['A warm welcome \u{1F3AD}', 'Celebrate \u{1F389}', 'Thank you :)', 'Love ;-) it', 'We <3 you']) {
      expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\n${text}` })), text).toContain('emoji_found');
    }
    expect(codes(check({ subject: 'Welcome \u{1F3AD} to AB Entertainment' }))).toContain('emoji_found');
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nAB Entertainment™ © 2026 ®` }))).not.toContain('emoji_found');
  });

  test('shouting, excess punctuation and exclamation marks', () => {
    expect(codes(check({ subject: 'WELCOME TO THE BEST EVENTS' }))).toContain('shouting');
    expect(codes(check({ preheader: 'Join us for the INCREDIBLE season of music and dance' }))).toContain('shouting');
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nJoin NOW for this wonderful occasion.` }))).toContain('shouting');
    expect(codes(check({ subject: 'Welcome to AB Entertainment in VIC' }))).not.toContain('shouting'); // acronyms are fine
    expect(codes(check({ heading: 'THE AB ENTERTAINMENT COMMUNITY' }))).not.toContain('shouting'); // display headings may be ALL CAPS
    expect(codes(check({ ctaLabel: 'VIEW ALL EVENTS' }))).not.toContain('shouting'); // the layout sets CTAs in capitals anyway
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nWonderful news!!!` }))).toContain('excess_punctuation');
    expect(codes(check({ preheader: 'Is it true?! Thank you for joining the community.' }))).toContain('excess_punctuation');
    expect(codes(check({ subject: 'Welcome to AB Entertainment!' }))).toContain('subject_exclamation');
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nThank you! We are delighted! Truly.` }))).toContain('too_many_exclamations');
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nThank you for joining us!` }))).not.toContain('too_many_exclamations'); // one is allowed
  });

  test('spam and hype phrases are blocked, with curly apostrophes and mixed case', () => {
    for (const phrase of ['Act now', 'Limited time offer', 'Click here', "Don’t miss out", 'LAST CHANCE'.toLowerCase(), 'You won’t believe', '100% free', 'Guaranteed', 'urgent']) {
      expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nSimply ${phrase} today.` })), phrase).toContain('spam_phrase');
    }
    expect(codes(check({ subject: 'Act Now: Welcome to AB Entertainment' }))).toContain('spam_phrase');
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nThe winners of the raffle are not yet announced.` }))).not.toContain('spam_phrase'); // whole words only
  });

  test('American spellings are blocked; Australian spellings pass', () => {
    for (const word of ['color', 'center', 'organize', 'theater', 'honor', 'favorite', 'neighbors', 'program', 'analyze', 'catalog']) {
      const found = codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nThe ${word} is lovely.` }));
      if (word === 'program') expect(found).not.toContain('us_spelling'); // "program" is standard in Australian English
      else expect(found, word).toContain('us_spelling');
    }
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nThe colour, the centre and the theatre are lovely; we honour them and organise the evening.` }))).not.toContain('us_spelling');
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nVisit [the colour page](https://abentertainment.com.au/color-guide/) for more.` }))).not.toContain('us_spelling'); // links are not prose
  });

  test('headings are Title Case (or ALL CAPS)', () => {
    expect(rules.titleCaseProblems('Welcome to the AB Entertainment Community')).toEqual([]);
    expect(rules.titleCaseProblems('The Art of Storytelling')).toEqual([]);
    expect(rules.titleCaseProblems('WELCOME TO AB ENTERTAINMENT')).toEqual([]);
    expect(rules.titleCaseProblems('welcome to the community')).toEqual(['welcome', 'community']);
    expect(rules.titleCaseProblems('Welcome to our beautiful community')).toEqual(['our', 'beautiful', 'community']);
    expect(codes(check({ heading: 'welcome to the family' }))).toContain('heading_not_title_case');
    expect(codes(check({ heading: 'Welcome to the Family' }))).not.toContain('heading_not_title_case');
  });

  test('the call to action: label and link together, a real action, a short label', () => {
    expect(codes(check({ ctaUrl: '' }))).toContain('cta_incomplete');
    expect(codes(check({ ctaLabel: '' }))).toContain('cta_incomplete');
    expect(codes(check({ ctaLabel: 'Click here' }))).toEqual(expect.arrayContaining(['cta_label_generic', 'spam_phrase']));
    expect(codes(check({ ctaLabel: 'Learn more' }))).toContain('cta_label_generic');
    expect(codes(check({ ctaLabel: 'Please do come and view all of our upcoming events now' }))).toContain('cta_label_length');
    expect(codes(check({ ctaLabel: 'View All Events' }))).toEqual([]);
  });

  test('links: https only, allowed domains only, no tricks', () => {
    const body = (line: string) => `${seed.SEED_WELCOME_FIELDS.body}\n\n${line}`;
    expect(codes(check({ ctaUrl: 'http://abentertainment.com.au/events/' }))).toContain('link_not_https');
    expect(codes(check({ ctaUrl: 'javascript:alert(1)' }))).toContain('link_scheme_blocked');
    expect(codes(check({ ctaUrl: 'not a url' }))).toContain('link_invalid');
    expect(codes(check({ ctaUrl: 'https://example.com/x' }))).toContain('link_domain_not_allowed');
    expect(codes(check({ ctaUrl: 'https://www.abentertainment.com.au/events/' }))).toEqual([]); // a subdomain of an allowed domain
    expect(codes(check({ ctaUrl: 'https://abentertainment.com.au.evil.example/' }))).toContain('link_domain_not_allowed');
    expect(codes(check({ ctaUrl: 'https://user:pass@abentertainment.com.au/' }))).toContain('link_userinfo');
    expect(codes(check({ ctaUrl: 'https://192.168.1.1/events/' }))).toEqual(expect.arrayContaining(['link_ip_host', 'link_domain_not_allowed']));
    expect(codes(check({ ctaUrl: 'https://xn--abentertainment-9ob.com.au/' }))).toContain('link_punycode');
    expect(codes(check({ ctaUrl: 'https://bit.ly/abc' }, makeFixtureLayout(), settings({ allowedLinkDomains: ['bit.ly'] })))).toContain('link_shortener');
    expect(codes(check({ body: body('See [events](https://abentertainment.com.au/events/).') }))).toEqual([]);
    expect(codes(check({ body: body('See [events](http://abentertainment.com.au/events/).') }))).toEqual(expect.arrayContaining(['link_not_https', 'body_html_not_allowed'].filter((c) => c === 'link_not_https')));
    expect(codes(check({ body: body('See [x](javascript:alert(1)) now.') }))).toContain('link_scheme_blocked');
    expect(codes(check({ body: body('See https://example.com/page for more.') }))).toContain('link_domain_not_allowed');
    expect(codes(check({ body: body('See [abentertainment.com.au](https://example.com/page).') }))).toContain('link_text_mismatch');
    expect(codes(check({ body: body('See [events](https://abentertainment.com.au/events/) and [our Instagram](https://instagram.com/abentertainment_events/).') }))).toEqual([]);
    expect(codes(check({ subject: 'Visit https://abentertainment.com.au for news' }))).toContain('link_in_text_field');
  });

  test('the body takes no HTML and no images', () => {
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\n<b>bold</b> text` }))).toContain('body_html_not_allowed');
    expect(codes(check({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\n![alt](https://abentertainment.com.au/a.png)` }))).toContain('body_image_not_allowed');
  });

  test('the rendered message is checked: unsubscribe, sender identity, images, size, markup, colours, fonts, content', () => {
    const expectCode = (options: Parameters<typeof makeFixtureLayout>[0], code: string) => {
      const outcome = check({}, makeFixtureLayout(options));
      expect(codes(outcome), code).toContain(code);
      expect(outcome.issues.find((i) => i.code === code)?.fixable, `${code} is a layout or global issue, not fixable by rewording`).toBe(false);
    };
    expectCode({ omitUnsubscribeHtml: true }, 'unsubscribe_missing_html');
    expectCode({ omitUnsubscribeText: true }, 'unsubscribe_missing_text');
    expectCode({ omitSenderContact: true }, 'sender_identity_missing');
    expectCode({ omitAlt: true }, 'img_alt_missing');
    expectCode({ omitLogo: true }, 'logo_missing');
    expectCode({ trackingPixel: true }, 'tracking_pixel');
    expectCode({ unsafeScript: true }, 'html_unsafe_markup');
    expectCode({ oversize: true }, 'html_too_large');
    expectCode({ offBrandColour: true }, 'off_brand_color');
    expectCode({ offBrandFont: true }, 'off_brand_font');
    expectCode({ omitPalette: true }, 'brand_palette_missing');
    expectCode({ dropHeading: true }, 'layout_dropped_content');
    expectCode({ dropCta: true }, 'layout_dropped_content');
    expectCode({ emoji: true }, 'emoji_found');
    expectCode({ offDomainLink: true }, 'html_link_not_allowed');
    expectCode({ emptyText: true }, 'text_missing');
    expectCode({ throwOnRender: true }, 'layout_render_failed');
    expect(codes(check({}, makeFixtureLayout({ throwOnRender: true }))).includes('layout_not_installed')).toBe(false);
  });

  test('a message with the wrong unsubscribe link is refused: it must be https and the unsubscribe endpoint', () => {
    for (const url of ['http://abentertainment.com.au/api/newsletter/unsubscribe?t=x', 'https://abentertainment.com.au/somewhere-else?t=x', 'not a url']) {
      const outcome = rules.runDeterministicChecks({ fields: fields(), settings: settings(), layout: makeFixtureLayout(), ctx: { ...ctx(), unsubscribeUrl: url } });
      expect(codes(outcome), url).toContain('unsubscribe_link_invalid');
    }
  });

  test('off-brand styling fails the gate: every colour and font family in the rendered HTML is a design-system token', () => {
    const clean = check().rendered!.html;
    const colours = tokens.extractColours(clean);
    const fonts = tokens.extractFontFamilies(clean);
    expect(colours.length).toBeGreaterThan(5);
    expect(fonts.length).toBeGreaterThan(3);
    for (const colour of colours) expect(tokens.isBrandColour(colour), `colour ${colour}`).toBe(true);
    for (const font of fonts) expect(tokens.isBrandFontFamily(font), `font ${font}`).toBe(true);
    expect(tokens.findOffBrandTokens(clean)).toEqual({ colours: [], fonts: [] });
    const dirty = check({}, makeFixtureLayout({ offBrandColour: true, offBrandFont: true }));
    expect(dirty.issues.find((i) => i.code === 'off_brand_color')?.message).toContain('#FF00FF');
    expect(dirty.issues.find((i) => i.code === 'off_brand_font')?.message).toMatch(/Comic Sans MS/);
  });

  test('a layout that is not installed: the gate blocks everything and renders nothing', () => {
    const outcome = check({}, shipped.makeNotInstalledLayout());
    expect(outcome.rendered).toBeNull();
    expect(codes(outcome)).toContain('layout_not_installed');
    expect(outcome.issues.find((i) => i.code === 'layout_not_installed')?.fixable).toBe(false);
  });

  // ─── the AI client (stubbed fetch) ─────────────────────────────────────────

  const reviewInput = () => ({ fields: fields(), plainText: 'plain text', guidelines: { text: seed.DEFAULT_GUIDELINES_TEXT, version: 1, updatedAt: '', updatedBy: '' }, threshold: 85, model: '' });
  const reviewJson = (extra: Record<string, unknown> = {}) => ({
    scores: { content: 91, brand: 92, tone: 90, language: 94, quality: 93 },
    verdict: 'pass',
    summary: 'Ready.',
    issues: [{ dimension: 'tone', field: 'body', severity: 'minor', message: 'Could be warmer.', suggestion: 'Add thanks.' }],
    ...extra,
  });
  const reply = (payload: unknown, status = 200) => new Response(JSON.stringify(status === 200 ? { choices: [{ message: { content: typeof payload === 'string' ? payload : JSON.stringify(payload) } }] } : { error: { message: 'details that must not leak sk-test-secret' } }), { status, headers: { 'content-type': 'application/json' } });

  test('the AI client: no key means unavailable; with a key it calls OpenAI with structured output and returns a validated review', async () => {
    const none = ai.createAiClient({ env: {}, fetchImpl: async () => { throw new Error('must not be called'); } });
    await expect(none.review(reviewInput())).rejects.toMatchObject({ name: 'AiUnavailableError', reason: 'no_provider' });

    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = ai.createAiClient({ env: { OPENAI_API_KEY: 'sk-test-secret' }, fetchImpl: async (url, init) => { calls.push({ url: String(url), init: init as RequestInit }); return reply(reviewJson()); } });
    const review = await client.review(reviewInput());
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.model).toBe('gpt-4.1-mini');
    expect(sent.response_format.type).toBe('json_schema');
    expect(sent.response_format.json_schema.strict).toBe(true);
    expect(sent.messages[0].content).toContain('quality reviewer');
    const user = JSON.parse(sent.messages[1].content);
    expect(user.guidelines).toContain('CONTENT FUNDAMENTALS');
    expect(user.draft.subject).toBe(seed.SEED_WELCOME_FIELDS.subject);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test-secret');
    expect(review).toMatchObject({ provider: 'openai', model: 'gpt-4.1-mini', verdict: 'pass', scores: { content: 91, brand: 92, tone: 90, language: 94, quality: 93 } });
    expect(review.issues).toEqual([{ source: 'ai', code: 'ai_tone', field: 'body', message: 'Could be warmer.', suggestion: 'Add thanks.', fixable: true, severity: 'minor' }]);
    expect(JSON.stringify(review)).not.toContain('sk-test-secret');
  });

  test('the AI client: a configured model is used, and OpenRouter takes over when OpenAI cannot answer', async () => {
    const urls: string[] = [];
    const bodies: Array<Record<string, unknown>> = [];
    const client = ai.createAiClient({
      env: { OPENAI_API_KEY: 'sk-test-secret', OPENROUTER_API_KEY: 'sk-or-test-secret' },
      fetchImpl: async (url, init) => {
        urls.push(String(url));
        bodies.push(JSON.parse(String((init as RequestInit).body)));
        return String(url).includes('openai.com') ? reply({}, 503) : reply(reviewJson());
      },
    });
    const review = await client.review({ ...reviewInput(), model: 'gpt-4.1' });
    expect(urls).toEqual(['https://api.openai.com/v1/chat/completions', 'https://api.openai.com/v1/chat/completions', 'https://openrouter.ai/api/v1/chat/completions']);
    expect(bodies[0].model).toBe('gpt-4.1'); // OpenAI: the model as set
    expect(bodies[2].model).toBe('openai/gpt-4.1'); // OpenRouter: the provider prefix is added
    expect((bodies[2].response_format as { type: string }).type).toBe('json_object');
    expect(review.provider).toBe('openrouter');
  });

  test('the AI client: a rejected key does not retry, an unusable answer is retried once and then refused, errors never carry keys', async () => {
    let calls = 0;
    const unauthorised = ai.createAiClient({ env: { OPENAI_API_KEY: 'sk-test-secret' }, fetchImpl: async () => { calls += 1; return reply({}, 401); } });
    const refused = await unauthorised.review(reviewInput()).catch((e: Error) => e);
    expect(calls).toBe(1);
    expect(refused).toMatchObject({ name: 'AiUnavailableError', reason: 'http' });
    expect((refused as Error).message).not.toContain('sk-test-secret');

    const badShapes: unknown[] = ['not json at all', { scores: { content: 120, brand: 90, tone: 90, language: 90, quality: 90 }, verdict: 'pass', summary: '', issues: [] }, { ...reviewJson(), verdict: 'maybe' }, { ...reviewJson(), extra: 1, scores: { content: 1 } }, { ...reviewJson(), issues: [{ dimension: 'colour', field: 'body', severity: 'minor', message: 'x', suggestion: '' }] }, { choices: 'nope' }];
    for (const shape of badShapes) {
      calls = 0;
      const client = ai.createAiClient({ env: { OPENAI_API_KEY: 'sk-test-secret' }, fetchImpl: async () => { calls += 1; return shape === 'not json at all' ? reply('not json at all') : reply(shape); } });
      const error = await client.review(reviewInput()).catch((e: Error) => e);
      expect(error, JSON.stringify(shape).slice(0, 50)).toMatchObject({ name: 'AiInvalidResponseError' });
      expect(calls, 'asked twice, then refused').toBe(2);
      expect((error as Error).message).not.toContain('sk-test-secret');
    }

    const network = ai.createAiClient({ env: { OPENAI_API_KEY: 'sk-test-secret' }, fetchImpl: async () => { throw new Error('connect ECONNREFUSED sk-test-secret'); } });
    const down = await network.review(reviewInput()).catch((e: Error) => e);
    expect(down).toMatchObject({ name: 'AiUnavailableError', reason: 'network' });
    expect((down as Error).message).not.toContain('sk-test-secret');

    const slow = ai.createAiClient({ env: { OPENAI_API_KEY: 'sk-test-secret' }, timeoutMs: 30, fetchImpl: (_url, init) => new Promise((_resolve, reject) => { (init as RequestInit).signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }) });
    expect(await slow.review(reviewInput()).catch((e: Error) => e)).toMatchObject({ name: 'AiUnavailableError', reason: 'timeout' });
  });

  test('the AI client: the fix call carries the failing issues, the changeable fields and the allowed domains', async () => {
    let sent: Record<string, unknown> = {};
    const client = ai.createAiClient({ env: { OPENAI_API_KEY: 'sk-test-secret' }, fetchImpl: async (_url, init) => { sent = JSON.parse(String((init as RequestInit).body)); return reply({ fixes: { subject: 'Welcome to AB Entertainment', preheader: null, eyebrow: null, heading: null, body: null, ctaLabel: null, ctaUrl: null }, rationale: 'Removed the exclamation mark.' }); } });
    const result = await client.fix({ fields: fields(), issues: [{ source: 'deterministic', code: 'subject_exclamation', field: 'subject', message: 'The subject contains an exclamation mark.', fixable: true, severity: 'blocker' }], changeable: ['subject'], guidelines: { text: seed.DEFAULT_GUIDELINES_TEXT, version: 1, updatedAt: '', updatedBy: '' }, threshold: 85, model: '', allowedLinkDomains: ['abentertainment.com.au'] });
    expect(result.fixes.subject).toBe('Welcome to AB Entertainment');
    expect(result.fixes.body).toBeNull();
    expect(result.rationale).toBe('Removed the exclamation mark.');
    const messages = sent.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('abentertainment.com.au');
    const user = JSON.parse(messages[1].content);
    expect(user.changeable).toEqual(['subject']);
    expect(user.problems[0].message).toContain('exclamation mark');
  });

  // ─── pass logic ────────────────────────────────────────────────────────────

  test('a review passes only on a pass verdict, every score at the threshold and no blocker or major issue', () => {
    expect(gate.aiPasses(passingReview(), 85)).toBe(true);
    expect(gate.aiPasses(passingReview({ scores: scores(85) }), 85)).toBe(true);
    expect(gate.aiPasses(passingReview({ scores: scores(93, { tone: 84 }) }), 85)).toBe(false);
    expect(gate.aiPasses(passingReview({ scores: scores(84) }), 70)).toBe(true); // the threshold is the administrators' setting
    expect(gate.aiPasses(passingReview({ verdict: 'fail' }), 85)).toBe(false); // high scores but the reviewer said fail
    expect(gate.aiPasses(passingReview({ issues: [aiIssue('body', 'major', 'Too casual')] }), 85)).toBe(false);
    expect(gate.aiPasses(passingReview({ issues: [aiIssue('body', 'blocker', 'Wrong')] }), 85)).toBe(false);
    expect(gate.aiPasses(passingReview({ issues: [aiIssue('body', 'minor', 'Polish')] }), 85)).toBe(true);
    const lowScore = gate.failingAiIssues(passingReview({ scores: scores(93, { language: 80 }), verdict: 'fail', summary: 'Spelling.' }), 85);
    expect(lowScore).toHaveLength(1);
    expect(lowScore[0]).toMatchObject({ code: 'ai_language', field: 'global', fixable: true });
    expect(gate.failingAiIssues(passingReview({ verdict: 'fail', summary: 'Not right.' }), 85)[0].code).toBe('ai_verdict');
  });

  test('which fields the fix may change follows the issues; the layout and unrelated fields stay out', () => {
    const issue = (field: import('@/lib/email/types').GateField) => aiIssue(field, 'major', 'x');
    expect(gate.changeableFields([issue('subject')])).toEqual(['subject']);
    expect(gate.changeableFields([issue('cta')])).toEqual(['ctaLabel', 'ctaUrl']);
    expect(gate.changeableFields([issue('heading'), issue('body')])).toEqual(['heading', 'body']);
    expect(gate.changeableFields([issue('global')])).toEqual(['subject', 'preheader', 'eyebrow', 'heading', 'body', 'ctaLabel']);
    expect(gate.changeableFields([issue('layout')])).toEqual([]);
  });

  // ─── the fix loop ──────────────────────────────────────────────────────────

  const run = (overrides: Partial<import('@/lib/email/types').EmailFields>, stub: InstanceType<typeof StubAi>, s = settings(), layout = makeFixtureLayout()) =>
    gate.runGate({ fields: fields(overrides), settings: s, guidelines: { text: seed.DEFAULT_GUIDELINES_TEXT, version: 1, updatedAt: '', updatedBy: '' } }, { layout, ai: stub, ctx: ctx() });

  test('loop: clean content that the reviewer passes is approved in one round, with no fix call', async () => {
    const stub = new StubAi([passingReview()]);
    const result = await run({}, stub);
    expect(result).toMatchObject({ passed: true, stopReason: 'passed', maxRounds: 3, threshold: 85 });
    expect(result.rounds).toHaveLength(1);
    expect(stub.reviewCalls).toHaveLength(1);
    expect(stub.fixCalls).toHaveLength(0);
    expect(result.rounds[0]).toMatchObject({ round: 1, passed: true, deterministic: [], fieldsHash: hash.contentHash(fields()) });
    expect(result.rounds[0].fields).toEqual(fields());
    expect(result.finalFields).toEqual(fields());
    expect(stub.reviewCalls[0].plainText).toContain('The AB Entertainment Community'); // the reviewer sees what the recipient reads
    expect(stub.reviewCalls[0].threshold).toBe(85);
  });

  test('loop: a deterministic failure is fixed by the AI (failing field only), then reviewed, then approved', async () => {
    const stub = new StubAi([passingReview()], [fixResult({ subject: 'Welcome to AB Entertainment', body: 'sneaky: changed although it did not fail' }, 'Removed the exclamation mark and the capitals.')]);
    const result = await run({ subject: 'WELCOME TO AB ENTERTAINMENT!' }, stub);
    expect(result.passed).toBe(true);
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0]).toMatchObject({ passed: false, aiError: 'skipped', ai: null, fixedFields: ['subject'], fixRationale: 'Removed the exclamation mark and the capitals.' });
    expect(result.rounds[0].deterministic.map((i) => i.code)).toEqual(expect.arrayContaining(['shouting', 'subject_exclamation']));
    expect(stub.reviewCalls).toHaveLength(1); // no AI review while the deterministic checks were failing
    expect(stub.fixCalls).toHaveLength(1);
    expect(stub.fixCalls[0].changeable).toEqual(['subject']);
    expect(result.rounds[1]).toMatchObject({ round: 2, passed: true });
    expect(result.finalFields.subject).toBe('Welcome to AB Entertainment');
    expect(result.finalFields.body).toBe(seed.SEED_WELCOME_FIELDS.body); // the unrelated change was ignored
    expect(result.finalHash).toBe(hash.contentHash(result.finalFields));
    expect(result.rounds[1].fields.subject).toBe('Welcome to AB Entertainment');
  });

  test('loop: an AI review that fails is fixed and reviewed again', async () => {
    const stub = new StubAi(
      [failingReview([aiIssue('body', 'major', 'The second paragraph is too casual for the brand.')]), passingReview()],
      [fixResult({ body: `${seed.SEED_WELCOME_FIELDS.body}\n\nAB Entertainment is honoured by the audience's trust.` }, 'Raised the register of the body.')],
    );
    const result = await run({}, stub);
    expect(result.passed).toBe(true);
    expect(result.rounds.map((r) => r.passed)).toEqual([false, true]);
    expect(result.rounds[0].ai?.issues[0].message).toContain('too casual');
    expect(result.rounds[0].fixedFields).toEqual(['body']);
    expect(stub.fixCalls[0].issues.map((i) => i.message)).toEqual(['The second paragraph is too casual for the brand.']);
    expect(stub.fixCalls[0].changeable).toEqual(['body']);
    expect(result.finalFields.body).toContain('honoured');
  });

  test('loop: still failing after the administrators\' number of fix rounds is blocked, with every round on record', async () => {
    const stub = new StubAi([failingReview([aiIssue('heading', 'major', 'The heading lacks gravitas.')])], [(input) => fixResult({ heading: `${input.fields.heading} Revised` })]);
    const result = await run({}, stub, settings({ maxFixRounds: 2 }));
    expect(result).toMatchObject({ passed: false, stopReason: 'max_rounds', maxRounds: 2 });
    expect(result.rounds).toHaveLength(3); // the draft, then one review after each of two fixes
    expect(stub.fixCalls).toHaveLength(2);
    expect(result.rounds.map((r) => r.round)).toEqual([1, 2, 3]);
    expect(result.rounds[0].fixedFields).toEqual(['heading']);
    expect(result.rounds[2].fixedFields).toBeUndefined();
    expect(result.rounds[2].passed).toBe(false);
    expect(result.finalFields.heading).toBe('The AB Entertainment Community Revised Revised');
    expect(gate.buildApproval(result, makeFixtureLayout(), { text: 'x', version: 1, updatedAt: '', updatedBy: '' })).toBeNull();
    const single = await run({}, new StubAi([failingReview([aiIssue('heading', 'major', 'x')])], [(input) => fixResult({ heading: `${input.fields.heading} Revised` })]), settings({ maxFixRounds: 1 }));
    expect(single.rounds).toHaveLength(2);
    expect(single.stopReason).toBe('max_rounds');
  });

  test('loop: an unavailable AI reviewer blocks, and nothing is approved unreviewed', async () => {
    const stub = new StubAi([new ai.AiUnavailableError('network', 'The openai reviewer could not be reached (network error).')]);
    const result = await run({}, stub);
    expect(result).toMatchObject({ passed: false, stopReason: 'ai_unavailable' });
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]).toMatchObject({ ai: null, aiError: 'unavailable', passed: false });
    expect(result.rounds[0].aiErrorDetail).toContain('could not be reached');
    expect(stub.fixCalls).toHaveLength(0);
    expect(gate.buildApproval(result, makeFixtureLayout(), { text: 'x', version: 1, updatedAt: '', updatedBy: '' })).toBeNull();
    const noKey = await run({}, new StubAi([new ai.AiUnavailableError('no_provider', 'No AI reviewer is configured (OPENAI_API_KEY or OPENROUTER_API_KEY).')]));
    expect(noKey.stopReason).toBe('ai_unavailable');
    expect(noKey.passed).toBe(false);
  });

  test('loop: an unusable AI answer blocks as well', async () => {
    const result = await run({}, new StubAi([new ai.AiInvalidResponseError('The openai reviewer\'s answer did not match the expected shape.')]));
    expect(result).toMatchObject({ passed: false, stopReason: 'ai_unavailable' });
    expect(result.rounds[0].aiError).toBe('invalid_response');
  });

  test('loop: with no brand layout installed nothing is reviewed and nothing is fixed', async () => {
    const stub = new StubAi([passingReview()], [fixResult({ subject: 'x' })]);
    const result = await run({}, stub, settings(), shipped.makeNotInstalledLayout());
    expect(result).toMatchObject({ passed: false, stopReason: 'layout_not_installed' });
    expect(result.rounds[0].deterministic.map((i) => i.code)).toContain('layout_not_installed');
    expect(stub.reviewCalls).toHaveLength(0);
    expect(stub.fixCalls).toHaveLength(0);
  });

  test('loop: problems that rewording cannot fix (the layout) stop the loop without an AI call', async () => {
    const stub = new StubAi([passingReview()], [fixResult({ subject: 'x' })]);
    const result = await run({}, stub, settings(), makeFixtureLayout({ omitUnsubscribeHtml: true }));
    expect(result).toMatchObject({ passed: false, stopReason: 'unfixable' });
    expect(stub.reviewCalls).toHaveLength(0);
    expect(stub.fixCalls).toHaveLength(0);
  });

  test('loop: a fix that changes nothing, or is not valid content, or cannot be had, stops the loop', async () => {
    const same = await run({ subject: 'Hi' }, new StubAi([passingReview()], [fixResult({ subject: 'Hi' })]));
    expect(same).toMatchObject({ passed: false, stopReason: 'no_progress' });
    expect(same.rounds[0].fixedFields).toEqual([]);

    const invalid = await run({ subject: 'Hi' }, new StubAi([passingReview()], [fixResult({ subject: 'two\nlines' })]));
    expect(invalid).toMatchObject({ passed: false, stopReason: 'no_progress' });
    expect(invalid.rounds[0].fixError).toContain('not valid content');
    expect(invalid.rounds[0].fixError).toContain('one line');

    const gone = await run({ subject: 'Hi' }, new StubAi([passingReview()], [new ai.AiUnavailableError('network', 'The openai reviewer could not be reached (network error).')]));
    expect(gone).toMatchObject({ passed: false, stopReason: 'ai_unavailable' });
    expect(gone.rounds[0].fixError).toContain('could not be reached');
  });

  test('loop: the pass mark is the administrators\' setting', async () => {
    const review = passingReview({ scores: scores(80), verdict: 'pass' });
    expect((await run({}, new StubAi([review], [fixResult({})]), settings({ qualityThreshold: 85, maxFixRounds: 1 }))).passed).toBe(false);
    expect((await run({}, new StubAi([review]), settings({ qualityThreshold: 75 }))).passed).toBe(true);
  });

  // ─── approval, binding and activation ──────────────────────────────────────

  const guidelines = (version = 1, text = seed.DEFAULT_GUIDELINES_TEXT) => ({ text, version, updatedAt: '', updatedBy: '' });

  async function approvedWelcome(layout = makeFixtureLayout()) {
    const template = (await store.getEmailTemplates())[0];
    const result = await gate.runGate({ fields: template.versions[0].fields, settings: settings(), guidelines: guidelines() }, { layout, ai: new StubAi([passingReview()]), ctx: ctx() });
    const approval = gate.buildApproval(result, layout, guidelines());
    const recorded = await store.recordGateOutcome(template.id, 1, { result, approval });
    return { template: recorded.template, approvedVersion: recorded.approvedVersion };
  }

  test('approval: a passing review approves the reviewed version, bound to its content, layout and guidelines', async () => {
    const { template, approvedVersion } = await approvedWelcome();
    expect(approvedVersion).toBe(1);
    const v1 = template.versions[0];
    expect(v1.approval).toMatchObject({ layoutId: 'test-fixture', layoutVersion: '1', guidelinesVersion: 1, provider: 'stub', model: 'stub-model', rounds: 1, scores: scores(93) });
    expect(v1.approval?.bindingHash).toBe(hash.bindingHash({ fields: v1.fields, layoutId: 'test-fixture', layoutVersion: '1', guidelinesVersion: 1, guidelinesText: seed.DEFAULT_GUIDELINES_TEXT }));
    expect(v1.review).toMatchObject({ passed: true, stopReason: 'passed' });
    expect(v1.review?.rounds).toHaveLength(1);
    expect(template.activeVersion).toBeNull(); // approving does not activate: that is a separate, explicit step
    expect(gate.approvalState(v1, makeFixtureLayout(), guidelines())).toEqual({ state: 'approved' });
  });

  test('approval: when the AI fixed the content, the fixed content becomes a new approved version and the original stays unapproved', async () => {
    const template = (await store.getEmailTemplates())[0];
    const layout = makeFixtureLayout();
    const stub = new StubAi([passingReview()], [fixResult({ subject: 'Welcome to AB Entertainment' })]);
    const result = await gate.runGate({ fields: { ...template.versions[0].fields, subject: 'WELCOME TO AB ENTERTAINMENT!' }, settings: settings(), guidelines: guidelines() }, { layout, ai: stub, ctx: ctx() });
    expect(result.passed).toBe(true);
    // the reviewed content is a draft saved first, as the admin screen does
    const draft = await store.updateEmailTemplate(template.id, { fields: { subject: 'WELCOME TO AB ENTERTAINMENT!' } });
    const recorded = await store.recordGateOutcome(template.id, 2, { result, approval: gate.buildApproval(result, layout, guidelines()) });
    expect(draft.versions).toHaveLength(2);
    expect(recorded.approvedVersion).toBe(3);
    const [, v2, v3] = recorded.template.versions;
    expect(v2.approval).toBeUndefined();
    expect(v2.review).toMatchObject({ passed: true, resultVersion: 3 });
    expect(v2.fields.subject).toBe('WELCOME TO AB ENTERTAINMENT!'); // the reviewed version keeps its content
    expect(v3).toMatchObject({ version: 3, createdBy: 'ai-fix', parentVersion: 2 });
    expect(v3.fields.subject).toBe('Welcome to AB Entertainment');
    expect(v3.approval?.bindingHash).toBeTruthy();
    expect(gate.approvalState(v3, layout, guidelines())).toEqual({ state: 'approved' });
    expect(gate.approvalState(v2, layout, guidelines())).toEqual({ state: 'unapproved' });
  });

  test('approval: a blocked review is recorded on the version, without an approval', async () => {
    const template = (await store.getEmailTemplates())[0];
    const layout = makeFixtureLayout();
    const result = await gate.runGate({ fields: template.versions[0].fields, settings: settings(), guidelines: guidelines() }, { layout, ai: new StubAi([new ai.AiUnavailableError('no_provider', 'No AI reviewer is configured.')]), ctx: ctx() });
    const recorded = await store.recordGateOutcome(template.id, 1, { result, approval: gate.buildApproval(result, layout, guidelines()) });
    expect(recorded.approvedVersion).toBeNull();
    expect(recorded.template.versions[0].approval).toBeUndefined();
    expect(recorded.template.versions[0].review).toMatchObject({ passed: false, stopReason: 'ai_unavailable' });
    expect(recorded.template.versions[0].review?.rounds[0].aiError).toBe('unavailable');
  });

  test('approval: any edit voids it (a new version is unapproved), and a change of layout or guidelines makes it stale', async () => {
    const { template } = await approvedWelcome();
    const edited = await store.updateEmailTemplate(template.id, { fields: { body: `${template.versions[0].fields.body}\n\nOne more sentence.` } });
    expect(edited.versions).toHaveLength(2);
    expect(edited.versions[1].approval).toBeUndefined();
    expect(gate.approvalState(edited.versions[1], makeFixtureLayout(), guidelines())).toEqual({ state: 'unapproved' });
    // the earlier, approved version is untouched by the edit
    expect(gate.approvalState(edited.versions[0], makeFixtureLayout(), guidelines())).toEqual({ state: 'approved' });
    const v1 = edited.versions[0];
    expect(gate.approvalState(v1, makeFixtureLayout({ version: '2' }), guidelines())).toEqual({ state: 'stale', reasons: ['layout'] });
    expect(gate.approvalState(v1, makeFixtureLayout({ id: 'another' }), guidelines())).toEqual({ state: 'stale', reasons: ['layout'] });
    expect(gate.approvalState(v1, makeFixtureLayout(), guidelines(2, `${seed.DEFAULT_GUIDELINES_TEXT}\nAn added rule.`))).toEqual({ state: 'stale', reasons: ['guidelines'] });
    const tampered = { ...v1, fields: { ...v1.fields, subject: 'Tampered with after approval' } };
    expect(gate.approvalState(tampered, makeFixtureLayout(), guidelines())).toMatchObject({ state: 'stale' });
    expect((gate.approvalState(tampered, makeFixtureLayout(), guidelines()) as { reasons: string[] }).reasons).toContain('content');
  });

  test('activation: only an approved version, only while its approval still binds; null deactivates', async () => {
    const { template } = await approvedWelcome();
    const layout = makeFixtureLayout();
    const refusal = (current = guidelines(), lay = layout) => (version: import('@/lib/email/types').TemplateVersion) => {
      const state = gate.approvalState(version, lay, current);
      return state.state === 'approved' ? null : `refused: ${state.state}`;
    };
    const edited = await store.updateEmailTemplate(template.id, { fields: { subject: 'Welcome to the AB Entertainment Family' } });
    await expect(store.setActiveVersion(template.id, 2, refusal())).rejects.toMatchObject({ code: 'conflict', message: 'refused: unapproved' });
    await expect(store.setActiveVersion(template.id, 9, refusal())).rejects.toMatchObject({ code: 'not_found' });
    await expect(store.setActiveVersion('tpl-nope', 1, refusal())).rejects.toMatchObject({ code: 'not_found' });
    await expect(store.setActiveVersion(template.id, 1, refusal(guidelines(2, 'changed rules'), layout))).rejects.toMatchObject({ code: 'conflict', message: 'refused: stale' });
    expect((await store.setActiveVersion(template.id, 1, refusal())).activeVersion).toBe(1);
    expect(edited.activeVersion).toBeNull();
    expect((await store.setActiveVersion(template.id, null, refusal())).activeVersion).toBeNull();
  });

  // ─── the check at every send ───────────────────────────────────────────────

  test('send check: every refusal, and the exact message when everything holds (no AI call is involved)', async () => {
    const layout = makeFixtureLayout();
    const { template } = await approvedWelcome(layout);
    const input = (over: Partial<Parameters<GateMod['verifyForSend']>[0]> = {}) => ({ template, settings: settings(), guidelines: guidelines(), layout, ctx: ctx(), ...over });
    const active = await store.setActiveVersion(template.id, 1, () => null);

    expect(gate.verifyForSend(input({ template: { ...active, enabled: false } }))).toMatchObject({ ok: false, reason: 'disabled' });
    expect(gate.verifyForSend(input())).toMatchObject({ ok: false, reason: 'no_active_version' }); // the stored template, not yet activated
    expect(gate.verifyForSend(input({ template: { ...active, activeVersion: 7 } }))).toMatchObject({ ok: false, reason: 'no_active_version' });
    expect(gate.verifyForSend(input({ template: active, layout: shipped.makeNotInstalledLayout() }))).toMatchObject({ ok: false, reason: 'layout_not_installed' });
    const unapproved = await store.updateEmailTemplate(template.id, { fields: { subject: 'A different subject line' } });
    expect(gate.verifyForSend(input({ template: unapproved, version: 2 }))).toMatchObject({ ok: false, reason: 'not_approved' });
    const stale = gate.verifyForSend(input({ template: active, guidelines: guidelines(2, 'rules changed') }));
    expect(stale).toMatchObject({ ok: false, reason: 'approval_stale' });
    expect((stale as { message: string }).message).toContain('guidelines changed');
    expect(gate.verifyForSend(input({ template: active, layout: makeFixtureLayout({ version: '2' }) }))).toMatchObject({ ok: false, reason: 'approval_stale' });

    // the deterministic checks run again on the exact message: a broken unsubscribe link is caught even though the content is approved
    const broken = gate.verifyForSend(input({ template: active, ctx: { ...ctx(), unsubscribeUrl: 'http://abentertainment.com.au/api/newsletter/unsubscribe?t=x' } }));
    expect(broken).toMatchObject({ ok: false, reason: 'gate_failed' });
    expect((broken as { issues: Array<{ code: string }> }).issues.map((i) => i.code)).toContain('unsubscribe_link_invalid');

    const real = { ...ctx(), unsubscribeUrl: 'https://abentertainment.com.au/api/newsletter/unsubscribe?t=abc.def' };
    const ok = gate.verifyForSend(input({ template: active, ctx: real }));
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.version.version).toBe(1);
      expect(ok.fields).toEqual(seed.SEED_WELCOME_FIELDS);
      expect(ok.rendered.html).toContain('?t=abc.def');
      expect(ok.rendered.text).toContain('Unsubscribe: https://abentertainment.com.au/api/newsletter/unsubscribe?t=abc.def');
    }
    // a test send of a specific approved version goes through the same checks
    expect(gate.verifyForSend(input({ template: active, version: 1, ctx: real })).ok).toBe(true);
  });

  test('types: the pass mark, fix rounds and statuses are what the admin screens are told', () => {
    expect(types.AI_DIMENSIONS).toEqual(['content', 'brand', 'tone', 'language', 'quality']);
    expect(rules.GATE_LIMITS.subject.max).toBe(78);
    expect(seed.DEFAULT_SETTINGS).toMatchObject({ maxFixRounds: 3, qualityThreshold: 85 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP: review, preview and activation
// ═══════════════════════════════════════════════════════════════════════════════

const SERVER_DATA_DIR = process.env.AB_DATA_DIR ?? join(process.cwd(), 'data');
const SERVER_FILES = ['email-templates.json', 'email-settings.json', 'email-guidelines.json'];

async function adminLogin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.waitForTimeout(500);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel('Username').fill(ADMIN_USERNAME);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    if (await page.locator('aside').getByText('AB Entertainment').first().isVisible({ timeout: 6000 }).catch(() => false)) return;
    const throttled = await page.getByText(/too many attempts|too many requests/i).first().isVisible({ timeout: 1500 }).catch(() => false);
    if (!throttled) break;
    await page.waitForTimeout(2000);
  }
  await expect(page.locator('aside').getByText('AB Entertainment').first()).toBeVisible({ timeout: 20000 });
}

async function adminApi(page: Page, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> | null }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const auth = await fetch('/api/admin/auth', { credentials: 'include', cache: 'no-store' });
      const { csrfToken } = (await auth.json()) as { csrfToken?: string };
      const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ?? '' }, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body) });
      let json: Record<string, unknown> | null = null;
      try { json = (await res.json()) as Record<string, unknown>; } catch { json = null; }
      return { status: res.status, body: json };
    },
    { method, path, body },
  );
}

test.describe('admin API: review, preview and activation', () => {
  const saved = new Map<string, string | null>();

  test.beforeAll(({ baseURL }) => {
    const host = new URL(baseURL ?? 'http://localhost:3000').hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`Refusing to run: baseURL (${baseURL}) is not on this machine.`);
    for (const file of SERVER_FILES) {
      const path = join(SERVER_DATA_DIR, file);
      saved.set(file, existsSync(path) ? readFileSync(path, 'utf-8') : null);
    }
  });

  test.afterAll(() => {
    for (const [file, content] of saved) {
      if (content === null) rmSync(join(SERVER_DATA_DIR, file), { force: true });
      else writeFileSync(join(SERVER_DATA_DIR, file), content, 'utf-8');
    }
  });

  test.beforeEach(() => {
    for (const file of SERVER_FILES) rmSync(join(SERVER_DATA_DIR, file), { force: true });
  });

  test('every endpoint is a 401 without a session', async ({ request }) => {
    const origin = { origin: 'https://abentertainment.com.au' };
    expect((await request.post('/api/admin/newsletter/review', { data: { id: 'x', version: 1 }, headers: origin })).status()).toBe(401);
    expect((await request.get('/api/admin/newsletter/review?id=x&version=1')).status()).toBe(401);
    expect((await request.post('/api/admin/newsletter/preview', { data: {}, headers: origin })).status()).toBe(401);
  });

  test('the review runs and is fully inspectable: the brand layout renders and passes the deterministic checks, the AI reviewer cannot be reached, so it blocks, names why, and approves nothing', async ({ page }) => {
    // The server must be the email test harness: its AI settings are fake and point at a loopback address where nothing
    // listens in this spec, so no real AI service is ever called (see e2e/support/email-http.ts).
    test.skip(!HAS_ADMIN_CREDS || !HARNESS, HARNESS_SKIP);
    await adminLogin(page);
    const templates = await adminApi(page, 'GET', '/api/admin/newsletter/templates');
    const welcome = (templates.body?.templates as Array<{ id: string }>)[0];

    expect((await adminApi(page, 'POST', '/api/admin/newsletter/review', {})).status).toBe(400);
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/review', { id: welcome.id, version: 1.5 })).status).toBe(400);
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/review', { id: 'tpl-nope', version: 1 })).status).toBe(404);
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/review', { id: welcome.id, version: 9 })).status).toBe(404);

    const started = await adminApi(page, 'POST', '/api/admin/newsletter/review', { id: welcome.id, version: 1 });
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({ status: 'done', approvedVersion: null, error: null });
    const result = started.body?.result as { passed: boolean; stopReason: string; rounds: Array<{ round: number; fields: Record<string, string>; deterministic: Array<{ code: string; field: string; fixable: boolean }>; ai: unknown; passed: boolean }>; maxRounds: number; threshold: number; finalHash: string };
    expect(result).toMatchObject({ passed: false, stopReason: 'ai_unavailable', maxRounds: 3, threshold: 85 });
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]).toMatchObject({ round: 1, ai: null, passed: false, aiError: 'unavailable', deterministic: [] });
    expect(result.rounds[0].fields.subject).toBe('Welcome to AB Entertainment');
    expect((result.rounds[0] as { aiErrorDetail?: string }).aiErrorDetail).toMatch(/could not be reached/);
    expect(result.finalHash).toMatch(/^[0-9a-f]{64}$/);

    // the same result is read back, and it is saved on the version
    const again = await adminApi(page, 'GET', `/api/admin/newsletter/review?id=${welcome.id}&version=1`);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ status: 'done' });
    const after = await adminApi(page, 'GET', '/api/admin/newsletter/templates');
    const version = (after.body?.templates as Array<{ versions: Array<{ approval?: unknown; review?: { passed: boolean; stopReason: string } }> }>)[0].versions[0];
    expect(version.approval).toBeUndefined();
    expect(version.review).toMatchObject({ passed: false, stopReason: 'ai_unavailable' });
    expect((await adminApi(page, 'GET', '/api/admin/newsletter/review?id=tpl-nope&version=1')).status).toBe(404);
    expect((await adminApi(page, 'GET', '/api/admin/newsletter/review')).status).toBe(400);
  });

  test('the preview renders a draft with its checks, and refuses invalid fields', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    const preview = await adminApi(page, 'POST', '/api/admin/newsletter/preview', { fields: { subject: 'Hi', heading: 'a heading' } });
    expect(preview.status).toBe(200);
    expect(preview.body?.layout).toMatchObject({ id: 'ab-entertainment', installed: true });
    expect((preview.body?.layout as { version: string }).version).toMatch(/^1\.[0-9a-f]{10}$/);
    expect(typeof preview.body?.html).toBe('string'); // the layout renders whatever it is given; the issues say what is wrong with it
    const issues = (preview.body?.issues as Array<{ code: string }>).map((i) => i.code);
    expect(issues).toEqual(expect.arrayContaining(['subject_too_short', 'heading_not_title_case', 'body_missing']));
    expect(issues).not.toContain('layout_not_installed');
    const templates = await adminApi(page, 'GET', '/api/admin/newsletter/templates');
    const welcome = (templates.body?.templates as Array<{ id: string }>)[0];
    const saved = await adminApi(page, 'POST', '/api/admin/newsletter/preview', { id: welcome.id, version: 1 });
    expect(saved.status).toBe(200);
    expect((saved.body?.fields as { subject: string }).subject).toBe('Welcome to AB Entertainment');
    expect((saved.body?.issues as Array<{ code: string }>).map((i) => i.code)).toEqual([]); // the seeded welcome passes every deterministic check in the brand layout
    expect(String(saved.body?.html)).toContain('The AB Entertainment Community');
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/preview', { fields: { subject: 'two\nlines' } })).status).toBe(400);
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/preview', { id: 'tpl-nope', version: 1 })).status).toBe(404);
  });

  test('activation refuses a version that has not passed the review, and null deactivates', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    const templates = await adminApi(page, 'GET', '/api/admin/newsletter/templates');
    const welcome = (templates.body?.templates as Array<{ id: string }>)[0];
    const refused = await adminApi(page, 'PUT', '/api/admin/newsletter/templates', { id: welcome.id, activeVersion: 1 });
    expect(refused.status).toBe(409);
    expect(String(refused.body?.error)).toContain('has not passed the quality review');
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/templates', { id: welcome.id, activeVersion: 'one' })).status).toBe(400);
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/templates', { id: welcome.id, activeVersion: 7 })).status).toBe(404);
    const cleared = await adminApi(page, 'PUT', '/api/admin/newsletter/templates', { id: welcome.id, activeVersion: null });
    expect(cleared.status).toBe(200);
    expect((cleared.body?.template as { activeVersion: unknown }).activeVersion).toBeNull();
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/templates', { id: 'tpl-nope', activeVersion: null })).status).toBe(404);
  });
});
