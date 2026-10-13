/**
 * The deterministic half of the quality gate: pure checks over the fields an admin wrote and over the final
 * rendered message. Anything found here blocks the email; nothing is advisory. The AI review (ai-review.ts) judges
 * what these rules cannot (voice, tone, language, quality). Both run on every approval and the deterministic part
 * runs again, on the exact message, at every send.
 */

import { escapeHtml, findBodyViolations, findUrls } from './body-format';
import { extractColours, findOffBrandTokens, normaliseColour } from './design-tokens';
import type { EmailFieldName, EmailFields, EmailLayout, EmailSettings, GateField, GateIssue, RenderContext, RenderedEmail } from './types';

export const GATE_LIMITS = {
  subject: { min: 8, max: 78 },
  preheader: { min: 20, max: 140 },
  eyebrow: { max: 40 },
  heading: { min: 3, max: 80 },
  body: { min: 120, max: 2500 },
  ctaLabel: { min: 2, max: 30, maxWords: 5 },
  /** Gmail clips a message whose HTML is larger than about 102 KB. */
  htmlBytes: 100_000,
} as const;

function issue(field: GateField, code: string, message: string, suggestion?: string, fixable = true): GateIssue {
  return { source: 'deterministic', code, field, message, ...(suggestion ? { suggestion } : {}), fixable, severity: 'blocker' };
}

const TEXT_FIELDS: readonly EmailFieldName[] = ['subject', 'preheader', 'eyebrow', 'heading', 'body', 'ctaLabel'];
const FIELD_TO_GATE: Record<EmailFieldName, GateField> = {
  subject: 'subject',
  preheader: 'preheader',
  eyebrow: 'eyebrow',
  heading: 'heading',
  body: 'body',
  ctaLabel: 'cta',
  ctaUrl: 'cta',
};

// ─── Placeholders ────────────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS: Array<[RegExp, string]> = [
  [/lorem ipsum|dolor sit amet|consectetur adipiscing/i, 'lorem ipsum text'],
  [/\b(?:TODO|TBD|TBC|FIXME|XXX)\b/, 'a TODO or TBD marker'],
  [/\b(?:placeholder|insert (?:text|name|link|date)|your name here|name here)\b/i, 'placeholder wording'],
  [/\{\{[^}]*\}\}|\{%[^%]*%\}|\$\{[^}]*\}|<%[^%]*%>|%[A-Z][A-Z0-9_]{2,}%|\[\[[^\]]*\]\]/, 'an unrendered template variable'],
  [/\[(?:name|first name|last name|company|insert[^\]]*|your[^\]]*|link|date|time|venue|event name|city)\](?!\()/i, 'a bracketed placeholder'],
  [/\bundefined\b|\[object Object\]|\bNaN\b/, 'an unrendered value'],
];

// ─── Spam and brand heuristics ───────────────────────────────────────────────

const SPAM_PHRASES = [
  'act now', 'limited time', 'click here', 'click below', 'buy now', 'order now', 'free money', 'guaranteed', 'winner',
  'you have won', '100% free', 'no obligation', 'risk-free', 'risk free', 'urgent', 'make money', 'cash bonus',
  'once in a lifetime', "don't miss out", 'dont miss out', 'last chance', 'hurry', 'exclusive deal', 'congratulations',
  'no cost', 'this is not spam', 'amazing offer', 'double your', 'earn extra', 'increase sales', 'lowest price',
  'special promotion', 'apply now', 'call now', 'while supplies last', 'what are you waiting for', "you won't believe",
  'you wont believe', 'dear friend', 'miracle', 'no strings attached', 'satisfaction guaranteed', 'limited offer',
];

const ACRONYMS = new Set(['AB', 'VIC', 'NSW', 'QLD', 'TAS', 'ACT', 'AU', 'AUD', 'USA', 'UK', 'NZ', 'DJ', 'MC', 'VIP', 'FAQ', 'RSVP', 'PDF', 'BYO', 'GST', 'ABN', 'CEO', 'TBA', 'FM', 'TV', 'CD', 'DVD', 'ID', 'PM', 'AM', 'SMS', 'ATM', 'NGO']);

