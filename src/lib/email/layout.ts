/**
 * THE BRAND LAYOUT: one isolated module.
 *
 * Contract (EmailLayout in ./types): render(fields, ctx) turns what an admin wrote (EmailFields) plus the
 * per-message parts filled in by code (RenderContext: unsubscribe link, logo URL, sender identity) into the
 * final { html, text }. The layout owns the whole frame (header, logo, palette, typography, footer with
 * sender identity and the unsubscribe link), so an admin cannot break the brand: admins never supply markup.
 * It must:
 *   - be table-based with inline styles (renders in Gmail, Outlook and Apple Mail) and ship a plain-text part;
 *   - turn the body into markup only with formatBody() from ./body-format, passing its own inline styles;
 *   - escape subject, preheader, heading and the CTA label with escapeHtml();
 *   - put ctx.unsubscribeUrl and the sender identity in fixed footer slots, in both parts: the quality gate
 *     checks for them on every send;
 *   - use absolute https URLs for the logo, with alt text.
 *
 * STATUS: not installed. The AB Entertainment email template (designed in Claude Design) has not been
 * supplied yet, and no layout of our own design ships. Until it is installed here, `installed` is false and the
 * quality gate blocks every send, so nothing can go out in a frame that is not the brand one. Installing it
 * means replacing `layout` below with an implementation of EmailLayout and bumping its `version`; nothing else
 * changes, and the tests use a clearly named fixture layout instead (e2e/fixtures/email-layout-fixture.ts).
 */

import type { EmailLayout } from './types';

export class LayoutNotInstalledError extends Error {
  constructor() {
    super('No brand email layout is installed');
    this.name = 'LayoutNotInstalledError';
  }
}

export const layout: EmailLayout = {
  id: 'none',
  version: '0',
  installed: false,
  render() {
    throw new LayoutNotInstalledError();
  },
};

/** The layout the app uses; everything else asks for it here so a swap touches this module only. */
export function getLayout(): EmailLayout {
  return layout;
}
