/**
 * THE AB ENTERTAINMENT EMAIL LAYOUT: one isolated module.
 *
 * Contract (EmailLayout in ./types): render(fields, ctx) turns what an admin wrote (EmailFields) plus the per-message
 * parts filled in by code (RenderContext: unsubscribe link, logo URL, sender identity) into the final { html, text }.
 * The layout owns the whole frame (logo, palette, typography, footer with the sender identity and the unsubscribe
 * link), so an admin cannot break the brand: admins never supply markup, only words.
 *
 * Built strictly from the AB Entertainment Design System in docs/design-system/ (Claude Design project
 * 019e020b-bf85-766e-a492-52ae7afe59b3): every colour and font family is a token of colors_and_type.css (BRAND in
 * ./design-tokens), the eyebrow is the .t-eyebrow style, the heading is Playfair Display in Title Case, the call to
 * action is the Button primary skin, the divider is the OrnamentDivider and the footer follows
 * ui_kits/website/footer.jsx. The quality gate extracts every colour and font family from the rendered message and
 * blocks anything that is not a design-system token, on every send.
 *
 * What an email client cannot do, and what stands in for it (each stand-in uses design tokens only):
 *   - Layout is tables with inline styles in a 600px container (a fluid div with an Outlook ghost table), so it
 *     renders in Gmail, Apple Mail and Outlook; one small style block only narrows the padding on phones.
 *   - Colours with transparency (fg-2, gold-20 and so on) are written as a solid token first and the rgba token after
 *     it. Gmail, Apple Mail and iOS Mail use the rgba token; Outlook for Windows ignores rgba and keeps the solid one.
 *   - Button primary: the 135deg gold, gold-light, gold gradient sits on a solid gold cell, so Outlook shows solid
 *     gold. Sharp corners (radius 0), black uppercase label, 0.72rem, bold, 0.12em tracking, 14px 40px padding.
 *   - OrnamentDivider: the kit draws two 64px gradient lines (gold-40) around an 8px square rotated 45 degrees with a
 *     1px gold-50 border. CSS transforms and gradients are not dependable in email, so the layout draws two 64px
 *     1px lines (gold-40, solid rather than fading) around U+25C7 WHITE DIAMOND in gold-50: a hollow diamond, like the
 *     bordered square. It is a text glyph, not an emoji.
 *   - Web fonts do not load in Gmail or Outlook and an external font request would be a tracking vector, so the
 *     stacks are the tokens exactly: Playfair Display then Georgia, DM Sans then Helvetica Neue and Helvetica.
 *   - The footer's social icons are inline SVG in the kit and email clients drop SVG, so they are text buttons.
 *   - The kit footer's body text is white at 0.55, which the token set does not have, so the nearest tokens (0.65 and 0.5) are
 *     used; its tagline is gold at 0.4 (about 2:1 contrast on the footer black), so the solid gold-dark token is used instead.
 *
 * The layout's version carries a fingerprint of a fixed sample rendered through it, so any change to the markup or
 * the styles changes the version, which voids every template approval bound to it (src/lib/email/gate.ts). It
 * cannot be forgotten at a redesign. LAYOUT_REVISION is bumped by hand only to mark a deliberate redesign.
 */

import { createHash } from 'crypto';
import { escapeHtml, formatBody } from './body-format';
import { BRAND as B } from './design-tokens';
import type { EmailFields, EmailLayout, RenderContext, RenderedEmail } from './types';

export class LayoutNotInstalledError extends Error {
  constructor() {
    super('No brand email layout is installed');
    this.name = 'LayoutNotInstalledError';
  }
}

/** A layout that renders nothing and tells the gate to block every send (used when the brand layout cannot run). */
export function makeNotInstalledLayout(): EmailLayout {
  return {
    id: 'none',
    version: '0',
    installed: false,
    render() {
      throw new LayoutNotInstalledError();
    },
  };
}

export const LAYOUT_ID = 'ab-entertainment';
export const LAYOUT_REVISION = 1;
export const BRAND_TAGLINE = 'Experience events like no other';

// ─── Styles (all values are design-system tokens) ────────────────────────────

/** `property:solid;property:alpha;`: the solid token for Outlook, the alpha token for every client that reads rgba. */
const alpha = (property: string, solid: string, rgba: string) => `${property}:${solid};${property}:${rgba};`;

const FONT_DISPLAY = `font-family:${B.displayFont};`;
const FONT_BODY = `font-family:${B.bodyFont};`;
const TEXT_RESET = 'mso-line-height-rule:exactly;';