/** American spellings the brand writes the Australian way (README: Australian English, en_AU). */
const US_SPELLINGS: Array<[RegExp, string, string]> = [
  [/\bcolors?\b/i, 'color', 'colour'],
  [/\bfavorites?\b/i, 'favorite', 'favourite'],
  [/\bcenters?\b/i, 'center', 'centre'],
  [/\bcentered\b/i, 'centered', 'centred'],
  [/\borganiz(?:e|es|ed|ing|ation|ations)\b/i, 'organize', 'organise'],
  [/\btheaters?\b/i, 'theater', 'theatre'],
  [/\bhonor(?:s|ed|ing)?\b/i, 'honor', 'honour'],
  [/\bneighbors?\b/i, 'neighbor', 'neighbour'],
  [/\banalyz(?:e|es|ed|ing)\b/i, 'analyze', 'analyse'],
  [/\brealiz(?:e|es|ed|ing)\b/i, 'realize', 'realise'],
  [/\bcatalogs?\b/i, 'catalog', 'catalogue'],
  [/\btravel(?:er|ers|ed|ing)\b/i, 'traveler', 'traveller'],
  [/\bdefense\b/i, 'defense', 'defence'],
  [/\bgray\b/i, 'gray', 'grey'],
  [/\bjewelry\b/i, 'jewelry', 'jewellery'],
  [/\bfiber\b/i, 'fiber', 'fibre'],
  [/\bmom\b/i, 'mom', 'mum'],
  [/\bapologiz(?:e|es|ed|ing)\b/i, 'apologize', 'apologise'],
];

const GENERIC_CTA = /^(?:click here|click|here|learn more|read more|more|submit|link|go|this|tap here|find out more)$/i;
const SHORTENERS = new Set(['bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'lnkd.in', 'cutt.ly', 'shorturl.at', 'rb.gy']);
const TITLE_CASE_SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'with']);

function stripUrls(value: string): string {
  return value.replace(/https?:\/\/\S+/gi, ' ');
}

/** True when the text uses an emoji or an emoticon (the (c), (r) and TM signs are fine). */
export function hasEmoji(value: string): boolean {
  const cleaned = value.replace(/[©®™︎️]/g, '');
  return /\p{Extended_Pictographic}/u.test(cleaned) || /(?:^|\s)(?::-?[)(DPp]|;-?\)|<3)(?=\s|$|[.,!?])/.test(cleaned);
}

function shoutingReason(value: string): string | null {
  const text = stripUrls(value);
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  if (letters >= 12) {
    const upper = (text.match(/[A-Z]/g) ?? []).length;
    if (upper / letters > 0.5) return 'it is mostly in capital letters';
  }
  const shouted = (text.match(/\b[A-Z]{3,}\b/g) ?? []).find((word) => !ACRONYMS.has(word));
  if (shouted) return `the word "${shouted}" is in capital letters`;
  if (/\b[A-Z]{2,}(?:\s+[A-Z]{2,}){2,}\b/.test(text)) return 'it has a run of capitalised words';
  return null;
}

/** Title Case, leniently: first and last word capitalised, other words of three letters or more capitalised unless a small word. */
export function titleCaseProblems(heading: string): string[] {
  const letters = heading.replace(/[^A-Za-z]/g, '');
  if (letters && letters === letters.toUpperCase()) return []; // ALL CAPS display headings are allowed
  const words = heading.trim().split(/\s+/).filter(Boolean);
  const bad: string[] = [];
  words.forEach((word, index) => {
    const core = word.replace(/^[^A-Za-z]+/, '');
    if (!core || /\d/.test(core)) return;
    const first = core[0];
    const capitalised = first === first.toUpperCase() && first !== first.toLowerCase();
    const edge = index === 0 || index === words.length - 1;
    const small = TITLE_CASE_SMALL_WORDS.has(core.toLowerCase().replace(/[^a-z]/g, ''));
    if (edge || (!small && core.replace(/[^A-Za-z]/g, '').length >= 3)) {
      if (!capitalised) bad.push(word);
    }
  });
  return bad;
}

// ─── Fields ──────────────────────────────────────────────────────────────────

