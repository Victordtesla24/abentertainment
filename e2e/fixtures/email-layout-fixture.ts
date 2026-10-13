/**
 * TEST FIXTURE LAYOUT: neutral markup for tests only. It is NOT the AB Entertainment layout and is never shipped
 * (nothing under src/ imports it). It exists so the quality gate, the sender and the unsubscribe flow can be tested
 * before and independently of the real brand layout, which is a separate, isolated module (src/lib/email/layout.ts).
 *
 * It uses only design-system colours and fonts so a clean message passes the gate, and each option below breaks one
 * thing on purpose so a test can prove the gate catches it.
 */

import { escapeHtml, formatBody } from '@/lib/email/body-format';
import type { EmailFields, EmailLayout, RenderContext } from '@/lib/email/types';

export const FIXTURE_LAYOUT_NOTICE = 'TEST FIXTURE LAYOUT: not the AB Entertainment layout, never shipped.';

export interface FixtureOptions {
  id?: string;
  version?: string;
  omitUnsubscribeHtml?: boolean;
  omitUnsubscribeText?: boolean;
  /** Leave the sender's email address and phone out of the footer (the identity must include a way to reach them). */
  omitSenderContact?: boolean;
  omitAlt?: boolean;
  omitLogo?: boolean;
  trackingPixel?: boolean;
  unsafeScript?: boolean;
  offBrandColour?: boolean;
  offBrandFont?: boolean;
  omitPalette?: boolean;
  oversize?: boolean;
  dropHeading?: boolean;
  dropCta?: boolean;
  emoji?: boolean;
  offDomainLink?: boolean;
  emptyText?: boolean;
  throwOnRender?: boolean;
}

const DISPLAY = "'Playfair Display',Georgia,serif";
const BODY = "'DM Sans','Helvetica Neue',Helvetica,sans-serif";

export function makeFixtureLayout(options: FixtureOptions = {}): EmailLayout {
  return {
    id: options.id ?? 'test-fixture',
    version: options.version ?? '1',
    installed: true,
    render(fields: EmailFields, ctx: RenderContext) {
      if (options.throwOnRender) throw new Error('fixture render failure');
      const body = formatBody(fields.body, {
        p: `margin:0 0 16px;font-family:${BODY};font-size:16px;line-height:1.75;color:#FFFFFF;`,
        ul: 'margin:0 0 16px;padding-left:20px;',
        li: `font-family:${BODY};font-size:16px;line-height:1.75;color:#FFFFFF;`,
        a: 'color:#C9A84C;',
        strong: 'font-weight:700;',
        em: 'font-style:italic;',
      });
      const paper = options.omitPalette ? '#222222' : '#0A0A0A';
      const accent = options.omitPalette ? '#D4B65C' : options.offBrandColour ? '#FF00FF' : '#C9A84C';
      const bodyFont = options.offBrandFont ? "Comic Sans MS,Arial,sans-serif" : BODY;
      const ctaLabel = fields.ctaLabel.trim().toUpperCase();
      const logoAlt = options.omitAlt ? '' : 'AB Entertainment';
      const logo = options.omitLogo ? '' : `<img src="${escapeHtml(ctx.logoUrl)}" ${options.omitAlt ? '' : `alt="${logoAlt}"`} width="64" style="display:block;">`;
      const unsubscribeHtml = options.omitUnsubscribeHtml ? '' : `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:#C9A84C;">Unsubscribe</a>`;
      const sender = `${ctx.sender.name}, ${ctx.sender.city} ${ctx.sender.state}, ${ctx.sender.country}.${options.omitSenderContact ? '' : ` <a href="mailto:${ctx.sender.contactEmail}" style="color:#C9A84C;">${ctx.sender.contactEmail}</a> ${ctx.sender.contactPhone}`}`;
      const filler = options.oversize ? `<!-- ${'x'.repeat(110_000)} -->` : '';
      const html = [
        '<!doctype html><html><head><meta charset="utf-8">',
        `<title>${escapeHtml(fields.subject)}</title></head>`,
        `<body style="margin:0;background-color:${paper};">`,
        `<!-- ${FIXTURE_LAYOUT_NOTICE} -->`,
        `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(fields.preheader)}</div>`,
        `<table role="presentation" width="100%" bgcolor="${paper}" style="background-color:${paper};"><tr><td align="center">`,
        '<table role="presentation" width="600" style="width:600px;background-color:#111111;">',
        `<tr><td style="padding:24px;">${logo}${options.trackingPixel ? '<img src="https://abentertainment.com.au/p.gif" alt="" width="1" height="1">' : ''}</td></tr>`,
        fields.eyebrow ? `<tr><td style="padding:0 24px;font-family:${BODY};font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:${accent};">${escapeHtml(fields.eyebrow)}</td></tr>` : '',
        options.dropHeading ? '' : `<tr><td style="padding:8px 24px;font-family:${DISPLAY};font-size:30px;color:#FFFFFF;">${escapeHtml(fields.heading)}</td></tr>`,
        `<tr><td style="padding:0 24px;font-family:${bodyFont};">${body.html}</td></tr>`,
        fields.ctaUrl && !options.dropCta ? `<tr><td style="padding:24px;"><a href="${escapeHtml(options.offDomainLink ? 'https://evil.example/x' : fields.ctaUrl)}" style="display:inline-block;padding:14px 40px;background-color:${accent};color:#000000;font-family:${BODY};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;">${escapeHtml(ctaLabel)}</a></td></tr>` : '',
        `<tr><td style="padding:24px;background-color:#070707;font-family:${BODY};font-size:12px;color:rgba(255,255,255,0.5);">${sender} ${unsubscribeHtml} &copy; ${ctx.year}${options.emoji ? ' \u{1F3AD}' : ''}</td></tr>`,
        options.unsafeScript ? '<script>alert(1)</script>' : '',
        '</table></td></tr></table>',
        filler,
        '</body></html>',
      ].join('');
      const text = options.emptyText
        ? ''
        : [
            fields.eyebrow ? fields.eyebrow.toUpperCase() : '',
            options.dropHeading ? '' : fields.heading,
            body.text,
            fields.ctaUrl && !options.dropCta ? `${ctaLabel}: ${fields.ctaUrl}` : '',
            `${ctx.sender.name}, ${ctx.sender.city} ${ctx.sender.state}, ${ctx.sender.country}.${options.omitSenderContact ? '' : ` ${ctx.sender.contactEmail} ${ctx.sender.contactPhone}`}`,
            options.omitUnsubscribeText ? '' : `Unsubscribe: ${ctx.unsubscribeUrl}`,
          ]
            .filter(Boolean)
            .join('\n\n');
      return { html, text };
    },
  };
}
