/**
 * The transport: the Resend HTTP API (POST /emails) over plain fetch. No SDK and no SMTP.
 *
 * Configuration comes from the environment, by name only: RESEND_API_KEY (the secret), EMAIL_FROM (for example
 * "AB Entertainment <newsletter@abentertainment.com.au>") and, optionally, EMAIL_REPLY_TO. RESEND_BASE_URL exists for
 * tests: it may only be the real API origin or a loopback address, so the key can never be sent to another host.
 * The key is used in exactly one place (the Authorization header of the request) and appears in no result, log entry
 * or error message; neither does a recipient's address (provider messages are scrubbed of addresses before they are kept).
 *
 * Every message carries what a mailbox provider and the Spam Act expect: a text alternative, a List-Unsubscribe header
 * with the https one-click link and List-Unsubscribe-Post, and an Idempotency-Key so a retry of the same send can never
 * deliver twice. Failures are classified so the caller can tell "not ready yet" (an unverified domain, a bad key)
 * from "try again later" (a rate limit, an outage) and from "this will never work" (the provider rejected the message).
 */

import { scrubDetail } from './scrub';

type Env = Record<string, string | undefined>;

export const RESEND_API_ORIGIN = 'https://api.resend.com';
export const RESEND_ENV_NAMES = { apiKey: 'RESEND_API_KEY', from: 'EMAIL_FROM', replyTo: 'EMAIL_REPLY_TO', baseUrl: 'RESEND_BASE_URL' } as const;

export interface ResendConfig {
  apiKey: string;
  from: string;
  replyTo: string | null;
  baseUrl: string;
}

export type ConfigCheck =
  | { ok: true; config: ResendConfig }
  | { ok: false; /** names of the required variables that are not set */ missing: string[]; /** names of variables whose value is unusable */ invalid: string[] };