function checkFieldText(fields: EmailFields): GateIssue[] {
  const issues: GateIssue[] = [];
  const get = (name: EmailFieldName) => (fields[name] ?? '').trim();
  const L = GATE_LIMITS;

  const subject = get('subject');
  if (!subject) issues.push(issue('subject', 'subject_missing', 'The subject is empty.', 'Write an honest, dignified subject of about 30 to 60 characters.'));
  else if (subject.length < L.subject.min) issues.push(issue('subject', 'subject_too_short', `The subject is only ${subject.length} characters.`, `Make it at least ${L.subject.min} characters and say what the email is.`));
  else if (subject.length > L.subject.max) issues.push(issue('subject', 'subject_too_long', `The subject is ${subject.length} characters; inboxes cut it off after about ${L.subject.max}.`, 'Shorten it to about 30 to 60 characters.'));

  const preheader = get('preheader');
  if (!preheader) issues.push(issue('preheader', 'preheader_missing', 'The preheader (the preview text beside the subject) is empty.', 'Add one sentence that continues the subject.'));
  else if (preheader.length < L.preheader.min || preheader.length > L.preheader.max) issues.push(issue('preheader', 'preheader_length', `The preheader is ${preheader.length} characters; it should be ${L.preheader.min} to ${L.preheader.max}.`, 'Write one sentence that continues the subject.'));

  const eyebrow = get('eyebrow');
  if (eyebrow.length > L.eyebrow.max) issues.push(issue('eyebrow', 'eyebrow_too_long', `The eyebrow is ${eyebrow.length} characters; it should be a few words (at most ${L.eyebrow.max}).`, 'Use one to four words, such as "Welcome to".'));

  const heading = get('heading');
  if (!heading) issues.push(issue('heading', 'heading_missing', 'The heading is empty.', 'Add a Title Case heading.'));
  else {
    if (heading.length < L.heading.min || heading.length > L.heading.max) issues.push(issue('heading', 'heading_length', `The heading is ${heading.length} characters; it should be ${L.heading.min} to ${L.heading.max}.`, 'Shorten the heading.'));
    const bad = titleCaseProblems(heading);
    if (bad.length) issues.push(issue('heading', 'heading_not_title_case', `The heading is not in Title Case (${bad.map((w) => `"${w}"`).join(', ')}).`, 'Capitalise the main words of the heading (Title Case), or set it entirely in capitals for a display heading.'));
  }

  const body = get('body');
  if (!body) issues.push(issue('body', 'body_missing', 'The body is empty.', 'Write the message in composed, formal-but-warm paragraphs.'));
  else if (body.length < L.body.min) issues.push(issue('body', 'body_too_short', `The body is only ${body.length} characters; it needs at least ${L.body.min} to be a proper message.`, 'Add a short, gracious paragraph.'));
  else if (body.length > L.body.max) issues.push(issue('body', 'body_too_long', `The body is ${body.length} characters; keep it under ${L.body.max} so it reads on a phone in a minute.`, 'Shorten the body.'));

  const label = get('ctaLabel');
  const url = get('ctaUrl');
  if (label && !url) issues.push(issue('cta', 'cta_incomplete', 'The call to action has a label but no link.', 'Add the https link, or remove the label.'));
  if (!label && url) issues.push(issue('cta', 'cta_incomplete', 'The call to action has a link but no label.', 'Add a short Title Case label such as "View All Events", or remove the link.'));
  if (label) {
    const words = label.split(/\s+/).length;
    if (label.length < L.ctaLabel.min || label.length > L.ctaLabel.max || words > L.ctaLabel.maxWords) issues.push(issue('cta', 'cta_label_length', `The call-to-action label should be ${L.ctaLabel.min} to ${L.ctaLabel.max} characters and at most ${L.ctaLabel.maxWords} words.`, 'Use a short, verb-led phrase such as "View All Events".'));
    if (GENERIC_CTA.test(label)) issues.push(issue('cta', 'cta_label_generic', `"${label}" does not say what the button does.`, 'Describe the action: "View All Events", "Contact Us".'));
  }

  for (const name of TEXT_FIELDS) {
    const value = get(name);
    if (!value) continue;
    const field = FIELD_TO_GATE[name];
    for (const [pattern, what] of PLACEHOLDER_PATTERNS) {
      if (pattern.test(value)) issues.push(issue(field, 'placeholder_found', `The ${name} contains ${what}.`, 'Replace it with the real wording.'));
    }
    if (hasEmoji(value)) issues.push(issue(field, 'emoji_found', `The ${name} contains an emoji or emoticon; the brand uses none anywhere.`, 'Remove it.'));
    if (/!{2,}|\?{2,}|[!?]{2,}|\${2,}|\.{4,}/.test(value)) issues.push(issue(field, 'excess_punctuation', `The ${name} has excessive punctuation.`, 'Use ordinary punctuation.'));
    if (name !== 'ctaLabel' && name !== 'eyebrow' && name !== 'heading') {
      const reason = shoutingReason(value);
      if (reason) issues.push(issue(field, 'shouting', `The ${name} reads as shouting: ${reason}.`, 'Use sentence case (the layout sets display text in capitals).'));
    }
    const normalised = value.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
    for (const phrase of SPAM_PHRASES) {
      if (new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`, 'i').test(normalised)) {
        issues.push(issue(field, 'spam_phrase', `The ${name} contains "${phrase}", which reads as a spam or hype phrase.`, 'Say it plainly and with dignity.'));
      }
    }
    const prose = stripUrls(value);
    for (const [pattern, us, au] of US_SPELLINGS) {
      if (pattern.test(prose)) issues.push(issue(field, 'us_spelling', `The ${name} uses the American spelling "${us}"; the brand writes Australian English.`, `Use "${au}".`));
    }
    if (/https?:\/\/|\bwww\./i.test(value) && name !== 'body') issues.push(issue(field, 'link_in_text_field', `The ${name} contains a link; links belong in the body or the call to action.`, 'Remove it.'));
  }
  if (/!/.test(subject)) issues.push(issue('subject', 'subject_exclamation', 'The subject contains an exclamation mark.', 'Remove it: subjects are written without one.'));
  const exclamations = TEXT_FIELDS.reduce((sum, name) => sum + ((get(name).match(/!/g) ?? []).length), 0);
  if (exclamations > 1) issues.push(issue('global', 'too_many_exclamations', `The email has ${exclamations} exclamation marks; at most one is allowed in a whole email.`, 'Remove all but one.'));

  const violations = findBodyViolations(fields.body ?? '');
  if (violations.includes('html')) issues.push(issue('body', 'body_html_not_allowed', 'The body contains HTML markup, which is not allowed.', 'Use plain text with the simple formatting only (blank lines, "- " bullets, **bold**, *italic*, [label](https://link)).'));
  if (violations.includes('image')) issues.push(issue('body', 'body_image_not_allowed', 'The body contains an image; the layout supplies all imagery.', 'Remove it.'));
  return issues;
}

// ─── Links ───────────────────────────────────────────────────────────────────

function checkUrl(raw: string, field: GateField, allowed: readonly string[]): GateIssue[] {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [issue(field, 'link_invalid', `"${raw}" is not a valid link.`, 'Use a full https link.')];
  }
  if (url.protocol !== 'https:') {
    const code = url.protocol === 'http:' ? 'link_not_https' : 'link_scheme_blocked';
    return [issue(field, code, `The link "${raw}" is not an https link.`, 'Use an https link to an allowed domain.')];
  }
  const out: GateIssue[] = [];
  const host = url.hostname.toLowerCase();
  if (url.username || url.password) out.push(issue(field, 'link_userinfo', `The link "${raw}" contains a user name or password.`, 'Remove it.'));
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) out.push(issue(field, 'link_ip_host', `The link "${raw}" points to a raw IP address.`, 'Link to the website by name.'));
  if (host.split('.').some((label) => label.startsWith('xn--'))) out.push(issue(field, 'link_punycode', `The link "${raw}" uses an internationalised look-alike host.`, 'Use the real domain.'));
  if (SHORTENERS.has(host)) out.push(issue(field, 'link_shortener', `The link "${raw}" is a shortened link.`, 'Use the full address.'));
  if (!allowed.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    out.push(issue(field, 'link_domain_not_allowed', `The link "${raw}" points to ${host}, which is not an allowed domain.`, `Link only to: ${allowed.join(', ')}.`));
  }
  return out;
}

function checkLinks(fields: EmailFields, allowed: readonly string[]): GateIssue[] {
  const issues: GateIssue[] = [];
  const ctaUrl = (fields.ctaUrl ?? '').trim();
  if (ctaUrl) issues.push(...checkUrl(ctaUrl, 'cta', allowed));
  const body = fields.body ?? '';
  const seen = new Set<string>();
  for (const url of findUrls(body)) {
    if (seen.has(url)) continue;
    seen.add(url);
    issues.push(...checkUrl(url, 'body', allowed));
  }
  // a link whose visible text is a different address than the one it opens
  for (const m of body.matchAll(/\[([^\]\n]{1,120})\]\((https:\/\/[^\s)]{1,300})\)/g)) {
    const shown = m[1].trim();
    if (/^(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?$/i.test(shown)) {
      try {
        const shownHost = new URL(/^https?:\/\//i.test(shown) ? shown : `https://${shown}`).hostname.toLowerCase();
        if (shownHost !== new URL(m[2]).hostname.toLowerCase()) {
          issues.push(issue('body', 'link_text_mismatch', `The link text "${shown}" shows a different address from the one it opens.`, 'Make the link text describe the destination in words.'));
        }
      } catch { /* an unparsable text is covered by the link checks */ }
    }
  }
  return issues;
}

