'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import type { SendingStatus } from '@/lib/email/sender';
import ProviderNotice from './ProviderNotice';
import { ReviewerAvailability } from './ReviewerAttempts';
import { Badge, blockerText, buttonClasses, cardClasses, errorText, formatDate, useLatestRequest } from './shared';

/**
 * Whether the welcome email can go out right now, and if not, exactly why: the transport's configuration (the NAMES of
 * missing environment variables, never their values), the unsubscribe signing secret, the AI reviewers, the layout, the
 * state of the welcome template's approval, the subscriber counts and the hourly cap.
 */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 border-t border-white/[0.05] first:border-t-0">
      <dt className="text-[12px] text-white/40 font-body">{label}</dt>
      <dd className="text-sm text-white/80 font-body text-right [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export default function SendingStatusPanel({ onNavigate }: { onNavigate?: (section: 'templates' | 'subscribers') => void }) {
  const [status, setStatus] = useState<SendingStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const begin = useLatestRequest();

  const load = useCallback(async () => {
    const isLatest = begin();
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/newsletter/status');
      if (!res.ok) throw new Error(await errorText(res, 'Could not load the sending status.'));
      const body = (await res.json()) as SendingStatus;
      if (isLatest()) setStatus(body);
    } catch (err) {
      if (isLatest()) setError(err instanceof Error ? err.message : 'Could not load the sending status.');
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [begin]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div data-testid="sending-status">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Sending status</h2>
          <p className="text-white/30 text-[11px] mt-0.5">Whether the welcome email can go out, and why not when it cannot</p>
        </div>
        <button onClick={load} className={buttonClasses}>
          Refresh
        </button>
      </div>

      {loading && !status ? (
        <div className={`${cardClasses} p-8 text-center`}>
          <p className="text-white/25 text-sm font-body">Loading status...</p>
        </div>
      ) : error ? (
        <div role="alert" className="bg-[#0A0A0A] border border-red-400/20 rounded-sm p-8 text-center">
          <p className="text-red-400 text-sm font-body">{error}</p>
        </div>
      ) : status ? (
        <div className="space-y-4">
          <ProviderNotice status={status} />
          <div className={`${cardClasses} p-5`} data-testid="welcome-readiness">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-display font-bold text-white">Welcome email</h3>
              {status.welcome.readyToSend ? <Badge tone="good">Ready to send</Badge> : <Badge tone="gold">Not ready</Badge>}
            </div>
            {status.welcome.readyToSend ? (
              <p className="text-sm text-white/55 font-body mt-2">
                Version {status.welcome.activeVersion} is approved and active. A new subscriber receives the welcome email as soon as they subscribe.
              </p>
            ) : (
              <>
                <p className="text-sm text-white/55 font-body mt-2">New subscribers are saved and wait until the following is resolved:</p>
                <ul className="mt-2 space-y-1 list-disc pl-5">
                  {status.welcome.blockers.map((code) => (
                    <li key={code} className="text-sm text-[#C9A84C] font-body">
                      {blockerText(code)}
                    </li>
                  ))}
                </ul>
                {onNavigate && (
                  <button onClick={() => onNavigate('templates')} className={`${buttonClasses} mt-3`}>
                    Open the email templates
                  </button>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <dl className={`${cardClasses} p-5`}>
              <h3 className="text-sm font-display font-bold text-white mb-2">Email provider (Resend)</h3>
              <Row label="Configuration">{status.configured ? <Badge tone="good">Configured</Badge> : <Badge tone="bad">Not configured</Badge>}</Row>
              <Row label="Last answer">
                {status.provider.state === 'ok' && <Badge tone="good">Accepting emails</Badge>}
                {status.provider.state === 'blocked' && <Badge tone="gold">Refused the last send</Badge>}
                {status.provider.state === 'unknown' && <Badge tone="muted">Not tried yet</Badge>}
                {status.provider.lastAttemptAt ? <span className="block text-[11px] text-white/30">{formatDate(status.provider.lastAttemptAt)}</span> : null}
              </Row>
              {status.missing.length > 0 && <Row label="Not set">{status.missing.join(', ')}</Row>}
              {status.invalid.length > 0 && <Row label="Not usable">{status.invalid.join(', ')}</Row>}
              <Row label="Unsubscribe links">
                {status.signing.configured ? <Badge tone="good">Signed</Badge> : <Badge tone="bad">No secret</Badge>}
                {status.signing.source ? <span className="block text-[11px] text-white/30">from {status.signing.source}</span> : null}
              </Row>
              <Row label="Links in emails point to">{status.publicBaseUrl}</Row>
            </dl>

            <dl className={`${cardClasses} p-5`}>
              <h3 className="text-sm font-display font-bold text-white mb-2">Quality checks</h3>
              <Row label="Brand layout">
                {status.layout.installed ? <Badge tone="good">Installed</Badge> : <Badge tone="bad">Not installed</Badge>}
                <span className="block text-[11px] text-white/30">
                  {status.layout.id} {status.layout.version}
                </span>
              </Row>
              <Row label="AI reviewer">
                {status.ai.available ? <Badge tone="good">Available</Badge> : <Badge tone="bad">Not configured</Badge>}
                <span className="block text-[11px] text-white/30">{status.ai.available ? status.ai.providers.join(', ') : 'ANTHROPIC_API_KEY, OPENAI_API_KEY or OPENROUTER_API_KEY'}</span>
              </Row>
              <Row label="Reviewer model">
                <span data-testid="reviewer-model">{status.reviewer.setting || 'Default'}</span>
                <span className="block text-[11px] text-white/30">
                  {status.reviewer.chain.length > 0 ? `Tried in order: ${status.reviewer.chain.map((a) => `${a.provider} ${a.model}`).join(', then ')}` : 'No reviewer is available'}
                </span>
              </Row>
              {status.reviewer.chain.length > 0 && (
                <Row label="Reviewer availability">
                  <ReviewerAvailability reviewer={status.reviewer} />
                </Row>
              )}
              <Row label="Welcome approval">
                {status.welcome.approval === 'approved' && <Badge tone="good">Approved</Badge>}
                {status.welcome.approval === 'stale' && <Badge tone="gold">Out of date</Badge>}
                {status.welcome.approval === 'unapproved' && <Badge tone="gold">Not approved</Badge>}
                {status.welcome.approval === 'none' && <Badge tone="muted">No active version</Badge>}
                {status.welcome.staleReasons.length > 0 && <span className="block text-[11px] text-white/30">{status.welcome.staleReasons.join(' and ')} changed</span>}
              </Row>
              <Row label="Template">{status.welcome.exists ? (status.welcome.enabled ? <Badge tone="good">On</Badge> : <Badge tone="muted">Off</Badge>) : <Badge tone="bad">Missing</Badge>}</Row>
            </dl>

            <dl className={`${cardClasses} p-5`}>
              <h3 className="text-sm font-display font-bold text-white mb-2">Subscribers</h3>
              <Row label="On the list">{status.subscribers.subscribed}</Row>
              <Row label="Welcome sent">{status.subscribers.welcomeSent}</Row>
              <Row label="Welcome waiting">{status.subscribers.welcomePending}</Row>
              <Row label="Welcome failed">{status.subscribers.welcomeFailed}</Row>
              <Row label="Welcome skipped">{status.subscribers.welcomeSkipped}</Row>
              {onNavigate && (
                <button onClick={() => onNavigate('subscribers')} className={`${buttonClasses} mt-3`}>
                  Open the subscribers
                </button>
              )}
            </dl>

            <dl className={`${cardClasses} p-5`}>
              <h3 className="text-sm font-display font-bold text-white mb-2">Sending limit</h3>
              <Row label="Sent in the last hour">{status.sending.sentLastHour}</Row>
              <Row label="Hourly cap">{status.sending.hourlyCap}</Row>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
