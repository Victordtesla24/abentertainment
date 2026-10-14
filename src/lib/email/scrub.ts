/**
 * A message from a provider that is safe to keep in a log, a record or a screen: any API key the server holds (exact),
 * anything shaped like a key (sk-..., re_...), an organisation or project id (org-..., proj_...), every email address and
 * every long token removed, whitespace collapsed, shortened. Used for what Resend and the AI reviewers say about a failure.
 */
export function scrubDetail(value: unknown, secrets: readonly string[] = []): string {
  if (typeof value !== 'string') return '';
  let text = value;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) text = text.split(secret).join('[key]');
  }
  return text
    .replace(/\b(?:sk|re|pk|rk)[-_](?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{6,}\b/g, '[key]')
    .replace(/\b(?:org|proj)[-_][A-Za-z0-9]{8,}\b/g, '[account]')
    .replace(/[^\s<>"']+@[^\s<>"']+/g, '[address]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
    .trimEnd();
}