const BARE_ADDRESS = /^[^\s<>@,;:"()[\]\\]{1,64}@[^\s<>@,;:"()[\]\\]{1,255}\.[A-Za-z]{2,}$/;
const NAMED_ADDRESS = /^([^<>\r\n"@]{1,100})<([^\s<>@,;:"()[\]\\]{1,64}@[^\s<>@,;:"()[\]\\]{1,255}\.[A-Za-z]{2,})>$/;
const API_KEY = /^[A-Za-z0-9_-]{8,200}$/;
const LOOPBACK_BASE = /^http:\/\/(?:127\.0\.0\.1|localhost):\d{2,5}$/;

/** One plain address: no name, no list, no whitespace or control characters. */
export function isEmailAddress(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && BARE_ADDRESS.test(value);
}

/** "Name <address>" or a bare address, on one line. */
export function isSenderIdentity(value: string): boolean {
  return value.length <= 300 && (BARE_ADDRESS.test(value) || NAMED_ADDRESS.test(value));
}

export function readResendConfig(env: Env = process.env): ConfigCheck {
  const missing: string[] = [];
  const invalid: string[] = [];
  const apiKey = (env.RESEND_API_KEY ?? '').trim();
  const from = (env.EMAIL_FROM ?? '').trim();
  const replyTo = (env.EMAIL_REPLY_TO ?? '').trim();
  const baseUrl = (env.RESEND_BASE_URL ?? '').trim().replace(/\/+$/, '') || RESEND_API_ORIGIN;
  if (!apiKey) missing.push(RESEND_ENV_NAMES.apiKey);
  else if (!API_KEY.test(apiKey)) invalid.push(RESEND_ENV_NAMES.apiKey);
  if (!from) missing.push(RESEND_ENV_NAMES.from);
  else if (!isSenderIdentity(from)) invalid.push(RESEND_ENV_NAMES.from);
  if (replyTo && !isEmailAddress(replyTo)) invalid.push(RESEND_ENV_NAMES.replyTo);
  if (baseUrl !== RESEND_API_ORIGIN && !LOOPBACK_BASE.test(baseUrl)) invalid.push(RESEND_ENV_NAMES.baseUrl);
  if (missing.length || invalid.length) return { ok: false, missing, invalid };
  return { ok: true, config: { apiKey, from, replyTo: replyTo || null, baseUrl } };
}

// ─── The request ─────────────────────────────────────────────────────────────

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** The https one-click unsubscribe link (also in the body); sent as the List-Unsubscribe header. */
  unsubscribeUrl: string;
  idempotencyKey: string;
  /** A Resend tag: ASCII letters, numbers, underscores and dashes only. */
  category: string;
}

/** The request exactly as it goes to Resend (separate from sending so it can be inspected). */
export function buildResendRequest(config: ResendConfig, message: OutboundEmail): { url: string; init: RequestInit } {
  if (!isEmailAddress(message.to)) throw new Error('The recipient is not a single plain email address');
  if (!/^https:\/\/[^\s<>"]+$/.test(message.unsubscribeUrl)) throw new Error('The unsubscribe link must be an https URL');
  if (/[\r\n]/.test(message.subject) || /[\r\n]/.test(message.idempotencyKey)) throw new Error('Header values must be one line');
  const body: Record<string, unknown> = {
    from: config.from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: {
      'List-Unsubscribe': `<${message.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [{ name: 'category', value: message.category.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100) }],
  };
  if (config.replyTo) body.reply_to = config.replyTo;
  return {
    url: `${config.baseUrl}/emails`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.idempotencyKey,
      },
      body: JSON.stringify(body),
      redirect: 'error',
    },
  };
}

// ─── The answer ──────────────────────────────────────────────────────────────

export type ResendFailureKind = 'provider_not_ready' | 'rate_limited' | 'retry' | 'rejected';

export type ResendResult =
  | { ok: true; id: string; status: number }
  | {
      ok: false;
      kind: ResendFailureKind;
      /** The HTTP status, or null when there was no answer. */
      status: number | null;
      /** Resend's error name when it gave one (for example "validation_error"). */
      code: string;
      /** Our short classification (for example "domain_not_verified"). */
      reason: string;
      /** The provider's message with every address removed, shortened. */
      detail: string;
      retryAfterSeconds?: number;
    };

export { scrubDetail };

function classify(status: number, name: string, message: string): { kind: ResendFailureKind; reason: string } {
  const text = message.toLowerCase();
  if (status === 429) return { kind: 'rate_limited', reason: /quota/.test(name) || /quota/.test(text) ? 'quota_exceeded' : 'rate_limit' };
  if (status === 401 || name === 'invalid_api_key' || name === 'missing_api_key') return { kind: 'provider_not_ready', reason: 'invalid_api_key' };
  if (status === 403) {
    if (name === 'invalid_from_address') return { kind: 'provider_not_ready', reason: 'invalid_from_address' };
    // the sandbox message also says "verify a domain", so it is told apart first
    if (/testing emails|own email address/.test(text)) return { kind: 'provider_not_ready', reason: 'sandbox_recipient_only' };
    if (/domain/.test(text) && /verif/.test(text)) return { kind: 'provider_not_ready', reason: 'domain_not_verified' };
    return { kind: 'provider_not_ready', reason: 'provider_forbidden' };
  }
  if (status === 409 && name === 'concurrent_idempotent_requests') return { kind: 'retry', reason: 'concurrent_request' };
  if ((status === 409 || status === 422) && name === 'invalid_idempotent_request') return { kind: 'rejected', reason: 'idempotency_conflict' };
  if (status === 400 || status === 422) return { kind: 'rejected', reason: 'invalid_request' };
  if (status >= 500) return { kind: 'retry', reason: 'provider_error' };
  if (status === 408) return { kind: 'retry', reason: 'timeout' };
  return { kind: 'rejected', reason: 'unexpected_status' };
}

export interface SendDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function sendViaResend(config: ResendConfig, message: OutboundEmail, deps: SendDeps = {}): Promise<ResendResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const { url, init } = buildResendRequest(config, message);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 15_000);
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { ok: false, kind: 'retry', status: null, code: aborted ? 'timeout' : 'network_error', reason: aborted ? 'timeout' : 'network_error', detail: aborted ? 'Resend did not answer in time.' : 'Resend could not be reached.' };
  } finally {
    clearTimeout(timer);
  }

  let payload: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await response.json();
    payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    payload = null;
  }

  if (response.ok) {
    const id = typeof payload?.id === 'string' ? payload.id : '';
    if (id && id.length <= 200 && /^[A-Za-z0-9_-]+$/.test(id)) return { ok: true, id, status: response.status };
    return { ok: false, kind: 'retry', status: response.status, code: 'no_message_id', reason: 'unexpected_response', detail: 'Resend answered without a message id.' };
  }

  const name = typeof payload?.name === 'string' ? payload.name : '';
  const detail = scrubDetail(payload?.message);
  const { kind, reason } = classify(response.status, name, detail);
  const retryAfter = Number(response.headers.get('retry-after'));
  return {
    ok: false,
    kind,
    status: response.status,
    code: name || `http_${response.status}`,
    reason,
    detail,
    ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: Math.min(Math.ceil(retryAfter), 86_400) } : {}),
  };
}
