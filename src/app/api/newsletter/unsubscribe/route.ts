export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/redis';
import { clientIp } from '@/lib/newsletter';
import { publicBaseUrl } from '@/lib/email/context';
import { previewUnsubscribe, unsubscribeByToken, type UnsubscribeResult } from '@/lib/email/unsubscribe';
import { renderUnsubscribePage } from '@/lib/email/unsubscribe-page';

/**
 * The unsubscribe link in every email.
 *
 *   GET  ?t=<token>  NEVER changes anything. It shows the "Confirm Unsubscribe" page: which list, the masked address, one
 *                    button that posts a form to this same link, and a way back to the site. Mail-security scanners, link
 *                    previewers and prefetchers GET every link in a message (and the web host turns HEAD into GET), so a
 *                    GET that unsubscribed would remove people who never asked.
 *   POST ?t=<token>  removes the subscriber. Two callers: the form on the confirmation page (body "confirm=unsubscribe";
 *                    answered with the branded "You Have Been Unsubscribed" page), and a mail app's own Unsubscribe button,
 *                    RFC 8058 one-click (body "List-Unsubscribe=One-Click", the List-Unsubscribe-Post header; answered with
 *                    a plain 200). The two are told apart by the body, not by Accept, because the web host's API proxy
 *                    passes on the body and Content-Type but not the Accept header.
 *   HEAD             does nothing.
 *
 * The signed token is the only credential (no session, no Origin or CSRF check: a mail provider is not a browser on
 * this site, and the token cannot be forged). Removing is idempotent and never reveals whether an address was on the
 * list. A token that does not verify is a 400 and changes nothing; if tokens cannot be checked or the list cannot be
 * read the answer is a 503 and nothing is changed. Everything here is uncacheable and carries no referrer.
 */

const RATE_LIMIT_PER_MINUTE = 120;
const MAX_BODY_CHARS = 2048;
const LINK_PATH = '/api/newsletter/unsubscribe';
const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

function tokenOf(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get('t');
}

async function limited(request: NextRequest): Promise<boolean> {
  const { allowed } = await checkRateLimit(`newsletter-unsubscribe:${clientIp(request.headers)}`, RATE_LIMIT_PER_MINUTE, 60);
  return !allowed;
}

function html(markup: string, status: number): NextResponse {
  return new NextResponse(markup, { status, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8', ...(status === 503 ? { 'Retry-After': '300' } : {}) } });
}

function text(body: string, status: number): NextResponse {
  return new NextResponse(body, { status, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}

function resultPage(result: UnsubscribeResult['result']): NextResponse {
  if (result === 'done') return html(renderUnsubscribePage('done', publicBaseUrl()), 200);
  if (result === 'invalid') return html(renderUnsubscribePage('invalid', publicBaseUrl()), 400);
  return html(renderUnsubscribePage('unavailable', publicBaseUrl()), 503);
}

export async function GET(request: NextRequest) {
  if (await limited(request)) return text('Too many requests. Please try again shortly.', 429);
  const token = tokenOf(request);
  const preview = await previewUnsubscribe(token);
  const site = publicBaseUrl();
  switch (preview.result) {
    case 'confirm':
      // the form posts to this same link (path and query), so it works through the API proxy on the public site
      return html(renderUnsubscribePage('confirm', site, { action: `${LINK_PATH}?t=${encodeURIComponent(token ?? '')}`, masked: preview.masked }), 200);
    case 'already':
      return html(renderUnsubscribePage('done', site), 200);
    case 'invalid':
      return html(renderUnsubscribePage('invalid', site), 400);
    default:
      return html(renderUnsubscribePage('unavailable', site), 503);
  }
}

export async function POST(request: NextRequest) {
  if (await limited(request)) return text('Too many requests.', 429);
  let body = '';
  try {
    if (Number(request.headers.get('content-length') ?? 0) <= MAX_BODY_CHARS) body = (await request.text()).slice(0, MAX_BODY_CHARS);
  } catch {
    body = '';
  }
  const oneClick = /(?:^|&)List-Unsubscribe=One-Click(?:&|$)/.test(body);
  const fromForm = !oneClick && /(?:^|&)confirm=unsubscribe(?:&|$)/.test(body);
  const outcome = await unsubscribeByToken(tokenOf(request), fromForm ? 'confirm_page' : 'one_click');
  if (fromForm) return resultPage(outcome.result);
  const reply = outcome.result === 'done' ? 'Unsubscribed' : outcome.result === 'invalid' ? 'Invalid unsubscribe link' : 'Please try again shortly';
  return text(reply, outcome.result === 'done' ? 200 : outcome.result === 'invalid' ? 400 : 503);
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
}
