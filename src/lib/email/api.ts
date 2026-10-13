import { NextRequest, NextResponse } from 'next/server';
import { describeError } from '@/lib/newsletter';
import { EmailStoreError } from './store';

/** Responses of the admin newsletter endpoints: personal data and configuration, so never cached. */
export const NO_STORE = { 'Cache-Control': 'no-store' };

export function ok(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function fail(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

const STORE_STATUS: Record<EmailStoreError['code'], number> = { invalid: 400, not_found: 404, conflict: 409, limit: 409 };

/** An expected store error keeps its message; anything else is a fixed 500 and only its name and code are logged. */
export function storeFailure(err: unknown, context: string): NextResponse {
  if (err instanceof EmailStoreError) return fail(err.message, STORE_STATUS[err.code]);
  console.error(`[admin/newsletter] ${context} failed:`, describeError(err));
  return fail('Something went wrong. Please try again.', 500);
}

/** A JSON object body, or null when it is missing, malformed or not an object. */
export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