// ─── The rendered message ────────────────────────────────────────────────────

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function checkRendered(rendered: RenderedEmail, fields: EmailFields, ctx: RenderContext, allowed: readonly string[]): GateIssue[] {
  const issues: GateIssue[] = [];
  const { html, text } = rendered;
  const layoutIssue = (code: string, message: string, suggestion?: string) => issues.push(issue('layout', code, message, suggestion, false));
  const globalIssue = (code: string, message: string, suggestion?: string) => issues.push(issue('global', code, message, suggestion, false));

  if (Buffer.byteLength(html, 'utf8') > GATE_LIMITS.htmlBytes) layoutIssue('html_too_large', `The rendered email is ${Buffer.byteLength(html, 'utf8')} bytes; Gmail clips messages over about ${GATE_LIMITS.htmlBytes}.`, 'Shorten the content.');
  if (!text.trim()) layoutIssue('text_missing', 'The plain-text version of the email is empty.');

  // the unsubscribe link: a fixed slot, in both parts, and a link that really is the unsubscribe endpoint
  const unsubscribe = ctx.unsubscribeUrl;
  let unsubscribeUrl: URL | null = null;
  try { unsubscribeUrl = new URL(unsubscribe); } catch { /* reported below */ }
  if (!unsubscribeUrl || unsubscribeUrl.protocol !== 'https:' || unsubscribeUrl.pathname !== '/api/newsletter/unsubscribe') {
    globalIssue('unsubscribe_link_invalid', 'The unsubscribe link is not an https link to /api/newsletter/unsubscribe.');
  }
  if (!html.includes(unsubscribe) && !html.includes(escapeHtml(unsubscribe))) layoutIssue('unsubscribe_missing_html', 'The unsubscribe link is missing from the HTML part of the email.');
  if (!text.includes(unsubscribe)) layoutIssue('unsubscribe_missing_text', 'The unsubscribe link is missing from the plain-text part of the email.');

  // sender identity (the Spam Act 2003 requires it): who sent it and how to reach them
  for (const [label, part] of [['HTML', html], ['plain-text', text]] as const) {
    const lower = part.toLowerCase();
    const hasName = lower.includes(ctx.sender.name.toLowerCase());
    const hasPlace = lower.includes(ctx.sender.city.toLowerCase());
    const hasContact = lower.includes(ctx.sender.contactEmail.toLowerCase()) || part.includes(ctx.sender.contactPhone);
    if (!hasName || !hasPlace || !hasContact) layoutIssue('sender_identity_missing', `The ${label} part does not identify the sender (name, Melbourne and a contact address or phone are required).`);
  }

  // images: the logo with alt text, an https source on an allowed host, no tracking pixels
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const attr = (tag: string, name: string) => decodeEntities(tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((v) => v !== undefined) ?? '');
  if (!images.some((tag) => attr(tag, 'src') === ctx.logoUrl)) layoutIssue('logo_missing', 'The AB Entertainment logo is missing from the email.');
  for (const tag of images) {
    const src = attr(tag, 'src');
    if (!/\salt\s*=/i.test(tag) || (src === ctx.logoUrl && !attr(tag, 'alt').trim())) layoutIssue('img_alt_missing', `An image (${src || 'no source'}) has no alt text.`, 'Give every image alt text.');
    issues.push(...checkUrl(src, 'layout', allowed).map((found) => ({ ...found, code: found.code === 'link_domain_not_allowed' ? 'image_domain_not_allowed' : found.code, fixable: false })));
    if (/\s(?:width|height)\s*=\s*["']?1(?:px)?["']?(?=[\s/>])/i.test(tag)) layoutIssue('tracking_pixel', 'The email contains a 1x1 image, which is a tracking pixel; the brand uses no tracking.');
  }

  // every link in the HTML: https on an allowed host, or the sender's own mailto and tel links
  const phoneDigits = ctx.sender.contactPhone.replace(/[^+\d]/g, '');
  for (const m of html.matchAll(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const href = decodeEntities(m[1] ?? m[2] ?? '').trim();
    if (/^mailto:/i.test(href) && href.slice(7).split('?')[0].toLowerCase() === ctx.sender.contactEmail.toLowerCase()) continue;
    if (/^tel:/i.test(href) && href.slice(4).replace(/[^+\d]/g, '') === phoneDigits) continue;
    const found = checkUrl(href, 'layout', allowed);
    if (found.length) issues.push(issue('layout', 'html_link_not_allowed', `A link in the email is not allowed: ${href}`, undefined, false));
  }

  if (/<script\b|<iframe\b|<object\b|<embed\b|<form\b|<base\b|<link\b|<meta\s+http-equiv|javascript:|\son[a-z]+\s*=|@import|expression\s*\(/i.test(html)) layoutIssue('html_unsafe_markup', 'The email contains script, form, external-resource or event-handler markup.');
  if (hasEmoji(html) || hasEmoji(text)) layoutIssue('emoji_found', 'The rendered email contains an emoji; the brand uses none anywhere.');

  // brand tokens: the palette is present and every colour and font family is a design-system token
  const colours = extractColours(html).map(normaliseColour);
  if (!colours.includes('#0a0a0a') || !colours.includes('#c9a84c')) layoutIssue('brand_palette_missing', 'The email does not use the brand black (#0A0A0A) and gold (#C9A84C).');
  const off = findOffBrandTokens(html);
  if (off.colours.length) layoutIssue('off_brand_color', `The email uses colours outside the design system: ${off.colours.join(', ')}.`);
  if (off.fonts.length) layoutIssue('off_brand_font', `The email uses font families outside the design system: ${off.fonts.join(', ')}.`);

  // the layout must actually carry the content
  const heading = (fields.heading ?? '').trim();
  if (heading && (!html.includes(escapeHtml(heading)) || !text.includes(heading))) layoutIssue('layout_dropped_content', 'The heading does not appear in both parts of the rendered email.');
  const ctaUrl = (fields.ctaUrl ?? '').trim();
  if (ctaUrl && !html.includes(escapeHtml(ctaUrl)) && !html.includes(ctaUrl)) layoutIssue('layout_dropped_content', 'The call-to-action link does not appear in the rendered email.');
  const preheader = (fields.preheader ?? '').trim();
  if (preheader && !html.includes(escapeHtml(preheader))) layoutIssue('layout_dropped_content', 'The preheader does not appear in the rendered email.');
  return issues;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export interface DeterministicInput {
  fields: EmailFields;
  settings: Pick<EmailSettings, 'allowedLinkDomains'>;
  layout: EmailLayout;
  ctx: RenderContext;
}

export interface DeterministicOutcome {
  issues: GateIssue[];
  /** The message as the recipient would get it; null when the layout is not installed or failed to render. */
  rendered: RenderedEmail | null;
}

export function runDeterministicChecks(input: DeterministicInput): DeterministicOutcome {
  const { fields, settings, layout, ctx } = input;
  const issues = [...checkFieldText(fields), ...checkLinks(fields, settings.allowedLinkDomains)];
  let rendered: RenderedEmail | null = null;
  if (!layout.installed) {
    issues.push(issue('layout', 'layout_not_installed', 'No brand email layout is installed, so nothing can be sent.', 'The AB Entertainment layout must be installed in src/lib/email/layout.ts.', false));
  } else {
    try {
      rendered = layout.render(fields, ctx);
    } catch {
      issues.push(issue('layout', 'layout_render_failed', 'The brand layout failed to render this content.', undefined, false));
    }
    if (rendered) issues.push(...checkRendered(rendered, fields, ctx, settings.allowedLinkDomains));
  }
  return { issues, rendered };
}
