export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/redis';
import { clientIp } from '@/lib/newsletter';
import { publicBaseUrl } from '@/lib/email/context';
import { unsubscribeByToken, type UnsubscribeResult } from '@/lib/email/unsubscribe';
import { renderUnsubscribePage } from '@/lib/email/unsubscribe-page';

/**
 * The unsubscribe link in every email.
 *
 *   GET  ?t=<token>  the recipient follows the link: they are removed and see a branded confirmation page.
 *   POST ?t=<token>  RFC 8058 one-click (the List-Unsubscribe-Post header): a mail app posts "List-Unsubscribe=One-Click"
 *                    to the link; no page, a plain 200.
 *   HEAD             never unsubscribes: link scanners and previewers send it, and a message that is only scanned must
 *                    not cost a recipient their place on the list.
 *
 * The signed token is the only credential (no session, no Origin or CSRF check: a mail provider is not a browser on
 * this site, and the token cannot be forged). Removing is idempotent and never reveals whether an address was on the
 * list. A token that does not verify is a 400 and changes nothing; if tokens cannot be checked or the list cannot be
 * read the answer is a 503 and nothing is changed. Everything here is uncacheable and carries no referrer.
 */

const RATE_LIMIT_PER_MINUTE = 120;
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

function page(result: UnsubscribeResult['result']): NextResponse {
  const status = result === 'done' ? 200 : result === 'invalid' ? 400 : 503;
  const kind = result === 'done' ? 'done' : result === 'invalid' ? 'invalid' : 'unavailable';
  return new NextResponse(renderUnsubscribePage(kind, publicBaseUrl()), { status, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8', ...(status === 503 ? { 'Retry-After': '300' } : {}) } });
}

export async function GET(request: NextRequest) {
  if (await limited(request)) return new NextResponse('Too many requests. Please try again shortly.', { status: 429, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' } });
  const outcome = await unsubscribeByToken(tokenOf(request), 'link');
  return page(outcome.result);
}

export async function POST(request: NextRequest) {
  if (await limited(request)) return new NextResponse('Too many requests.', { status: 429, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' } });
  const outcome = await unsubscribeByToken(tokenOf(request), 'one_click');
  const body = outcome.result === 'done' ? 'Unsubscribed' : outcome.result === 'invalid' ? 'Invalid unsubscribe link' : 'Please try again shortly';
  const status = outcome.result === 'done' ? 200 : outcome.result === 'invalid' ? 400 : 503;
  return new NextResponse(body, { status, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
}
