/**
 * Shared types and limits for the newsletter email capability (templates, quality gate, sending).
 * No server-only imports here: the admin screens import these too.
 */

export const EMAIL_FIELDS = ['subject', 'preheader', 'eyebrow', 'heading', 'body', 'ctaLabel', 'ctaUrl'] as const;
export type EmailFieldName = (typeof EMAIL_FIELDS)[number];
/** What an admin writes. The brand layout (code, not an admin) turns it into the final message. */
export type EmailFields = Record<EmailFieldName, string>;

/** Fields an admin may leave empty (the eyebrow is the small gold label above the heading). */
export const OPTIONAL_FIELDS: readonly EmailFieldName[] = ['eyebrow'];

/**
 * Hard bounds enforced when a template is SAVED: an abuse and header-injection guard, not editorial rules.
 * The quality gate has the tighter, editorial limits (src/lib/email/gate-rules.ts).
 */
export const FIELD_SAVE_LIMITS: Record<EmailFieldName, number> = {
  subject: 300,
  preheader: 500,
  eyebrow: 100,
  heading: 300,
  body: 20000,
  ctaLabel: 100,
  ctaUrl: 2000,
};

/** The fields an admin edits on one line (a newline in a subject is a header-injection vector). */
export const SINGLE_LINE_FIELDS: readonly EmailFieldName[] = ['subject', 'preheader', 'eyebrow', 'heading', 'ctaLabel', 'ctaUrl'];

export const WELCOME_TEMPLATE_KEY = 'newsletter_welcome';

// ─── Quality gate ────────────────────────────────────────────────────────────

export type GateField = 'subject' | 'preheader' | 'eyebrow' | 'heading' | 'body' | 'cta' | 'layout' | 'global';

export interface GateIssue {
  source: 'deterministic' | 'ai';
  /** Stable machine code, for example "subject_too_long" or "ai_tone". */
  code: string;
  field: GateField;
  message: string;
  /** How to fix it (a deterministic hint, or the reviewer's suggestion). */
  suggestion?: string;
  /** Whether the AI fix step may change the content to resolve it (false: layout, configuration, global). */
  fixable: boolean;
  /** How serious it is. Deterministic issues are always blockers; the AI reviewer also reports advisory minor ones. */
  severity?: 'blocker' | 'major' | 'minor';
}

export const AI_DIMENSIONS = ['content', 'brand', 'tone', 'language', 'quality'] as const;
export type AiDimension = (typeof AI_DIMENSIONS)[number];
export type AiScores = Record<AiDimension, number>;

/**
 * How one call to an AI model ended. credit_exhausted: the account has no credit or quota left; invalid_key: the key was
 * rejected; forbidden: the key may not use this; unknown_model: the provider has no such model; rate_limited and
 * overloaded: try again later; server_error, timeout and network: the provider could not answer; bad_shape: it answered
 * in a form that is not the expected JSON; bad_request: it refused the request itself.
 */
export type AiAttemptOutcome = 'ok' | 'credit_exhausted' | 'invalid_key' | 'forbidden' | 'unknown_model' | 'rate_limited' | 'overloaded' | 'server_error' | 'timeout' | 'network' | 'bad_shape' | 'bad_request';

/** One call to one AI model, in the order they were made. Never holds a key or an address. */
export interface AiAttemptRecord {
  provider: 'anthropic' | 'openai' | 'openrouter';
  model: string;
  /** 1 for the first call to this model, 2 for the retry. */
  attempt: number;
  outcome: AiAttemptOutcome;
  httpStatus?: number;
  /** The provider's own error type or code, for example invalid_request_error. */
  code?: string;
  /** The provider's message with keys and addresses removed. */
  detail?: string;
  ms: number;
  at: string;
}

export interface AiReview {
  provider: string;
  model: string;
  scores: AiScores;
  verdict: 'pass' | 'fail';
  summary: string;
  issues: GateIssue[];
  ms: number;
  /**
   * Every call that was made to produce this review, in order: why an earlier model was skipped. The reviewer returns it
   * with the review; the gate keeps it once, on the round (GateRound.aiAttempts), not on the review.
   */
  attempts?: AiAttemptRecord[];
}