/** .t-eyebrow: DM Sans 12px, 600, 0.25em tracking, uppercase, gold. */
const STYLE_EYEBROW = `${FONT_BODY}font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.25em;text-transform:uppercase;color:${B.gold};${TEXT_RESET}`;
/** .t-h2: Playfair Display 36px (the type scale's 4xl), 700, line height 1.15, white. */
const STYLE_HEADING = `${FONT_DISPLAY}font-size:36px;line-height:42px;font-weight:700;color:${B.white};${TEXT_RESET}`;
/** Body copy: DM Sans 16px, relaxed 1.75 line height, white at 0.65 (fg-2) with white as the Outlook fallback. */
const BODY_TEXT = `${FONT_BODY}font-size:16px;line-height:28px;font-weight:400;${alpha('color', B.white, B.fg2)}${TEXT_RESET}`;
/** The Button primary label: DM Sans 0.72rem (11.52px), 700, 0.12em tracking, uppercase, black. */
const STYLE_BUTTON_LABEL = `${FONT_BODY}display:inline-block;padding:14px 40px;font-size:11.52px;line-height:16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:${B.black};${TEXT_RESET}`;
const BUTTON_GRADIENT = `linear-gradient(135deg,${B.gold},${B.goldLight} 50%,${B.gold})`;

const HAIRLINE_TOP = (rgba: string) => `border-top:1px solid ${B.surface3};border-top:1px solid ${rgba};`;

const BODY_STYLES = {
  p: `margin:0 0 20px;${BODY_TEXT}`,
  ul: 'margin:0 0 20px;padding:0 0 0 22px;',
  li: `margin:0 0 8px;${BODY_TEXT}`,
  a: `color:${B.gold};text-decoration:underline;`,
  strong: `font-weight:700;color:${B.white};`,
  em: 'font-style:italic;',
};

const FOOTER_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Events', '/events/'],
  ['Gallery', '/gallery/'],
  ['Sponsors', '/sponsors/'],
  ['Contact', '/contact/'],
];
const LEGAL_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Privacy Policy', '/privacy/'],
  ['Terms of Service', '/terms/'],
];

const PREHEADER_PADDING = '&nbsp;&zwnj;'.repeat(80);

// ─── Pieces ──────────────────────────────────────────────────────────────────

function ornament(): string {
  const line = `<td valign="middle" width="64" style="width:64px;"><div style="height:1px;line-height:1px;font-size:1px;${alpha('background-color', B.goldDark, B.gold40)}">&nbsp;</div></td>`;
  return [
    '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>',
    line,
    `<td valign="middle" align="center" style="padding:0 12px;${FONT_BODY}font-size:14px;line-height:14px;${alpha('color', B.goldDark, B.gold50)}">&#9671;</td>`,
    line,
    '</tr></table>',
  ].join('');
}

function button(label: string, url: string): string {
  return [
    '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>',
    `<td align="center" bgcolor="${B.gold}" style="background-color:${B.gold};background-image:${BUTTON_GRADIENT};">`,
    `<a href="${escapeHtml(url)}" target="_blank" style="${STYLE_BUTTON_LABEL}">${escapeHtml(label)}</a>`,
    '</td></tr></table>',
  ].join('');
}

function socialButton(label: string, url: string): string {
  const style = `display:inline-block;margin:0 5px;padding:10px 18px;${FONT_BODY}font-size:11px;line-height:14px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:${B.gold};border:1px solid ${B.surface3};border:1px solid ${B.gold15};${TEXT_RESET}`;
  return `<a href="${escapeHtml(url)}" target="_blank" style="${style}">${escapeHtml(label)}</a>`;
}

/** A footer link: white at fg-2 (or fg-3 for the quiet legal row) with no underline, like the kit's footer links. */
function footerLink(label: string, url: string, tone: string = B.fg2, extra = ''): string {
  return `<a href="${escapeHtml(url)}" target="_blank" style="text-decoration:none;${alpha('color', B.white, tone)}${extra}">${escapeHtml(label)}</a>`;
}

