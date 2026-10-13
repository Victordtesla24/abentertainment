/**
 * AB Entertainment email layout: in-process tests of src/lib/email/layout.ts against the design system it is built from.
 *
 * Each skin the layout claims (eyebrow, heading, Button primary, OrnamentDivider, footer) is checked against the files
 * in docs/design-system/ (the pulled Claude Design project), not against a second copy of the numbers, so a
 * re-pulled design system that changes a token fails here and flags the layout for review. Nothing in this file sends an
 * email or talks to an AI service; the AI reviewer is a scripted stand-in.
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir } from './support/email-unit';
import { StubAi, passingReview } from './fixtures/email-ai-stub';

type LayoutMod = typeof import('@/lib/email/layout');
type Rules = typeof import('@/lib/email/gate-rules');
type GateMod = typeof import('@/lib/email/gate');
type Store = typeof import('@/lib/email/store');
type Seed = typeof import('@/lib/email/seed');
type Ctx = typeof import('@/lib/email/context');
type Tokens = typeof import('@/lib/email/design-tokens');
type Hash = typeof import('@/lib/email/hash');
type EmailFields = import('@/lib/email/types').EmailFields;
type RenderContext = import('@/lib/email/types').RenderContext;
type RenderedEmail = import('@/lib/email/types').RenderedEmail;

const designSystem = (file: string) => readFileSync(join(process.cwd(), 'docs', 'design-system', file), 'utf-8');
const UNSUBSCRIBE = 'https://abentertainment.com.au/api/newsletter/unsubscribe?t=layout-test-token';
const NOW = new Date('2026-10-13T00:00:00Z');

/** The declarations of an inline style as property -> values in order (a browser keeps the last one it understands). */
function declarations(style: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of style.replace(/&#39;/g, "'").split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    const key = part.slice(0, at).trim().toLowerCase();
    if (key) (out[key] = out[key] ?? []).push(part.slice(at + 1).trim());
  }
  return out;
}
const last = (decl: Record<string, string[]>, property: string) => (decl[property] ?? []).slice(-1)[0];
const rem = (value: string) => `${Number((Number(value) * 16).toFixed(2))}px`;

test.describe.configure({ mode: 'serial' });

