'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import type { SendLogEntry } from '@/lib/email/send-log';
import { Badge, OUTCOMES, buttonClasses, cardClasses, errorText, fieldClasses, formatDate, labelClasses, reasonText, useLatestRequest } from './shared';

/** Every attempt to send (and every unsubscribe), newest first: who it was for (masked), the outcome, why, and the provider's message id. */

const KIND_LABEL: Record<string, string> = { welcome: 'Welcome', test: 'Test', unsubscribe: 'Unsubscribe' };

export default function SendLogPanel() {
  const [entries, setEntries] = useState<SendLogEntry[]>([]);
  const [kind, setKind] = useState('');
  const [outcome, setOutcome] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const begin = useLatestRequest();

  const load = useCallback(async () => {
    const isLatest = begin();
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (kind) params.set('kind', kind);
      if (outcome) params.set('outcome', outcome);
      const res = await adminFetch(`/api/admin/newsletter/log?${params.toString()}`);
      if (!res.ok) throw new Error(await errorText(res, 'Could not load the send log.'));
      const body = (await res.json()) as { entries?: SendLogEntry[] };
      if (!isLatest()) return;
      setEntries(Array.isArray(body.entries) ? body.entries : []);
    } catch (err) {
      if (isLatest()) setError(err instanceof Error ? err.message : 'Could not load the send log.');
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [kind, outcome, begin]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div data-testid="send-log">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Send log</h2>
          <p className="text-white/30 text-[11px] mt-0.5">Every attempt to send an email and every unsubscribe. Addresses are masked; no key is ever shown.</p>
        </div>
        <button onClick={load} className={buttonClasses}>
          Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="log-kind" className={labelClasses}>
            Kind
          </label>
          <select id="log-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={`${fieldClasses} min-w-[160px]`}>
            <option value="">All</option>
            <option value="welcome">Welcome</option>
            <option value="test">Test</option>
            <option value="unsubscribe">Unsubscribe</option>
          </select>
        </div>
        <div>
          <label htmlFor="log-outcome" className={labelClasses}>
            Outcome
          </label>
          <select id="log-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className={`${fieldClasses} min-w-[200px]`}>
            <option value="">All</option>
            {Object.entries(OUTCOMES).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={`${cardClasses} p-8 text-center`}>
          <p className="text-white/25 text-sm font-body">Loading the log...</p>
        </div>
      ) : error ? (
        <div role="alert" className="bg-[#0A0A0A] border border-red-400/20 rounded-sm p-8 text-center">
          <p className="text-red-400 text-sm font-body">{error}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className={`${cardClasses} p-8 text-center`}>
          <p className="text-white/25 text-sm font-body">{kind || outcome ? 'Nothing matches these filters.' : 'Nothing has been sent yet.'}</p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Send log">
          {entries.map((entry) => {
            const meta = OUTCOMES[entry.outcome] ?? { label: entry.outcome, tone: 'muted' as const };
            return (
              <li key={entry.id} data-log-id={entry.id} className={`${cardClasses} px-4 py-3`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="text-[11px] text-white/45 font-body">{KIND_LABEL[entry.kind] ?? entry.kind}</span>
                  <span className="text-sm text-white font-body">{entry.to}</span>
                  <span className="text-[11px] text-white/30 font-body">{entry.templateKey}{entry.version ? ` v${entry.version}` : ''}</span>
                  <span className="ml-auto text-[11px] text-white/35 font-body">{formatDate(entry.at)}</span>
                </div>
                {(entry.reason || entry.detail || entry.messageId || entry.httpStatus) && (
                  <div className="mt-1.5 text-[12px] text-white/45 font-body space-y-0.5">
                    {entry.reason && <p>{reasonText(entry.reason)}</p>}
                    {entry.detail && <p className="text-white/30 [overflow-wrap:anywhere]">{entry.detail}</p>}
                    {entry.messageId && (
                      <p className="text-white/35">
                        Message id <code className="text-[#C9A84C]/80" data-testid="log-message-id">{entry.messageId}</code>
                      </p>
                    )}
                    {entry.httpStatus ? <p className="text-white/25">Provider answered {entry.httpStatus}{entry.code ? ` (${entry.code})` : ''}</p> : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
