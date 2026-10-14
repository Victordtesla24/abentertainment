'use client';
import type { SendingStatus } from '@/lib/email/sender';
import { formatDate, reasonText, relativeTime } from './shared';

/**
 * The plain-language account of a block at the email provider (a quota, a rate limit, an unverified domain, a temporary
 * error): what is wrong, when it was last tried, when automatic attempts resume and when the next one is due.
 */

export function providerHeadline(status: SendingStatus): string {
  const { provider } = status;
  if (provider.lastReason === 'quota_exceeded') {
    const daily = (provider.lastCode ?? '').includes('daily');
    const monthly = (provider.lastCode ?? '').includes('monthly');
    return `The email provider’s ${daily ? 'daily ' : monthly ? 'monthly ' : ''}sending quota has been reached.`;
  }
  return reasonText(provider.lastReason) || 'The email provider refused the last send.';
}

export default function ProviderNotice({ status, compact = false }: { status: SendingStatus; compact?: boolean }) {
  const { provider, waiting } = status;
  const blocked = provider.state === 'blocked';
  if (!blocked && waiting.count === 0) return null;
  const resumes = provider.blockedUntil && Date.parse(provider.blockedUntil) > Date.now() ? provider.blockedUntil : null;
  const waitingText = waiting.count > 0 ? `${waiting.count} welcome ${waiting.count === 1 ? 'email is' : 'emails are'} waiting to be sent.` : '';

  if (compact) {
    return (
      <div role="status" data-testid="provider-banner" className="mb-6 px-4 py-3 rounded-sm border border-[#C9A84C]/30 bg-[#C9A84C]/[0.06] text-sm font-body text-[#C9A84C]">
        {blocked ? <strong className="font-semibold">{providerHeadline(status)} </strong> : null}
        {waitingText}
        {blocked && resumes ? ` Automatic attempts resume ${relativeTime(resumes)} (${formatDate(resumes)}).` : ''}
        {blocked && !resumes ? ' The next attempt is due now.' : ''}
        {!blocked && waiting.count > 0 ? ' See Sending status for why.' : ''}
      </div>
    );
  }

  return (
    <div data-testid="provider-block" className="border border-[#C9A84C]/30 bg-[#C9A84C]/[0.05] rounded-sm p-5">
      <h3 className="text-base font-display font-bold text-[#C9A84C]">{blocked ? providerHeadline(status) : 'Welcome emails are waiting'}</h3>
      {waitingText && <p className="text-sm text-white/70 font-body mt-1">{waitingText}</p>}
      <dl className="mt-3 text-sm font-body space-y-1.5">
        {provider.lastAttemptAt && (
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-white/40">Last attempt</dt>
            <dd className="text-white/80 text-right" data-testid="provider-last-attempt">
              {formatDate(provider.lastAttemptAt)} ({relativeTime(provider.lastAttemptAt)})
              {provider.lastHttpStatus ? `, the provider answered ${provider.lastHttpStatus}${provider.lastCode ? ` ${provider.lastCode}` : ''}` : ''}
            </dd>
          </div>
        )}
        {blocked && (
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-white/40">Automatic attempts resume</dt>
            <dd className="text-white/80 text-right" data-testid="provider-resumes">
              {resumes ? `${formatDate(resumes)} (${relativeTime(resumes)})` : 'now: a retry is due'}
            </dd>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-white/40">Next automatic attempt</dt>
          <dd className="text-white/80 text-right" data-testid="provider-next-attempt">
            {provider.nextAttemptAt
              ? `${formatDate(provider.nextAttemptAt)} (${relativeTime(provider.nextAttemptAt)})`
              : provider.automaticRetry
                ? 'none scheduled yet: one is set when the next email is attempted or the server restarts'
                : 'automatic retries are switched off on this server: use “Send waiting welcomes”'}
          </dd>
        </div>
        {provider.lastDetail && (
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-white/40">The provider said</dt>
            <dd className="text-white/60 text-right [overflow-wrap:anywhere]">{provider.lastDetail}</dd>
          </div>
        )}
        {provider.lastSuccessAt && (
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-white/40">Last email accepted</dt>
            <dd className="text-white/60 text-right">{formatDate(provider.lastSuccessAt)}</dd>
          </div>
        )}
        {waiting.count > 0 && (
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-white/40">Waiting since</dt>
            <dd className="text-white/60 text-right">{formatDate(waiting.oldestAt)}</dd>
          </div>
        )}
        {Object.keys(waiting.reasons).length > 0 && (
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-white/40">Why they are waiting</dt>
            <dd className="text-white/60 text-right">
              {Object.entries(waiting.reasons).map(([reason, count]) => (
                <span key={reason} className="block">
                  {count} × {reasonText(reason)}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
      <p className="text-[12px] text-white/35 font-body mt-3">
        A refusal like this holds automatic sending back until it should have cleared, so the site does not keep asking. Pressing “Send waiting welcomes” in the Subscribers tab tries straight away.
      </p>
    </div>
  );
}