function footerHtml(ctx: RenderContext): string {
  const site = ctx.siteUrl;
  const sender = ctx.sender;
  const small = `${FONT_BODY}font-size:12px;line-height:20px;${alpha('color', B.white, B.fg3)}${TEXT_RESET}`;
  const contactLine = `${FONT_BODY}font-size:12.8px;line-height:24px;${alpha('color', B.white, B.fg2)}${TEXT_RESET}`;
  const phoneHref = `tel:${sender.contactPhone.replace(/[^+\d]/g, '')}`;
  return [
    // the brand lockup (footer.jsx: logo, name, tagline)
    '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>',
    `<td valign="middle" style="padding-right:12px;"><img src="${escapeHtml(ctx.logoUrl)}" alt="AB Entertainment" width="52" height="52" style="display:block;border:0;outline:none;text-decoration:none;width:52px;height:52px;"></td>`,
    '<td valign="middle" align="left">',
    `<div style="${FONT_DISPLAY}font-size:16px;line-height:22px;font-weight:600;color:${B.white};${TEXT_RESET}">${escapeHtml(sender.name)}</div>`,
    `<div style="${FONT_BODY}font-size:9px;line-height:14px;letter-spacing:0.15em;text-transform:uppercase;color:${B.goldDark};${TEXT_RESET}">${escapeHtml(BRAND_TAGLINE)}</div>`,
    '</td></tr></table>',
    // contact
    `<div style="padding:24px 0 0;${contactLine}">`,
    `${footerLink(sender.contactPhone, phoneHref)}<br>`,
    `${footerLink(sender.contactEmail, `mailto:${sender.contactEmail}`)}<br>`,
    `${escapeHtml(sender.city)} ${escapeHtml(sender.state)}, ${escapeHtml(sender.country)}`,
    '</div>',
    // social
    `<div style="padding:20px 0 0;">${socialButton('Instagram', ctx.social.instagram)}${socialButton('Facebook', ctx.social.facebook)}</div>`,
    // site links
    `<div style="padding:24px 0 0;${contactLine}">${FOOTER_LINKS.map(([label, path]) => footerLink(label, `${site}${path}`, B.fg2, 'padding:0 8px;')).join('')}</div>`,
    // legal: the copyright line, the site policies and the unsubscribe link
    `<div style="margin-top:28px;padding-top:20px;${HAIRLINE_TOP(B.gold08)}${small}">`,
    `<div>&copy; ${ctx.year} ${escapeHtml(sender.name)}. All rights reserved.</div>`,
    `<div style="padding-top:4px;">${LEGAL_LINKS.map(([label, path]) => footerLink(label, `${site}${path}`, B.fg3, 'padding:0 8px;')).join('')}</div>`,
    `<div style="padding-top:12px;">You are receiving this email because you subscribed to updates from ${escapeHtml(sender.name)}. `,
    `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:${B.gold};text-decoration:underline;">Unsubscribe</a></div>`,
    '</div>',
  ].join('');
}