test.describe('AB Entertainment email layout', () => {
  let layoutMod: LayoutMod;
  let rules: Rules;
  let gate: GateMod;
  let store: Store;
  let seed: Seed;
  let context: Ctx;
  let tokens: Tokens;
  let hash: Hash;

  test.beforeAll(() => {
    loadWithUnitDir(() => {
      layoutMod = require('@/lib/email/layout') as LayoutMod;
      rules = require('@/lib/email/gate-rules') as Rules;
      gate = require('@/lib/email/gate') as GateMod;
      store = require('@/lib/email/store') as Store;
      seed = require('@/lib/email/seed') as Seed;
      context = require('@/lib/email/context') as Ctx;
      tokens = require('@/lib/email/design-tokens') as Tokens;
      hash = require('@/lib/email/hash') as Hash;
    });
  });

  test.beforeEach(() => cleanUnitDir());

  const ctx = (url = UNSUBSCRIBE, now = NOW): RenderContext => context.buildRenderContext(url, now);
  const fields = (overrides: Partial<EmailFields> = {}): EmailFields => ({ ...seed.SEED_WELCOME_FIELDS, ...overrides });
  const render = (overrides: Partial<EmailFields> = {}, c: RenderContext = ctx()): RenderedEmail => layoutMod.getLayout().render(fields(overrides), c);
  const check = (overrides: Partial<EmailFields> = {}) => rules.runDeterministicChecks({ fields: fields(overrides), settings: seed.DEFAULT_SETTINGS, layout: layoutMod.getLayout(), ctx: ctx() });
  /** The style attribute of the first tag in `html` matching `tag` (a regex source that includes one capture group for the style). */
  const styleOf = (html: string, tag: RegExp) => {
    const found = html.match(tag);
    if (!found) throw new Error(`no match for ${tag}`);
    return declarations(found[1]);
  };

  // ─── installation ──────────────────────────────────────────────────────────

  test('installed: the layout is the AB Entertainment layout, and its version is a fingerprint of what it renders', () => {
    const layout = layoutMod.getLayout();
    expect(layout).toMatchObject({ id: 'ab-entertainment', installed: true });
    expect(layout.version).toBe(`${layoutMod.LAYOUT_REVISION}.${layoutMod.layoutFingerprint(layout.render)}`);
    expect(layout.version).toMatch(/^1\.[0-9a-f]{10}$/);
    expect(layoutMod.layoutFingerprint(layout.render)).toBe(layoutMod.layoutFingerprint(layout.render)); // stable

    // any change to the markup or to the plain text changes the version, which voids every approval bound to it
    const html = (f: EmailFields, c: RenderContext) => ({ ...layout.render(f, c), html: layout.render(f, c).html.replace('Unsubscribe', 'Unsubscribe here') });
    const text = (f: EmailFields, c: RenderContext) => ({ ...layout.render(f, c), text: `${layout.render(f, c).text}\n` });
    const style = (f: EmailFields, c: RenderContext) => ({ ...layout.render(f, c), html: layout.render(f, c).html.replace('#C9A84C', '#D4B65C') });
    for (const changed of [html, text, style]) {
      expect(layoutMod.layoutFingerprint(changed)).not.toBe(layoutMod.layoutFingerprint(layout.render));
      expect(layoutMod.installLayout(changed).version).not.toBe(layout.version);
    }
    const binding = (version: string) => hash.bindingHash({ fields: fields(), layoutId: layout.id, layoutVersion: version, guidelinesVersion: 1, guidelinesText: 'rules' });
    expect(binding(layoutMod.installLayout(html).version)).not.toBe(binding(layout.version));
  });

  test('a layout that cannot render the fixed sample is "not installed": it fails closed', () => {
    const broken = layoutMod.installLayout(() => {
      throw new Error('cannot render');
    });
    expect(broken).toMatchObject({ id: 'none', version: '0', installed: false });
    expect(() => broken.render(fields(), ctx())).toThrow(layoutMod.LayoutNotInstalledError);
    const outcome = rules.runDeterministicChecks({ fields: fields(), settings: seed.DEFAULT_SETTINGS, layout: broken, ctx: ctx() });
    expect(outcome.rendered).toBeNull();
    expect(outcome.issues.map((i) => i.code)).toContain('layout_not_installed');
  });

  // ─── the message ───────────────────────────────────────────────────────────

  test('the seeded welcome renders in the brand layout and passes every deterministic check, in both parts', () => {
    const outcome = check();
    expect(outcome.issues, JSON.stringify(outcome.issues.map((i) => `${i.code}: ${i.message}`))).toEqual([]);
    const { html, text } = outcome.rendered!;
    expect(Buffer.byteLength(html)).toBeLessThan(30_000); // well under the ~102 KB at which Gmail clips a message
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en-AU">');
    expect(html).toContain('<title>Welcome to AB Entertainment</title>');
    expect(html).toContain('<h1 class="ab-h1"');
    for (const part of [html, text]) {
      expect(part).toContain(UNSUBSCRIBE);
      expect(part).toContain('abhi@abentertainment.com.au');
      expect(part).toContain('(+61) 430082646');
      expect(part).toContain('Melbourne VIC, Australia');
      expect(part).toContain('The AB Entertainment Community');
    }
    expect(html).toContain('<img src="https://abentertainment.com.au/images/AB_Logo_transparent-256w.png" alt="AB Entertainment"');
    expect(html).toContain(`>Unsubscribe</a>`);
    // the hidden preheader carries the preview text
    expect(html).toMatch(/<div style="display:none;[^"]*">Thank you for joining\. Indian and Marathi performing arts, presented with meticulous care\./);
  });

  test('the same inputs always render the same message; the per-recipient parts sit in fixed slots', () => {
    expect(render()).toEqual(render());
    const mine = render({}, ctx('https://abentertainment.com.au/api/newsletter/unsubscribe?t=recipient-one'));
    const other = render({}, ctx('https://abentertainment.com.au/api/newsletter/unsubscribe?t=recipient-two'));
    for (const part of ['html', 'text'] as const) {
      expect(mine[part]).toContain('t=recipient-one');
      expect(mine[part]).not.toContain('t=recipient-two');
      expect(other[part].replace('recipient-two', 'recipient-one')).toBe(mine[part]); // nothing else differs
    }
    expect(render({}, ctx(UNSUBSCRIBE, new Date('2031-01-01T00:00:00Z'))).html).toContain('&copy; 2031 AB Entertainment.');
    expect(render().html).toContain('&copy; 2026 AB Entertainment.');
  });

  // ─── design tokens ─────────────────────────────────────────────────────────

  test('design tokens: every colour and font family in the rendered email is declared in colors_and_type.css', () => {
    const css = designSystem('colors_and_type.css');
    const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const cssColours = new Set([...root.matchAll(/--color-[a-z0-9-]+:\s*([^;]+);/g)].map((m) => tokens.normaliseColour(m[1].replace(/\/\*.*$/, '').trim())));
    cssColours.add('#000000'); // the Button label: color '#000' in Button.jsx and .btn-primary
    expect(cssColours.size).toBeGreaterThan(30);
    const stack = (value: string) => value.split(',').map((family) => family.trim().replace(/^['"]|['"]$/g, '').toLowerCase()).join(',');
    const cssStacks = new Set([...root.matchAll(/--font-(?:display|body):\s*([^;]+);/g)].map((m) => stack(m[1])));
    expect([...cssStacks].sort()).toEqual(['dm sans,helvetica neue,helvetica,sans-serif', 'playfair display,georgia,serif']);

    const { html } = render();
    const colours = tokens.extractColours(html);
    expect(colours.length).toBeGreaterThan(40);
    for (const colour of colours) expect(cssColours.has(tokens.normaliseColour(colour)), `colour ${colour}`).toBe(true);
    // every font-family declaration is one of the two token stacks, exactly
    const used = new Set([...html.replace(/&#39;/g, "'").matchAll(/font-family:([^;"]+)/g)].map((m) => stack(m[1])));
    expect([...used].sort()).toEqual([...cssStacks].sort());
    // the gate's own check agrees
    expect(tokens.findOffBrandTokens(html)).toEqual({ colours: [], fonts: [] });
    // the palette the brand is known by is really in use: bg, surface, footer, gold, gold-light, white and the Button black
    const normalised = new Set(colours.map((c) => tokens.normaliseColour(c)));
    for (const colour of ['#0a0a0a', '#111111', '#070707', '#c9a84c', '#d4b65c', '#ffffff', '#000000', 'rgba(255,255,255,0.65)', 'rgba(201,168,76,0.4)']) expect(normalised.has(colour), colour).toBe(true);
  });

  test('every colour and font in any content an admin can write stays inside the token set (the layout adds nothing of its own)', () => {
    const wild = render({
      eyebrow: 'Discover',
      heading: 'A Heading With <b>Markup</b> & "Quotes"',
      body: 'Plain **bold** and *italic* with a [link](https://abentertainment.com.au/about/).\n\n- one\n- two\n\nLast paragraph.',
      ctaLabel: 'Contact Us',
      ctaUrl: 'https://abentertainment.com.au/contact/',
    });
    expect(tokens.findOffBrandTokens(wild.html)).toEqual({ colours: [], fonts: [] });
  });

  // ─── the design-system skins ───────────────────────────────────────────────

  test('Button primary: the call to action is the design-system button (gradient on gold, black uppercase label, sharp corners)', () => {
    const buttonJsx = designSystem('components/Button/Button.jsx');
    const spec = {
      fontSize: /fontSize: '([\d.]+)rem'/.exec(buttonJsx)![1],
      weight: /fontWeight: (\d+)/.exec(buttonJsx)![1],
      tracking: /letterSpacing: '([\d.]+em)'/.exec(buttonJsx)![1],
      padding: /md: \{ padding: '([^']+)' \}/.exec(buttonJsx)![1],
      gradient: /: '(linear-gradient\(135deg,#C9A84C,#D4B65C 50%,#C9A84C\))'/.exec(buttonJsx)![1],
    };
    const { html } = render();
    const label = styleOf(html, /<a href="https:\/\/abentertainment\.com\.au\/events\/" target="_blank" style="([^"]*)">View All Events<\/a>/);
    expect(last(label, 'font-size')).toBe(rem(spec.fontSize));
    expect(last(label, 'font-weight')).toBe(spec.weight);
    expect(last(label, 'letter-spacing')).toBe(spec.tracking);
    expect(last(label, 'padding')).toBe(spec.padding);
    expect(last(label, 'text-transform')).toBe('uppercase');
    expect(last(label, 'color')).toBe('#000000');
    expect(label['border-radius']).toBeUndefined(); // sharp corners
    expect(last(label, 'text-decoration')).toBe('none');
    const cell = styleOf(html, /<td align="center" bgcolor="#C9A84C" style="([^"]*)">/);
    expect(last(cell, 'background-image')).toBe(spec.gradient);
    expect(last(cell, 'background-color')).toBe('#C9A84C'); // the solid fallback for Outlook
    expect(buttonJsx).toContain("color: '#000'");
    expect(buttonJsx).toContain("textTransform: 'uppercase'");
    // the label is the admin's words; the design system's ALL CAPS is done by the layout, not typed by the admin
    expect(render().text).toContain('VIEW ALL EVENTS\nhttps://abentertainment.com.au/events/');
  });

  test('eyebrow and heading: the .t-eyebrow style in gold, then a Title Case Playfair Display heading', () => {
    const css = designSystem('colors_and_type.css');
    const eyebrowRule = css.match(/\.t-eyebrow\s*\{([\s\S]*?)\}/)![1];
    expect(eyebrowRule).toMatch(/font-size:\s*var\(--text-xs\)/); // 0.75rem = 12px
    expect(eyebrowRule).toMatch(/font-weight:\s*600/);
    expect(eyebrowRule).toMatch(/letter-spacing:\s*var\(--ls-eyebrow\)/); // 0.25em
    expect(eyebrowRule).toMatch(/text-transform:\s*uppercase/);
    expect(eyebrowRule).toMatch(/color:\s*var\(--color-gold\)/);
    expect(css).toMatch(/--text-xs:\s*0\.75rem/);
    expect(css).toMatch(/--ls-eyebrow:\s*0\.25em/);
    const { html } = render();
    const eyebrow = styleOf(html, /<div style="padding:0 0 16px;([^"]*)">Welcome to<\/div>/);
    expect(last(eyebrow, 'font-size')).toBe('12px');
    expect(last(eyebrow, 'font-weight')).toBe('600');
    expect(last(eyebrow, 'letter-spacing')).toBe('0.25em');
    expect(last(eyebrow, 'text-transform')).toBe('uppercase');
    expect(last(eyebrow, 'color')).toBe('#C9A84C');

    const heading = styleOf(html, /<h1 class="ab-h1" style="([^"]*)">The AB Entertainment Community<\/h1>/);
    expect(last(heading, 'font-family')).toBe("'Playfair Display',Georgia,serif");
    expect(last(heading, 'font-weight')).toBe('700');
    expect(last(heading, 'color')).toBe('#FFFFFF');
    expect(last(heading, 'font-size')).toBe('36px'); // --text-4xl, the section heading size (.t-h2)
    expect(last(heading, 'text-transform')).toBeUndefined(); // Title Case stays Title Case

    // no eyebrow, no eyebrow markup
    const without = render({ eyebrow: '' });
    expect(without.html).not.toContain('letter-spacing:0.25em');
    expect(without.text.startsWith('AB ENTERTAINMENT\n\nThe AB Entertainment Community')).toBe(true);
    expect(render().text.startsWith('AB ENTERTAINMENT\n\nWELCOME TO\n\nThe AB Entertainment Community')).toBe(true);
  });

  test('OrnamentDivider: two 64px lines in gold-40 around a hollow diamond in gold-50, 12px apart', () => {
    const jsx = designSystem('components/OrnamentDivider/OrnamentDivider.jsx');
    expect(jsx).toMatch(/width = 64/);
    expect(jsx).toMatch(/gap: 12/);
    expect(jsx).toContain('rgba(201,168,76,0.4)'); // the lines
    expect(jsx).toContain('rgba(201,168,76,0.5)'); // the diamond's border
    const { html } = render();
    expect(html.match(/<td valign="middle" width="64" style="width:64px;">/g)).toHaveLength(2);
    expect(html.match(/height:1px;line-height:1px;font-size:1px;background-color:#B0923F;background-color:rgba\(201,168,76,0\.4\);/g)).toHaveLength(2);
    const glyph = html.match(/<td valign="middle" align="center" style="([^"]*)">&#9671;<\/td>/);
    expect(glyph).not.toBeNull();
    const decl = declarations(glyph![1]);
    expect(last(decl, 'padding')).toBe('0 12px');
    expect(decl['color']).toEqual(['#B0923F', 'rgba(201,168,76,0.5)']); // Outlook keeps the first, everything else the second
    expect(rules.hasEmoji(html)).toBe(false); // U+25C7 is a text glyph, not an emoji
    expect(html.match(/&#9671;/g)).toHaveLength(1);
  });

  test('footer: the design-system footer pattern with the sender identity and the unsubscribe link', () => {
    const footerJsx = designSystem('ui_kits/website/footer.jsx');
    expect(footerJsx).toContain("background:'#070707'");
    expect(footerJsx).toContain("'Experience events like no other'");
    expect(footerJsx).toContain("alt:'AB Entertainment'");
    expect(footerJsx).toContain("'(+61) 430082646'");
    expect(footerJsx).toContain("'abhi@abentertainment.com.au'");
    for (const label of ['Instagram', 'Facebook', 'Privacy Policy', 'Terms of Service']) expect(footerJsx).toContain(label);
    expect(footerJsx).toContain('© ${year} AB Entertainment. All rights reserved.');

    const { html, text } = render();
    const footerCell = html.match(/<td align="center" class="ab-pad" bgcolor="#070707" style="([^"]*)">/);
    expect(footerCell).not.toBeNull();
    expect(last(declarations(footerCell![1]), 'background-color')).toBe('#070707');
    // logo, name, tagline
    expect(html.match(/<img [^>]*alt="AB Entertainment"/g)).toHaveLength(2); // the header and the footer lockup
    expect(html).toContain('Experience events like no other</div>');
    const tagline = html.match(/<div style="([^"]*)">Experience events like no other<\/div>/)!;
    expect(last(declarations(tagline[1]), 'font-size')).toBe('9px');
    expect(last(declarations(tagline[1]), 'letter-spacing')).toBe('0.15em');
    expect(last(declarations(tagline[1]), 'text-transform')).toBe('uppercase');
    // contact, social, site links, legal
    expect(html).toContain('href="tel:+61430082646"');
    expect(html).toContain('href="mailto:abhi@abentertainment.com.au"');
    expect(html).toContain('href="https://instagram.com/abentertainment_events/"');
    expect(html).toContain('href="https://facebook.com/ABEntertainmentAU"');
    for (const path of ['/events/', '/gallery/', '/sponsors/', '/contact/', '/privacy/', '/terms/']) expect(html).toContain(`href="https://abentertainment.com.au${path}"`);
    expect(html).toContain('You are receiving this email because you subscribed to updates from AB Entertainment. <a href="https://abentertainment.com.au/api/newsletter/unsubscribe?t=layout-test-token"');
    expect(text).toContain('You are receiving this email because you subscribed to updates from AB Entertainment.\nUnsubscribe: https://abentertainment.com.au/api/newsletter/unsubscribe?t=layout-test-token');
    expect(text).toContain('© 2026 AB Entertainment. All rights reserved.');
    expect(text).toContain('Instagram: https://instagram.com/abentertainment_events/');
  });

  // ─── content handling ──────────────────────────────────────────────────────

  test('the body is set in brand styles: paragraphs, bullets, bold, italic and links', () => {
    const { html } = render({ body: 'A paragraph with **bold**, *italic* and a [link](https://abentertainment.com.au/about/).\n\n- First point\n- Second point' });
    const p = html.match(/<p style="([^"]*)">A paragraph with /);
    expect(p).not.toBeNull();
    const para = declarations(p![1]);
    expect(last(para, 'font-size')).toBe('16px');
    expect(last(para, 'line-height')).toBe('28px');
    expect(para['color']).toEqual(['#FFFFFF', 'rgba(255,255,255,0.65)']);
    expect(last(para, 'font-family')).toBe("'DM Sans','Helvetica Neue',Helvetica,sans-serif");
    expect(html).toContain('<strong style="font-weight:700;color:#FFFFFF;">bold</strong>');
    expect(html).toContain('<em style="font-style:italic;">italic</em>');
    expect(html).toContain('<a href="https://abentertainment.com.au/about/" style="color:#C9A84C;text-decoration:underline;">link</a>');
    expect(html).toMatch(/<ul style="[^"]*"><li style="[^"]*">First point<\/li><li style="[^"]*">Second point<\/li><\/ul>/);
  });

  test('everything an admin writes is escaped; nothing can add markup, script or attributes', () => {
    const rendered = render({
      subject: 'A & B <i>x</i> "q"',
      preheader: 'Pre <script>alert(1)</script> header & more text here',
      eyebrow: '<u>Eyebrow</u>',
      heading: 'Heading <b>bold</b> & "quoted"',
      body: 'Body with <img src=x onerror=alert(1)> and [a link](https://abentertainment.com.au/"onmouseover="alert(1))\n\nSecond <script>x</script> paragraph, long enough to be a real paragraph of text here.',
      ctaLabel: 'Go <b>now</b>',
      ctaUrl: 'https://abentertainment.com.au/a?b=1&c="2"',
    });
    const { html } = rendered;
    // structure: only the layout's own tags and attributes exist (a comment is not a tag), whatever the admin typed
    const tags = html.replace(/<!--[\s\S]*?-->/g, '').match(/<[a-z][^>]*>/gi) ?? [];
    const allowedTags = new Set(['html', 'head', 'meta', 'title', 'style', 'body', 'div', 'table', 'tr', 'td', 'a', 'img', 'h1', 'p', 'ul', 'li', 'strong', 'em', 'br']);
    const allowedAttributes = new Set(['lang', 'charset', 'name', 'content', 'style', 'role', 'width', 'height', 'cellpadding', 'cellspacing', 'border', 'bgcolor', 'align', 'valign', 'class', 'href', 'target', 'src', 'alt']);
    for (const tag of tags) {
      expect(allowedTags.has(/^<([a-z0-9]+)/i.exec(tag)![1].toLowerCase()), tag).toBe(true);
      const withoutValues = tag.replace(/="[^"]*"/g, '=""');
      for (const attribute of withoutValues.matchAll(/\s([a-z][a-z0-9:-]*)(?==|\s|>|\/)/gi)) expect(allowedAttributes.has(attribute[1].toLowerCase()), `${attribute[1]} in ${tag}`).toBe(true);
    }
    expect(html.match(/<script/gi)).toBeNull();
    expect(html.match(/<img /gi)).toHaveLength(2); // the two logos; the "<img src=x ...>" the admin typed is text
    expect(html).toContain('Body with &lt;img src=x onerror=alert(1)&gt; and ');
    expect(html).toContain('href="https://abentertainment.com.au/&quot;onmouseover=&quot;alert(1"'); // a quote cannot end the attribute
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('<title>A &amp; B &lt;i&gt;x&lt;/i&gt; &quot;q&quot;</title>');
    expect(html).toContain('>&lt;u&gt;Eyebrow&lt;/u&gt;</div>');
    expect(html).toContain('Heading &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;</h1>');
    expect(html).toContain('href="https://abentertainment.com.au/a?b=1&amp;c=&quot;2&quot;"');
    expect(html).toContain('>Go &lt;b&gt;now&lt;/b&gt;</a>');
    // and the gate says so for the fields where markup is not allowed
    const codes = check({ body: 'Body with <img src=x onerror=alert(1)> and more words that make this a long enough body for the checks to proceed to the markup rule.' }).issues.map((i) => i.code);
    expect(codes).toContain('body_html_not_allowed');
  });

  test('a call to action needs both its label and its link; without either there is no button', () => {
    for (const overrides of [{ ctaUrl: '' }, { ctaLabel: '' }, { ctaLabel: '', ctaUrl: '' }]) {
      const { html, text } = render(overrides);
      expect(html).not.toContain('letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#000000');
      expect(text).not.toContain('VIEW ALL EVENTS');
    }
    expect(render().html).toContain('>View All Events</a>');
  });

  test('the plain-text part mirrors the message: no markup, the words, the link and the footer', () => {
    const { text } = render();
    expect(text).not.toMatch(/<[a-z!/]/i);
    expect(text).toContain('- Early word of upcoming productions and festivals');
    expect(text).toContain('Thank you for joining the AB Entertainment community.');
    expect(text.indexOf('WELCOME TO')).toBeLessThan(text.indexOf('The AB Entertainment Community'));
    expect(text.indexOf('The AB Entertainment Community')).toBeLessThan(text.indexOf('Thank you for joining'));
    expect(text.indexOf('VIEW ALL EVENTS')).toBeLessThan(text.indexOf('Unsubscribe:'));
    expect(rules.hasEmoji(text)).toBe(false);
  });

  test('email-client safety: tables with roles, no scripts or external resources, fluid on phones, light', () => {
    const { html } = render();
    expect(html).not.toMatch(/<script|<link|<iframe|<form|@import|url\(|javascript:/i);
    for (const table of html.match(/<table\b[^>]*>/g) ?? []) expect(table, table).toContain('role="presentation"');
    expect(html).toContain('<div style="max-width:600px;margin:0 auto;">');
    expect(html).toContain('<!--[if mso]><table role="presentation" width="600"');
    expect(html).toContain('<meta name="viewport" content="width=device-width,initial-scale=1">');
    expect(html).toContain('<meta name="color-scheme" content="dark">');
    const media = html.match(/@media only screen and \(max-width:620px\)\{([^}]*\}[^}]*)\}/)![1];
    expect(media).not.toMatch(/color|font-family/); // the phone rules only narrow padding and size; the brand tokens stay inline
    for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
      expect(img).toMatch(/\salt="AB Entertainment"/);
      expect(img).toMatch(/\swidth="\d+"/);
      expect(img).toMatch(/\sheight="\d+"/);
    }
    const longest = render({ body: Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1}: ${'Words and more words. '.repeat(9)}`).join('\n\n').slice(0, 2500) });
    expect(Buffer.byteLength(longest.html)).toBeLessThan(40_000);
  });

  // ─── through the gate ──────────────────────────────────────────────────────

  test('end to end: the gate approves the seeded welcome in the brand layout (AI stubbed), the send check passes on the exact message, and a changed layout voids the approval', async () => {
    const layout = layoutMod.getLayout();
    const guidelines = { text: seed.DEFAULT_GUIDELINES_TEXT, version: 1, updatedAt: '', updatedBy: '' };
    const template = (await store.getEmailTemplates())[0];
    const stub = new StubAi([passingReview()]);
    const result = await gate.runGate({ fields: template.versions[0].fields, settings: seed.DEFAULT_SETTINGS, guidelines }, { layout, ai: stub, ctx: ctx() });
    expect(result).toMatchObject({ passed: true, stopReason: 'passed' });
    expect(result.rounds[0].deterministic).toEqual([]);
    expect(stub.reviewCalls).toHaveLength(1);
    expect(stub.reviewCalls[0].plainText).toContain(`Unsubscribe: ${UNSUBSCRIBE}`); // the reviewer reads what the recipient reads

    const approval = gate.buildApproval(result, layout, guidelines);
    expect(approval).toMatchObject({ layoutId: 'ab-entertainment', layoutVersion: layout.version });
    await store.recordGateOutcome(template.id, 1, { result, approval });
    const active = await store.setActiveVersion(template.id, 1, (version) => (gate.approvalState(version, layout, guidelines).state === 'approved' ? null : 'not approved'));
    expect(active.activeVersion).toBe(1);

    // sending: no AI call; the exact message for this recipient passes
    const recipient = ctx('https://abentertainment.com.au/api/newsletter/unsubscribe?t=the-recipients-own-token');
    const sent = gate.verifyForSend({ template: active, settings: seed.DEFAULT_SETTINGS, guidelines, layout, ctx: recipient });
    expect(sent.ok).toBe(true);
    if (sent.ok) {
      expect(sent.rendered.html).toContain('t=the-recipients-own-token');
      expect(sent.rendered.text).toContain('t=the-recipients-own-token');
      expect(sent.rendered.html).not.toContain('t=layout-test-token');
    }
    expect(stub.reviewCalls).toHaveLength(1);

    // the layout changes (any change to its output): the approval no longer applies, so nothing is sent until it is reviewed again
    const redesigned = layoutMod.installLayout((f, c) => ({ ...layout.render(f, c), html: layout.render(f, c).html.replace('Instagram', 'Instagram profile') }));
    expect(redesigned.version).not.toBe(layout.version);
    expect(gate.verifyForSend({ template: active, settings: seed.DEFAULT_SETTINGS, guidelines, layout: redesigned, ctx: recipient })).toMatchObject({ ok: false, reason: 'approval_stale' });
  });
});
