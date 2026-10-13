import { createHash } from 'crypto';
import { EMAIL_FIELDS, type EmailFields } from './types';

/**
 * Bumped whenever the deterministic rules or the review rubric change, so older approvals stop applying.
 * 2: the footer's own links (the site and its social profiles) are the layout's, not editable content, so they are exempt
 * from the allowed-domain check.
 */
export const GATE_RULES_VERSION = 2;

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Hash of the content alone: field names in a fixed order, so the same words always give the same hash. */
export function contentHash(fields: EmailFields): string {
  return sha256(JSON.stringify(EMAIL_FIELDS.map((name) => [name, fields[name] ?? ''])));
}

/**
 * What an approval is bound to: the exact content, the layout it is rendered in, the brand guidelines it was
 * judged against and the rule set. Change any of them and the approval no longer matches.
 */
export function bindingHash(input: {
  fields: EmailFields;
  layoutId: string;
  layoutVersion: string;
  guidelinesVersion: number;
  guidelinesText: string;
}): string {
  return sha256(
    JSON.stringify({
      content: contentHash(input.fields),
      layout: `${input.layoutId}@${input.layoutVersion}`,
      guidelines: `${input.guidelinesVersion}:${sha256(input.guidelinesText)}`,
      rules: GATE_RULES_VERSION,
    }),
  );
}
