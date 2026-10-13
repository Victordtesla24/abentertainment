/**
 * The only way a template body becomes email markup: a small, safe formatting language.
 *
 *   - paragraphs are separated by a blank line; a single line break stays a line break
 *   - a block whose every line starts with "- " is a bullet list (leave a blank line before it)
 *   - **bold**, *italic* and [label](https://link) (https links only)
 *   - everything else is plain text; HTML is escaped, never passed through
 *
 * The layout calls formatBody with its own inline styles (email clients need inline styles), so the
 * brand look stays in the layout and the admin cannot introduce markup, colours or images.
 */

export interface BodyStyles {
  p?: string;
  ul?: string;
  li?: string;
  a?: string;
  strong?: string;
  em?: string;
}

export interface FormattedBody {
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function styleAttr(style: string | undefined): string {
  return style ? ` style="${escapeHtml(style)}"` : '';
}

const EMPHASIS_BOLD = /\*\*([^*\n]+)\*\*/g;
const EMPHASIS_ITALIC = /(^|[^*])\*([^*\n]+)\*(?!\*)/g;

function emphasisHtml(escaped: string, styles: BodyStyles): string {
  return escaped
    .replace(EMPHASIS_BOLD, (_m, inner: string) => `<strong${styleAttr(styles.strong)}>${inner}</strong>`)
    .replace(EMPHASIS_ITALIC, (_m, before: string, inner: string) => `${before}<em${styleAttr(styles.em)}>${inner}</em>`);
}

function emphasisText(raw: string): string {
  return raw.replace(EMPHASIS_BOLD, '$1').replace(EMPHASIS_ITALIC, '$1$2');
}

function inline(raw: string, styles: BodyStyles): FormattedBody {
  const link = /\[([^\]\n]{1,120})\]\((https:\/\/[^\s)]{1,300})\)/g;
  let html = '';
  let text = '';
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = link.exec(raw))) {
    const before = raw.slice(last, match.index);
    html += emphasisHtml(escapeHtml(before), styles);
    text += emphasisText(before);
    html += `<a href="${escapeHtml(match[2])}"${styleAttr(styles.a)}>${emphasisHtml(escapeHtml(match[1]), styles)}</a>`;
    text += `${emphasisText(match[1])} (${match[2]})`;
    last = match.index + match[0].length;
  }
  const rest = raw.slice(last);
  html += emphasisHtml(escapeHtml(rest), styles);
  text += emphasisText(rest);
  return { html, text };
}

export function formatBody(body: string, styles: BodyStyles = {}): FormattedBody {
  const blocks = body
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const html: string[] = [];
  const text: string[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim());
    if (lines.every((line) => line.startsWith('- '))) {
      const items = lines.map((line) => inline(line.slice(2).trim(), styles));
      html.push(`<ul${styleAttr(styles.ul)}>${items.map((item) => `<li${styleAttr(styles.li)}>${item.html}</li>`).join('')}</ul>`);
      text.push(items.map((item) => `- ${item.text}`).join('\n'));
    } else {
      const rendered = lines.map((line) => inline(line, styles));
      html.push(`<p${styleAttr(styles.p)}>${rendered.map((item) => item.html).join('<br>')}</p>`);
      text.push(rendered.map((item) => item.text).join('\n'));
    }
  }
  return { html: html.join(''), text: text.join('\n\n') };
}

/** Every link-like reference in a piece of text (inside [label](url) or bare), for the gate's link checks. */
export function findUrls(raw: string): string[] {
  const found = raw.match(/(?:https?:\/\/|mailto:|javascript:|data:|ftp:|file:|tel:)[^\s)<>"']*/gi) ?? [];
  return [...new Set(found.map((url) => url.replace(/[.,;:!?]+$/, '')))];
}

/** Things the body syntax does not allow at all (the gate reports each as a blocking issue). */
export function findBodyViolations(raw: string): string[] {
  const violations: string[] = [];
  if (/<\/?[a-zA-Z][^>]*>/.test(raw)) violations.push('html');
  if (/!\[[^\]]*\]\(/.test(raw)) violations.push('image');
  if (/\[[^\]\n]*\]\((?!https:\/\/)[^)]*\)/.test(raw)) violations.push('non_https_link');
  return violations;
}
