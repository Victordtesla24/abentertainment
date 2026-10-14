'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** Shared look and small helpers for the newsletter admin panels (same visual language as the other admin managers). */

export const cardClasses = 'bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm';
export const fieldClasses =
  'w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm font-body placeholder-white/25 focus:outline-none focus:border-[#C9A84C] disabled:opacity-50';
export const labelClasses = 'block text-[11px] uppercase tracking-wider text-white/40 mb-1 font-body';
export const buttonClasses =
  'px-4 py-2 bg-white/[0.03] text-white/50 text-sm border border-white/[0.08] rounded-sm hover:bg-white/[0.06] hover:text-white/70 transition-all disabled:opacity-40 disabled:cursor-not-allowed';
export const goldButtonClasses =
  'px-4 py-2 border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-semibold rounded-sm hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
export const dangerButtonClasses =
  'px-3 py-1.5 text-[11px] text-white/40 border border-white/[0.08] rounded-sm hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed';

export type Tone = 'good' | 'gold' | 'bad' | 'muted' | 'info';
const TONES: Record<Tone, string> = {
  good: 'bg-[#1BBFA1]/10 text-[#1BBFA1] border-[#1BBFA1]/25',
  gold: 'bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30',
  bad: 'bg-red-400/10 text-red-400 border-red-400/25',
  muted: 'bg-white/[0.04] text-white/45 border-white/[0.08]',
  info: 'bg-sky-400/10 text-sky-300 border-sky-400/25',
};

