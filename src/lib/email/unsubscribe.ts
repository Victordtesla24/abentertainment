/**
 * Unsubscribing: what the link in every email does.
 *
 * Following the link (GET) NEVER changes anything: mail-security scanners, link previewers and prefetchers GET every link
 * in a message, and the web host turns a HEAD into a GET, so a GET that unsubscribed would remove people who never
 * asked. A GET only shows a confirmation page (previewUnsubscribe). The subscriber is removed by a POST: the button on
 * that page (the form), or the RFC 8058 one-click POST a mail app sends when its own Unsubscribe button is pressed.
 * Either way the signed token names the subscriber and the subscriber is REMOVED from the list: no row, no address kept,
 * nothing further sent (a queued welcome finds no subscriber). It is idempotent and never says whether the address was
 * on the list (the same answer for a first click, a second click and an address an admin had already deleted), and a
 * token that does not verify changes nothing. The reserved "test" token (admin test emails) is accepted and changes
 * nothing. A masked record of each removal goes to the send log so an admin can see that it happened.
 */

import { deleteNewsletterSubscriber, getNewsletterSubscribers } from '@/lib/data';
import { describeError, maskEmail } from '@/lib/newsletter';
import { appendSendLog } from './send-log';
import { TEST_SUBSCRIBER_ID, verifyUnsubscribeToken } from './unsubscribe-token';
import { WELCOME_TEMPLATE_KEY } from './types';

/** confirm_page: the button on the confirmation page; one_click: a mail app's own Unsubscribe button (RFC 8058). */
export type UnsubscribeVia = 'confirm_page' | 'one_click';

export type UnsubscribeResult =
  /** The address is no longer on the list (it may not have been: the answer is the same). */
  | { result: 'done'; removed: boolean }
  /** The token is not one this server issued (damaged, copied in part, tampered with). Nothing changed. */
  | { result: 'invalid' }
  /** The server cannot check tokens (no signing secret) or the list could not be read: try again later. */
  | { result: 'unavailable' };

export type UnsubscribePreview =
  /** The link is good and the address is on the list: show the confirmation (masked address; null for an admin test email). */
  | { result: 'confirm'; masked: string | null }
  /** The link is good but the address is no longer on the list: it is already done. */
  | { result: 'already' }
  | { result: 'invalid' }
  | { result: 'unavailable' };

/**
 * What a GET of the link shows. Read-only by construction: it looks the subscriber up and changes nothing, so a scanner
 * that fetches the link a hundred times leaves the list exactly as it was.
 */
export async function previewUnsubscribe(token: unknown, deps: { env?: Record<string, string | undefined> } = {}): Promise<UnsubscribePreview> {
  const checked = verifyUnsubscribeToken(token, deps.env ?? process.env);
  if (!checked.ok) return checked.reason === 'no_secret' ? { result: 'unavailable' } : { result: 'invalid' };
  if (checked.subscriberId === TEST_SUBSCRIBER_ID) return { result: 'confirm', masked: null };
  try {
    const found = (await getNewsletterSubscribers()).find((subscriber) => subscriber.id === checked.subscriberId);
    return found ? { result: 'confirm', masked: maskEmail(found.email) } : { result: 'already' };
  } catch (err) {
    console.error('[newsletter] unsubscribe preview failed:', describeError(err));
    return { result: 'unavailable' };
  }
}

export async function unsubscribeByToken(token: unknown, via: UnsubscribeVia, deps: { env?: Record<string, string | undefined>; now?: () => Date } = {}): Promise<UnsubscribeResult> {
  const checked = verifyUnsubscribeToken(token, deps.env ?? process.env);
  if (!checked.ok) return checked.reason === 'no_secret' ? { result: 'unavailable' } : { result: 'invalid' };
  if (checked.subscriberId === TEST_SUBSCRIBER_ID) return { result: 'done', removed: false };
  let removed;
  try {
    removed = await deleteNewsletterSubscriber(checked.subscriberId);
  } catch (err) {
    console.error('[newsletter] unsubscribe failed:', describeError(err));
    return { result: 'unavailable' };
  }
  if (removed) {
    try {
      await appendSendLog({ kind: 'unsubscribe', outcome: 'unsubscribed', to: maskEmail(removed.email), subscriberId: removed.id, templateKey: removed.welcome?.templateKey ?? WELCOME_TEMPLATE_KEY, reason: via, by: 'system' }, (deps.now ?? (() => new Date()))());
    } catch (err) {
      console.error('[newsletter] unsubscribe was not logged:', describeError(err));
    }
  }
  return { result: 'done', removed: Boolean(removed) };
}
