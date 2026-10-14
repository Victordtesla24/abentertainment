/**
 * The page a recipient sees after following an unsubscribe link: a small, self-contained, branded HTML document
 * (it is served by the API route, so it needs no site assets and works through the Hostinger API proxy, which passes
 * the body and content type only; hence noindex and no-referrer are meta tags here as well as headers).
 *
 * Built from the same design-system tokens as the email layout (BRAND): the eyebrow, a Title Case Playfair Display
 * heading, the ornament, DM Sans body copy and the primary Button, in the brand voice of the README (third person for
 * the company, second person for the reader, formal but warm, Australian English, no emoji, no exclamation marks).
 *
 * The "confirm" page is what following the link shows: it changes nothing, names the list (and the masked address), and
 * holds the one button that unsubscribes (a form POST to the same link) beside a way back to the site.
 */

import { escapeHtml } from './body-format';
import { BRAND as B } from './design-tokens';

export type UnsubscribePageKind = 'confirm' | 'done' | 'invalid' | 'unavailable';

interface PageCopy {
  title: string;
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  /** The button label (ALL CAPS is done by CSS), and where it goes. */
  button: string;
}

const CONTACT_EMAIL = 'abhi@abentertainment.com.au';

const COPY: Record<UnsubscribePageKind, PageCopy> = {
  confirm: {
    title: 'Confirm unsubscribe | AB Entertainment',
    eyebrow: 'Unsubscribe',
    heading: 'Confirm Unsubscribe',
    paragraphs: [
      'You are on the AB Entertainment newsletter list. Confirm below, and AB Entertainment will remove your address and send no further newsletter emails.',
      'If you followed this link by mistake, close this page: nothing has been changed.',
    ],
    button: 'Return to AB Entertainment',
  },
  done: {
    title: 'Unsubscribed | AB Entertainment',
    eyebrow: 'Unsubscribed',
    heading: 'You Have Been Unsubscribed',
    paragraphs: [
      'AB Entertainment has removed your address from the newsletter list. You will receive no further newsletter emails.',
      'Thank you for having been part of the community. If this was a mistake, you are always welcome to subscribe again from the website.',
    ],
    button: 'Return to AB Entertainment',
  },
  invalid: {
    title: 'Link not valid | AB Entertainment',
    eyebrow: 'Unsubscribe',
    heading: 'This Link Is Not Valid',
    paragraphs: [
      'This unsubscribe link could not be verified. It may have been copied in part, or altered on its way to you.',
      `To be removed from the list, please write to ${CONTACT_EMAIL} and AB Entertainment will action your request promptly.`,
    ],
    button: 'Return to AB Entertainment',
  },
  unavailable: {
    title: 'Please try again | AB Entertainment',
    eyebrow: 'Unsubscribe',
    heading: 'Please Try Again Shortly',
    paragraphs: [
      'AB Entertainment could not complete your request just now. Nothing has been changed.',
      `Please follow the link again in a few minutes, or write to ${CONTACT_EMAIL} and your address will be removed promptly.`,
    ],
    button: 'Return to AB Entertainment',
  },
};

const alpha = (property: string, solid: string, rgba: string) => `${property}:${solid};${property}:${rgba};`;

export interface ConfirmOptions {
  /** Where the form posts: the same link (path and query, with the token), so it works through the host's API proxy. */
  action: string;
  /** The address on the list, masked (j***@example.com); null when the link came from an admin's test email. */
  masked: string | null;
}

export function renderUnsubscribePage(kind: UnsubscribePageKind, siteUrl = 'https://abentertainment.com.au', confirm?: ConfirmOptions): string {
  const copy = COPY[kind];
  const logo = `${siteUrl}/images/AB_Logo_transparent-256w.png`;
  const paragraphs = copy.paragraphs
    .map((text, index) => {
      const withContact = escapeHtml(text).replace(escapeHtml(CONTACT_EMAIL), `<a href="mailto:${escapeHtml(CONTACT_EMAIL)}">${escapeHtml(CONTACT_EMAIL)}</a>`);
      // the confirmation names the address it will remove, in masked form
      return kind === 'confirm' && index === 0 && confirm?.masked ? `<p>${escapeHtml(text.replace('newsletter list.', `newsletter list as ${confirm.masked}.`))}</p>` : `<p>${withContact}</p>`;
    })
    .join('\n');
  const action =
    kind === 'confirm' && confirm
      ? `<form method="post" action="${escapeHtml(confirm.action)}">
<input type="hidden" name="confirm" value="unsubscribe">
<button class="button" type="submit">Unsubscribe</button>
</form>
<a class="secondary" href="${escapeHtml(siteUrl)}/">Keep Me Subscribed</a>`
      : `<a class="button" href="${escapeHtml(siteUrl)}/">${escapeHtml(copy.button)}</a>`;
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(copy.title)}</title>
<style>
html,body{margin:0;padding:0;}
body{background-color:${B.bg};font-family:${B.bodyFont};${alpha('color', B.white, B.fg2)}-webkit-text-size-adjust:100%;}
main{max-width:600px;margin:0 auto;padding:48px 16px;}
.card{background-color:${B.surface};border:1px solid ${B.surface3};border:1px solid ${B.gold20};padding:48px 40px;text-align:center;}
.logo{display:block;margin:0 auto 32px;width:88px;height:88px;border:0;}
.eyebrow{font-family:${B.bodyFont};font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.25em;text-transform:uppercase;color:${B.gold};margin:0 0 16px;}
h1{font-family:${B.displayFont};font-size:36px;line-height:42px;font-weight:700;color:${B.white};margin:0 0 24px;}
.ornament{display:flex;align-items:center;justify-content:center;gap:12px;margin:0 0 32px;}
.ornament span{display:block;width:64px;height:1px;${alpha('background-color', B.goldDark, B.gold40)}}
.ornament b{font-family:${B.bodyFont};font-size:14px;line-height:14px;font-weight:400;${alpha('color', B.goldDark, B.gold50)}}
p{font-size:16px;line-height:28px;margin:0 0 20px;text-align:left;${alpha('color', B.white, B.fg2)}}
p a{color:${B.gold};text-decoration:underline;}
.button{display:inline-block;margin-top:16px;padding:14px 40px;border:0;border-radius:0;cursor:pointer;background-color:${B.gold};background-image:linear-gradient(135deg,${B.gold},${B.goldLight} 50%,${B.gold});color:${B.black};font-family:${B.bodyFont};font-size:11.52px;line-height:16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;}
.button:focus-visible,.secondary:focus-visible{outline:2px solid ${B.gold};outline-offset:2px;}
form{margin:0;}
.secondary{display:block;margin-top:24px;font-family:${B.bodyFont};font-size:11.52px;line-height:16px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${B.gold};text-decoration:underline;}
@media (max-width:620px){.card{padding:40px 24px;}h1{font-size:30px;line-height:36px;}}
</style>
</head>
<body>
<main>
<div class="card">
<img class="logo" src="${escapeHtml(logo)}" alt="AB Entertainment" width="88" height="88">
<div class="eyebrow">${escapeHtml(copy.eyebrow)}</div>
<h1>${escapeHtml(copy.heading)}</h1>
<div class="ornament" aria-hidden="true"><span></span><b>&#9671;</b><span></span></div>
${paragraphs}
${action}
</div>
</main>
</body>
</html>
`;
}