export function Badge({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-body whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "in 2 hours 4 minutes" / "5 minutes ago" for an ISO time (empty when there is none). */
export function relativeTime(iso: string | undefined | null, now: number = Date.now()): string {
  if (!iso) return '';
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return '';
  if (Math.abs(target - now) < 60_000) return target > now ? 'in less than a minute' : 'just now';
  const diff = Math.round((target - now) / 60_000);
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const span = hours > 0 ? `${hours} hour${hours === 1 ? '' : 's'}${minutes ? ` ${minutes} minute${minutes === 1 ? '' : 's'}` : ''}` : `${minutes} minute${minutes === 1 ? '' : 's'}`;
  return diff >= 0 ? `in ${span}` : `${span} ago`;
}

export interface FlashMessage {
  text: string;
  error: boolean;
}

/** A short status line that clears itself (longer for errors, which an admin needs time to read). */
export function useFlash() {
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, error = false) => {
    setFlash({ text, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), error ? 9000 : 5000);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return { flash, show };
}

export function Flash({ flash }: { flash: FlashMessage | null }) {
  if (!flash) return null;
  return (
    <div
      role={flash.error ? 'alert' : 'status'}
      className={`mb-4 px-4 py-2 rounded-sm text-sm font-body ${
        flash.error ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-[#1BBFA1]/10 text-[#1BBFA1] border border-[#1BBFA1]/20'
      }`}
    >
      {flash.text}
    </div>
  );
}

/**
 * Only the newest of several overlapping loads may change the screen: call `begin()` when a load starts and check the
 * function it returns once the answer is in, so a slow earlier answer (or React's second development-mode load) can never
 * overwrite what the administrator has typed or chosen since.
 */
export function useLatestRequest() {
  const sequence = useRef(0);
  return useCallback(() => {
    const mine = ++sequence.current;
    return () => mine === sequence.current;
  }, []);
}

/** The server's own words when it gave any ({error}), else the fallback; a 401 always says the session is over. */
export async function errorText(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return 'Your session has expired. Please sign in again.';
  try {
    const body: unknown = await res.json();
    const message = (body as { error?: unknown } | null)?.error;
    if (typeof message === 'string' && message) return message;
  } catch {
    /* not JSON */
  }
  return fallback;
}

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ─── Words for codes ─────────────────────────────────────────────────────────

const WELCOME_REASONS: Record<string, string> = {
  queued: 'Queued: the welcome email is about to be sent.',
  sending: 'Being sent now.',
  not_configured: 'Waiting: sending is not configured on the server.',
  no_signing_secret: 'Waiting: the server has no secret for unsubscribe links.',
  no_template: 'Waiting: there is no welcome template.',
  no_active_version: 'Waiting: the welcome template has no approved, active version.',
  not_approved: 'Waiting: the active version has not passed the quality review.',
  approval_stale: 'Waiting: the approval no longer applies. Run the quality review again.',
  layout_not_installed: 'Waiting: no brand layout is installed.',
  gate_failed: 'Waiting: the rendered email fails a quality check.',
  hourly_cap: 'Waiting: the hourly sending cap was reached.',
  provider_not_ready: 'Waiting: the email provider is not ready (for example the sending domain is not verified).',
  provider_rate_limited: 'Waiting: the email provider asked for fewer requests.',
  provider_unavailable: 'Waiting: the email provider had a temporary problem; it will be tried again.',
  internal_error: 'Waiting: something went wrong; it will be tried again.',
  rejected_by_provider: 'The email provider refused this message.',
  invalid_address: 'The address cannot be sent to.',
  template_disabled: 'Not sent: the welcome template is switched off.',
  unsubscribed: 'Not sent: the address unsubscribed.',
  legacy_subscriber: 'Joined before welcome emails existed: none is sent.',
  // log reasons
  domain_not_verified: 'The sending domain is not verified with the email provider yet.',
  sandbox_recipient_only: 'The email provider only allows test emails to its owner until a domain is verified.',
  invalid_api_key: 'The email provider rejected the API key.',
  invalid_from_address: 'The email provider rejected the sender address.',
  provider_forbidden: 'The email provider refused the request.',
  rate_limit: 'The email provider rate limit was reached.',
  quota_exceeded: 'The email provider quota was reached, so it will not send more until the quota resets.',
  provider_error: 'The email provider had a temporary error.',
  network_error: 'The email provider could not be reached.',
  timeout: 'The email provider did not answer in time.',
  concurrent_request: 'The same send was already in progress.',
  unexpected_response: 'The email provider answered in an unexpected way.',
  invalid_request: 'The email provider found the message invalid.',
  idempotency_conflict: 'The same send had already been made with different content.',
  unexpected_status: 'The email provider answered with an unexpected status.',
  confirm_page: 'The recipient confirmed on the unsubscribe page.',
  one_click: 'The recipient used their mail app’s unsubscribe button.',
};

export function reasonText(code: string | undefined | null): string {
  if (!code) return '';
  return WELCOME_REASONS[code] ?? code.replace(/_/g, ' ');
}

export const OUTCOMES: Record<string, { label: string; tone: Tone }> = {
  sent: { label: 'Sent', tone: 'good' },
  reserved: { label: 'In flight', tone: 'info' },
  failed: { label: 'Failed', tone: 'bad' },
  retry: { label: 'Will retry', tone: 'gold' },
  blocked: { label: 'Blocked', tone: 'gold' },
  provider_not_ready: { label: 'Provider not ready', tone: 'gold' },
  rate_limited: { label: 'Rate limited', tone: 'gold' },
  skipped: { label: 'Skipped', tone: 'muted' },
  unsubscribed: { label: 'Unsubscribed', tone: 'muted' },
};

export const BLOCKERS: Record<string, string> = {
  not_configured: 'Sending is not configured on the server (RESEND_API_KEY and EMAIL_FROM).',
  no_signing_secret: 'The server has no secret for signing unsubscribe links (NEWSLETTER_UNSUBSCRIBE_SECRET or SESSION_SECRET).',
  no_template: 'There is no welcome template. Create one with the key newsletter_welcome.',
  template_disabled: 'The welcome template is switched off.',
  no_active_version: 'No version of the welcome template is approved and active. Review a version, then activate it.',
  not_approved: 'The active version has not passed the quality review.',
  approval_stale: 'The active version’s approval no longer applies (the content, layout or brand guidelines changed). Review it again.',
  layout_not_installed: 'No brand email layout is installed.',
  gate_failed: 'The rendered email fails a quality check.',
  disabled: 'The welcome template is switched off.',
};

export function blockerText(code: string): string {
  return BLOCKERS[code] ?? code.replace(/_/g, ' ');
}

/** A refusal's reason code in words: the send-log reasons first, then the blockers, else the server's own message. */
export function explainReason(code: string | undefined, fallback: string): string {
  if (code && WELCOME_REASONS[code]) return WELCOME_REASONS[code];
  if (code && BLOCKERS[code]) return BLOCKERS[code];
  return fallback;
}
