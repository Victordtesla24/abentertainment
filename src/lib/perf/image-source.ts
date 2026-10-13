/**
 * Hosts that serve an HTML page, not an image file, at the links admins tend to paste.
 *
 * A Google Photos "photo" or "share" link opens the Photos viewer; used as an <img>
 * source the browser blocks it (ERR_BLOCKED_BY_ORB) and the request also drags in a
 * third-party cookie, which is what drops Lighthouse Best Practices on /events and
 * /gallery. The picture CDN for those photos is lh3.googleusercontent.com.
 */
const PAGE_LINK_HOSTS = /^https?:\/\/(?:photos\.google\.com|photos\.app\.goo\.gl)\//i;

/** True when `url` can be requested as an image; false for empty values and known page links. */
export function isUsableImageUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.trim() !== '' && !PAGE_LINK_HOSTS.test(url.trim());
}

/** First usable image URL among the candidates, if any. */
export function firstUsableImageUrl(...candidates: (string | null | undefined)[]): string | undefined {
  return candidates.find(isUsableImageUrl);
}
