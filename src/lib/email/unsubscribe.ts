/**
 * Unsubscribing: what the link in every email does.
 *
 * The recipient follows the link (GET) or their mail app posts to it (RFC 8058 one-click, POST); either way the
 * signed token names the subscriber and the subscriber is REMOVED from the list: no row, no address kept, nothing
 * further sent (a queued welcome finds no subscriber). It is idempotent and never says whether the address was on the
 * list (the same answer for a first click, a second click and an address an admin had already deleted), and a token
 * that does not verify changes nothing. The reserved "test" token (admin test emails) is accepted and changes nothing.
 * A masked record of each removal goes to the send log so an admin can see that it happened.
 */

import { deleteNewsletterSubscriber } from '@/lib/data';
import { describeError, maskEmail } from '@/lib/newsletter';
import { appendSendLog } from './send-log';
import { TEST_SUBSCRIBER_ID, verifyUnsubscribeToken } from './unsubscribe-token';
import { WELCOME_TEMPLATE_KEY } from './types';

export type UnsubscribeVia = 'link' | 'one_click';

export type UnsubscribeResult =
  /** The address is no longer on the list (it may not have been: the answer is the same). */
  | { result: 'done'; removed: boolean }
  /** The token is not one this server issued (damaged, copied in part, tampered with). Nothing changed. */
  | { result: 'invalid' }
  /** The server cannot check tokens (no signing secret) or the list could not be read: try again later. */
  | { result: 'unavailable' };

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
