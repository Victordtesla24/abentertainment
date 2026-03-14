'use client';

import { useState } from 'react';

export function FooterNewsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setStatus('success');
        setMessage('Welcome to the family! Look out for our next announcement.');
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error ?? 'Subscription failed. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <div>
      <h3 className="font-body text-xs font-medium uppercase tracking-[0.2em] text-ivory/40">
        Stay in the Loop
      </h3>
      <p className="mt-3 font-body text-sm leading-relaxed text-ivory/40">
        Event announcements and exclusive previews.
      </p>
      {status === 'success' ? (
        <p className="mt-4 font-body text-sm text-gold">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2" aria-label="Newsletter subscription">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={status === 'loading'}
            aria-label="Email address"
            className="flex-1 min-w-0 rounded-full border border-ivory/10 bg-ivory/5 px-4 py-2 font-body text-sm text-ivory placeholder-ivory/30 focus:border-gold/40 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="rounded-full border border-gold/40 bg-gold/10 px-4 py-2 font-body text-xs font-semibold uppercase tracking-widest text-gold transition-all hover:bg-gold hover:text-charcoal disabled:opacity-60"
          >
            {status === 'loading' ? '...' : 'Join'}
          </button>
        </form>
      )}
      {status === 'error' && (
        <p className="mt-2 font-body text-xs text-red-400">{message}</p>
      )}
    </div>
  );
}
