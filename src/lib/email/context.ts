import { SITE_CONFIG } from '@/lib/constants';
import type { RenderContext } from './types';

/**
 * The public site the email links point to: EMAIL_PUBLIC_BASE_URL when set, else the site URL. Always a
 * https URL without a trailing slash (a link that is not https is a gate failure, so an http value falls
 * back to the production site rather than producing a message that can never pass).
 */
export function publicBaseUrl(): string {
  const configured = (process.env.EMAIL_PUBLIC_BASE_URL || SITE_CONFIG.url || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[^/\s]+$/i.test(configured) ? configured : 'https://abentertainment.com.au';
}

/** The per-message parts a layout puts in its fixed slots. */
export function buildRenderContext(unsubscribeUrl: string, now: Date = new Date()): RenderContext {
  const siteUrl = publicBaseUrl();
  return {
    unsubscribeUrl,
    logoUrl: `${siteUrl}/images/AB_Logo_transparent-256w.png`,
    siteUrl,
    year: now.getUTCFullYear(),
    sender: {
      name: SITE_CONFIG.name,
      city: SITE_CONFIG.contact.address.city,
      state: SITE_CONFIG.contact.address.state,
      country: SITE_CONFIG.contact.address.country,
      contactEmail: SITE_CONFIG.contact.email,
      contactPhone: SITE_CONFIG.contact.phone,
      website: siteUrl,
    },
  };
}