function footerText(ctx: RenderContext): string {
  const s = ctx.sender;
  return [
    `${s.name}`,
    BRAND_TAGLINE,
    '',
    `${s.contactPhone}`,
    `${s.contactEmail}`,
    `${s.city} ${s.state}, ${s.country}`,
    ctx.siteUrl,
    '',
    `Instagram: ${ctx.social.instagram}`,
    `Facebook: ${ctx.social.facebook}`,
    '',
    ...LEGAL_LINKS.map(([label, path]) => `${label}: ${ctx.siteUrl}${path}`),
    '',
    `\u00A9 ${ctx.year} ${s.name}. All rights reserved.`,
    `You are receiving this email because you subscribed to updates from ${s.name}.`,
    `Unsubscribe: ${ctx.unsubscribeUrl}`,
  ].join('\n');
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderBrandEmail(fields: EmailFields, ctx: RenderContext): RenderedEmail {
  const eyebrow = (fields.eyebrow ?? '').trim();
  const heading = (fields.heading ?? '').trim();
  const ctaLabel = (fields.ctaLabel ?? '').trim();
  const ctaUrl = (fields.ctaUrl ?? '').trim();
  const body = formatBody(fields.body ?? '', BODY_STYLES);
  const hasCta = Boolean(ctaLabel && ctaUrl);

  const html = [
    '<!doctype html>',
    '<html lang="en-AU">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="x-apple-disable-message-reformatting">',
    '<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="supported-color-schemes" content="dark">',
    `<title>${escapeHtml(fields.subject ?? '')}</title>`,
    '<style>',
    ':root{color-scheme:dark;supported-color-schemes:dark;}',
    'body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}',
    'table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}',
    'img{-ms-interpolation-mode:bicubic;}',
    '@media only screen and (max-width:620px){.ab-pad{padding-left:24px !important;padding-right:24px !important;}.ab-h1{font-size:30px !important;line-height:36px !important;}}',
    '</style>',
    '</head>',
    `<body style="margin:0;padding:0;background-color:${B.bg};">`,
    // the preheader: the preview text beside the subject, hidden in the message itself
    `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(fields.preheader ?? '')}${PREHEADER_PADDING}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${B.bg}" style="width:100%;background-color:${B.bg};"><tr><td align="center" style="padding:32px 12px;">`,
    '<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->',
    '<div style="max-width:600px;margin:0 auto;">',
    // the card: surface #111111 with a gold-20 hairline frame
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${B.surface}" style="width:100%;background-color:${B.surface};border:1px solid ${B.surface3};border:1px solid ${B.gold20};">`,
    // header: the logo
    `<tr><td align="center" class="ab-pad" style="padding:40px 48px 0;"><a href="${escapeHtml(ctx.siteUrl)}" target="_blank" style="text-decoration:none;"><img src="${escapeHtml(ctx.logoUrl)}" alt="AB Entertainment" width="88" height="88" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:88px;height:88px;"></a></td></tr>`,
    // content
    `<tr><td align="center" class="ab-pad" style="padding:32px 48px 0;">`,
    eyebrow ? `<div style="padding:0 0 16px;${STYLE_EYEBROW}">${escapeHtml(eyebrow)}</div>` : '',
    `<h1 class="ab-h1" style="margin:0 0 24px;${STYLE_HEADING}">${escapeHtml(heading)}</h1>`,
    `<div style="padding:0 0 32px;">${ornament()}</div>`,
    '</td></tr>',
    `<tr><td align="left" class="ab-pad" style="padding:0 48px;${BODY_TEXT}">${body.html}</td></tr>`,
    hasCta ? `<tr><td align="center" class="ab-pad" style="padding:16px 48px 0;">${button(ctaLabel, ctaUrl)}</td></tr>` : '',
    '<tr><td style="padding:0 0 48px;font-size:1px;line-height:1px;">&nbsp;</td></tr>',
    // footer: surface #070707 (footer.jsx)
    `<tr><td align="center" class="ab-pad" bgcolor="${B.footer}" style="padding:40px 40px 32px;background-color:${B.footer};${HAIRLINE_TOP(B.gold20)}">`,
    footerHtml(ctx),
    '</td></tr>',
    '</table>',
    '</div>',
    '<!--[if mso]></td></tr></table><![endif]-->',
    '</td></tr></table>',
    '</body>',
    '</html>',
  ].join('\n');

  const text = [
    'AB ENTERTAINMENT',
    eyebrow ? eyebrow.toUpperCase() : '',
    heading,
    body.text,
    hasCta ? `${ctaLabel.toUpperCase()}\n${ctaUrl}` : '',
    `--\n${footerText(ctx)}`,
  ]
    .filter((part) => part !== '')
    .join('\n\n');

  return { html, text };
}

// ─── Installation ────────────────────────────────────────────────────────────

const SAMPLE_FIELDS: EmailFields = {
  subject: 'Layout fingerprint sample',
  preheader: 'A fixed sample that changes whenever the layout changes.',
  eyebrow: 'Welcome to',
  heading: 'The AB Entertainment Community',
  body: 'First paragraph with **bold**, *italic* and a [link](https://abentertainment.com.au/events/).\n\nSecond paragraph.\n\n- First point\n- Second point',
  ctaLabel: 'View All Events',
  ctaUrl: 'https://abentertainment.com.au/events/',
};

const SAMPLE_CONTEXT: RenderContext = {
  unsubscribeUrl: 'https://abentertainment.com.au/api/newsletter/unsubscribe?t=sample',
  logoUrl: 'https://abentertainment.com.au/images/AB_Logo_transparent-256w.png',
  siteUrl: 'https://abentertainment.com.au',
  year: 2000,
  social: { instagram: 'https://instagram.com/abentertainment_events/', facebook: 'https://facebook.com/ABEntertainmentAU' },
  sender: {
    name: 'AB Entertainment',
    city: 'Melbourne',
    state: 'VIC',
    country: 'Australia',
    contactEmail: 'abhi@abentertainment.com.au',
    contactPhone: '(+61) 430082646',
    website: 'https://abentertainment.com.au',
  },
};

/** A short hash of what a layout produces for a fixed sample: it changes with any change to the markup or styles. */
export function layoutFingerprint(render: (fields: EmailFields, ctx: RenderContext) => RenderedEmail): string {
  const sample = render(SAMPLE_FIELDS, SAMPLE_CONTEXT);
  return createHash('sha256').update(sample.html).update('\u0000').update(sample.text).digest('hex').slice(0, 10);
}

/**
 * The brand layout around a render function, or the not-installed layout when that function cannot render the fixed
 * sample (fail closed: a layout that cannot render is "not installed", so the gate blocks every send).
 */
export function installLayout(render: (fields: EmailFields, ctx: RenderContext) => RenderedEmail): EmailLayout {
  try {
    return { id: LAYOUT_ID, version: `${LAYOUT_REVISION}.${layoutFingerprint(render)}`, installed: true, render };
  } catch {
    return makeNotInstalledLayout();
  }
}

export const layout: EmailLayout = installLayout(renderBrandEmail);

/** The layout the app uses; everything else asks for it here so a swap touches this module only. */
export function getLayout(): EmailLayout {
  return layout;
}
