'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import type { SendingStatus } from '@/lib/email/sender';
import SubscribersPanel from './newsletter/SubscribersPanel';
import TemplatesPanel from './newsletter/TemplatesPanel';
import GuidelinesPanel from './newsletter/GuidelinesPanel';
import SendLogPanel from './newsletter/SendLogPanel';
import SendingStatusPanel from './newsletter/SendingStatusPanel';
import ProviderNotice from './newsletter/ProviderNotice';
import { useLatestRequest } from './newsletter/shared';

/**
 * The Newsletter area of the admin portal: the subscriber list, the email templates (write, preview, quality review,
 * approve, activate, test), the brand guidelines and quality rules, the send log and the sending status.
 */

const SECTIONS = [
  { id: 'subscribers', label: 'Subscribers' },
  { id: 'templates', label: 'Email templates' },
  { id: 'guidelines', label: 'Brand guidelines' },
  { id: 'log', label: 'Send log' },
  { id: 'status', label: 'Sending status' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export default function NewsletterManager() {
  const [section, setSection] = useState<SectionId>('subscribers');
  const [status, setStatus] = useState<SendingStatus | null>(null);
  const begin = useLatestRequest();

  // A quota or provider problem, and any welcome emails waiting because of it, are shown above every section.
  const loadStatus = useCallback(async () => {
    const isLatest = begin();
    try {
      const res = await adminFetch('/api/admin/newsletter/status');
      if (res.ok) {
        const body = (await res.json()) as SendingStatus;
        if (isLatest()) setStatus(body);
      }
    } catch {
      /* the banner is a convenience: the Sending status section reports errors */
    }
  }, [begin]);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 60_000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  return (
    <div>
      {status && section !== 'status' && <ProviderNotice status={status} compact />}
      <div role="tablist" aria-label="Newsletter sections" className="flex flex-wrap gap-1 mb-6 border-b border-white/[0.06]">
        {SECTIONS.map((item) => {
          const selected = item.id === section;
          return (
            <button
              key={item.id}
              role="tab"
              id={`newsletter-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`newsletter-panel-${item.id}`}
              onClick={() => setSection(item.id)}
              className={`px-4 py-2.5 text-sm font-body border-b-2 -mb-px transition-colors ${
                selected ? 'text-[#C9A84C] border-[#C9A84C]' : 'text-white/40 border-transparent hover:text-white/70'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`newsletter-panel-${section}`} aria-labelledby={`newsletter-tab-${section}`}>
        {section === 'subscribers' && <SubscribersPanel />}
        {section === 'templates' && <TemplatesPanel />}
        {section === 'guidelines' && <GuidelinesPanel />}
        {section === 'log' && <SendLogPanel />}
        {section === 'status' && <SendingStatusPanel onNavigate={(target) => setSection(target)} />}
      </div>
    </div>
  );
}
