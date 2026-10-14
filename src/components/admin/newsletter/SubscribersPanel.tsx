'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import type { NewsletterSubscriber } from '@/lib/data';
import { Badge, Flash, JSON_HEADERS, buttonClasses, dangerButtonClasses, errorText, formatDate, goldButtonClasses, reasonText, useFlash, useLatestRequest, type Tone } from './shared';

/** One CSV cell: quoted when it needs to be, and a leading = + - @ (a spreadsheet formula) is defused with an apostrophe. */
function csvCell(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const WELCOME_BADGE: Record<string, { label: string; tone: Tone }> = {
  sent: { label: 'Welcome sent', tone: 'good' },
  pending: { label: 'Welcome waiting', tone: 'gold' },
  sending: { label: 'Sending', tone: 'info' },
  failed: { label: 'Welcome failed', tone: 'bad' },
  skipped: { label: 'No welcome', tone: 'muted' },
};

interface SendSummary {
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  stoppedBecause?: string;
}

export default function SubscribersPanel() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const { flash, show } = useFlash();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sendingPending, setSendingPending] = useState(false);
  const begin = useLatestRequest();

  const load = useCallback(async () => {
    const isLatest = begin();
    setLoading(true);
    setLoadError('');
    try {
      const res = await adminFetch('/api/admin/newsletter');
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'Your session has expired. Please sign in again.' : 'Could not load the subscriber list.');
      }
      const data = await res.json();
      if (!isLatest()) return;
      setSubscribers(Array.isArray(data.subscribers) ? data.subscribers : []);
    } catch (err) {
      if (isLatest()) setLoadError(err instanceof Error ? err.message : 'Could not load the subscriber list.');
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [begin]);

  useEffect(() => {
    load();
  }, [load]);

  // Newest first.
  const sorted = useMemo(
    () => [...subscribers].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [subscribers],
  );

  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () => (needle ? sorted.filter((s) => s.email.toLowerCase().includes(needle) || (s.source ?? '').toLowerCase().includes(needle)) : sorted),
    [sorted, needle],
  );

  const waiting = useMemo(() => subscribers.filter((s) => s.welcome && (s.welcome.status === 'pending' || s.welcome.status === 'sending')).length, [subscribers]);

  async function handleDelete(subscriber: NewsletterSubscriber) {
    if (!confirm(`Remove ${subscriber.email} from the newsletter list? This cannot be undone.`)) return;
    setBusyId(subscriber.id);
    try {
      const res = await adminFetch('/api/admin/newsletter', {
        method: 'DELETE',
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: subscriber.id }),
      });
      if (res.status === 404) {
        // Already gone (removed in another tab or by the recipient): the list was stale, so just bring it up to date.
        setSubscribers((current) => current.filter((s) => s.id !== subscriber.id));
        show('That address was already removed.');
        return;
      }
      if (!res.ok) throw new Error('Could not remove the subscriber.');
      setSubscribers((current) => current.filter((s) => s.id !== subscriber.id));
      show(`${subscriber.email} removed from the list`);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not remove the subscriber.', true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendPending() {
    setSendingPending(true);
    try {
      const res = await adminFetch('/api/admin/newsletter/send', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ mode: 'pending' }) });
      if (!res.ok) throw new Error(await errorText(res, 'Could not send the waiting welcome emails.'));
      const summary = (await res.json()) as SendSummary;
      if (summary.stoppedBecause) show(`${summary.sent} sent. ${reasonText(summary.stoppedBecause)}`, summary.sent === 0);
      else if (summary.considered === 0) show('No welcome emails are waiting.');
      else show(`${summary.sent} welcome ${summary.sent === 1 ? 'email' : 'emails'} sent${summary.failed ? `, ${summary.failed} refused by the provider` : ''}${summary.pending ? `, ${summary.pending} still waiting` : ''}.`);
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not send the waiting welcome emails.', true);
    } finally {
      setSendingPending(false);
    }
  }

  // Built in the browser from the list already loaded with the admin session: no extra endpoint.
  function handleExportCsv() {
    const rows = sorted.map((s) => [s.id, s.email, s.createdAt, s.source ?? ''].map(csvCell).join(','));
    const csv = ['id,email,createdAt,source', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Newsletter Subscribers</h2>
          <p className="text-white/30 text-[11px] mt-0.5">Addresses collected by the Stay Updated form in the website footer</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={load} className={buttonClasses}>
            Refresh
          </button>
          <button onClick={handleSendPending} disabled={sendingPending || waiting === 0} className={buttonClasses} title="Try the welcome emails that could not be sent yet">
            {sendingPending ? 'Sending...' : `Send waiting welcomes${waiting ? ` (${waiting})` : ''}`}
          </button>
          <button onClick={handleExportCsv} disabled={subscribers.length === 0} className={goldButtonClasses}>
            Export CSV
          </button>
        </div>
      </div>

      <Flash flash={flash} />

      {/* Count + search */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm px-4 py-2.5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider">Subscribers</p>
          <p data-testid="newsletter-count" className="text-xl font-semibold text-white leading-tight">
            {subscribers.length}
          </p>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="newsletter-search" className="sr-only">
            Search subscribers
          </label>
          <input
            id="newsletter-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or page"
            autoComplete="off"
            className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm font-body placeholder-white/25 focus:outline-none focus:border-[#C9A84C]"
          />
        </div>
        {needle && (
          <p className="text-[11px] text-white/30">
            Showing {shown.length} of {subscribers.length}
          </p>
        )}
      </div>

      {loading ? (
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-8 text-center">
          <p className="text-white/25 text-sm font-body">Loading subscribers...</p>
        </div>
      ) : loadError ? (
        <div role="alert" className="bg-[#0A0A0A] border border-red-400/20 rounded-sm p-8 text-center">
          <p className="text-red-400 text-sm font-body">{loadError}</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-8 text-center">
          <p className="text-white/25 text-sm font-body">{needle ? 'No subscribers match your search.' : 'No subscribers yet.'}</p>
          {!needle && (
            <p className="text-white/15 text-[11px] font-body mt-1">Addresses appear here when visitors use the Stay Updated form in the footer.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Newsletter subscribers">
          {shown.map((subscriber) => {
            const welcome = subscriber.welcome;
            const badge = welcome ? WELCOME_BADGE[welcome.status] : undefined;
            const detail = welcome ? (welcome.status === 'sent' ? `Sent ${formatDate(welcome.sentAt)}` : reasonText(welcome.reason)) : 'Joined before welcome emails existed';
            return (
              <li
                key={subscriber.id}
                data-subscriber-id={subscriber.id}
                className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
              >
                <span className="text-sm font-body text-white min-w-0 flex-1 basis-56 [overflow-wrap:anywhere]">{subscriber.email}</span>
                <span className="text-[11px] text-white/35 font-body flex-shrink-0">{formatDate(subscriber.createdAt)}</span>
                <span className="text-[11px] text-white/25 font-body flex-shrink-0 min-w-[64px]" title="Page the visitor subscribed from">
                  {subscriber.source || 'unknown page'}
                </span>
                {badge && (
                  <span data-testid="welcome-state" title={detail} className="flex-shrink-0">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </span>
                )}
                <button
                  onClick={() => handleDelete(subscriber)}
                  disabled={busyId === subscriber.id}
                  aria-label={`Remove ${subscriber.email}`}
                  className={`ml-auto ${dangerButtonClasses}`}
                >
                  Delete
                </button>
                {welcome && welcome.status !== 'sent' && detail && <p className="basis-full text-[11px] text-white/35 font-body">{detail}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