export interface GateRound {
  /** 1 is the version as it was saved; each later round is the content after an AI fix. */
  round: number;
  fieldsHash: string;
  /** The exact fields reviewed in this round. */
  fields: EmailFields;
  deterministic: GateIssue[];
  ai: AiReview | null;
  /** Why there is no AI review for this round ("unavailable", "invalid_response", "skipped"). */
  aiError?: string;
  /** What went wrong with the AI reviewer, in words that name no key or address. */
  aiErrorDetail?: string;
  /** Every call made for this round's review (or the failed ones when no model could answer), in order. */
  aiAttempts?: AiAttemptRecord[];
  /** Every call made for the fix that followed. */
  fixAttempts?: AiAttemptRecord[];
  passed: boolean;
  /** The fields the AI changed to produce the next round, and why. */
  fixedFields?: string[];
  fixRationale?: string;
  fixError?: string;
}

export type GateStopReason =
  | 'passed'
  | 'max_rounds'
  | 'ai_unavailable'
  | 'unfixable'
  | 'no_progress'
  | 'layout_not_installed';

export interface GateResult {
  passed: boolean;
  stopReason: GateStopReason;
  rounds: GateRound[];
  /** The content that passed (or, when blocked, the last candidate). */
  finalFields: EmailFields;
  finalHash: string;
  startedAt: string;
  finishedAt: string;
  maxRounds: number;
  threshold: number;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface TemplateApproval {
  at: string;
  /** Hash of the content AND the layout AND the brand guidelines the review passed against. */
  bindingHash: string;
  layoutId: string;
  layoutVersion: string;
  guidelinesVersion: number;
  scores: AiScores;
  provider: string;
  model: string;
  rounds: number;
}

export interface TemplateReviewRecord {
  at: string;
  passed: boolean;
  stopReason: GateStopReason;
  rounds: GateRound[];
  /** When the loop fixed the content, the version that holds the fixed content. */
  resultVersion?: number;
}

export interface TemplateVersion {
  version: number;
  fields: EmailFields;
  /** Hash of the fields alone. */
  hash: string;
  createdAt: string;
  createdBy: 'seed' | 'admin' | 'ai-fix';
  parentVersion?: number;
  note?: string;
  review?: TemplateReviewRecord;
  approval?: TemplateApproval;
}

export interface EmailTemplate {
  id: string;
  /** Unique slug, for example newsletter_welcome. */
  key: string;
  name: string;
  /** A disabled template sends nothing (the welcome email can be switched off here). */
  enabled: boolean;
  /** The approved version used for sending. */
  activeVersion: number | null;
  versions: TemplateVersion[];
  createdAt: string;
  updatedAt: string;
}

// ─── Settings and guidelines ─────────────────────────────────────────────────

export interface EmailSettings {
  /** Fix-and-review rounds the gate may run before it gives up (1 to 6). */
  maxFixRounds: number;
  /** Every AI score must reach this (0 to 100). */
  qualityThreshold: number;
  /** Most emails the site sends in any rolling hour (welcome, test and queued sends together). */
  hourlyCap: number;
  /** Hosts a link may point to (an exact host, or a parent domain that allows its subdomains). */
  allowedLinkDomains: string[];
  /** Model for the AI review; empty uses the default of whichever provider is configured. */
  reviewModel: string;
  updatedAt: string;
}

export interface BrandGuidelines {
  text: string;
  /** Increases on every edit; a template approval is bound to it. */
  version: number;
  updatedAt: string;
  updatedBy: string;
}

// ─── Layout contract ─────────────────────────────────────────────────────────

/** Parts filled in per message by code, never by an admin; the layout puts them in fixed slots. */
export interface RenderContext {
  /** One-click unsubscribe link for this recipient (signed token). */
  unsubscribeUrl: string;
  /** Absolute https URL of the logo image. */
  logoUrl: string;
  /** The public site, for example https://abentertainment.com.au */
  siteUrl: string;
  year: number;
  /** The social profiles the footer links to (the design system's footer pattern). */
  social: { instagram: string; facebook: string };
  /** Sender identity for the footer (the Spam Act requires it). */
  sender: {
    name: string;
    city: string;
    state: string;
    country: string;
    contactEmail: string;
    contactPhone: string;
    website: string;
  };
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export interface EmailLayout {
  /** Stable id of the layout, for example "ab-entertainment". */
  id: string;
  /** Version of the layout; an approval is bound to it. */
  version: string;
  /** False until the real brand layout is installed: the gate blocks every send. */
  installed: boolean;
  render(fields: EmailFields, ctx: RenderContext): RenderedEmail;
}
