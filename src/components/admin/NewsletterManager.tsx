'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import type { NewsletterSubscriber } from '@/lib/data';

/** One CSV cell: quoted when it needs to be, and a leading = + - @ (a spreadsheet formula) is defused with an apostrophe. */
function csvCell(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NewsletterManager() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function showMessage(text: string, error = false) {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 4000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await adminFetch('/api/admin/newsletter');
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'Your session has expired. Please sign in again.' : 'Could not load the subscriber list.');
      }
      const data = await res.json();
      setSubscribers(Array.isArray(data.subscribers) ? data.subscribers : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the subscriber list.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  async function handleDelete(subscriber: NewsletterSubscriber) {
    if (!confirm(`Remove ${subscriber.email} from the newsletter list? This cannot be undone.`)) return;
    setBusyId(subscriber.id);
    try {
      const res = await adminFetch('/api/admin/newsletter', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subscriber.id }),
      });
      if (res.status === 404) {
        // Already gone (removed in another tab): the list was stale, so just bring it up to date.
        setSubscribers((current) => current.filter((s) => s.id !== subscriber.id));
        showMessage('That address was already removed.');
        return;
      }
      if (!res.ok) throw new Error('Could not remove the subscriber.');
      setSubscribers((current) => current.filter((s) => s.id !== subscriber.id));
      showMessage(`${subscriber.email} removed from the list`);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Could not remove the subscriber.', true);
    } finally {
      setBusyId(null);
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

  const buttonClasses =
    'px-4 py-2 bg-white/[0.03] text-white/40 text-sm border border-white/[0.08] rounded-sm hover:bg-white/[0.06] hover:text-white/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Newsletter Subscribers</h2>
          <p className="text-white/30 text-[11px] mt-0.5">Addresses collected by the Stay Updated form in the website footer</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className={buttonClasses}>
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            disabled={subscribers.length === 0}
            className="px-4 py-2 border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-semibold rounded-sm hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div
          role={message.error ? 'alert' : 'status'}
          className={`mb-4 px-4 py-2 rounded-sm text-sm font-body ${
            message.error ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-[#1BBFA1]/10 text-[#1BBFA1] border border-[#1BBFA1]/20'
          }`}
        >
          {message.text}
        </div>
      )}

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
          {shown.map((subscriber) => (
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
              <button
                onClick={() => handleDelete(subscriber)}
                disabled={busyId === subscriber.id}
                aria-label={`Remove ${subscriber.email}`}
                className="ml-auto px-3 py-1.5 text-[11px] text-white/40 border border-white/[0.08] rounded-sm hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
