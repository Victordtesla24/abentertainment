import { CONTENT_FUNDAMENTALS } from './design-system-content';
import { contentHash } from './hash';
import {
  WELCOME_TEMPLATE_KEY,
  type BrandGuidelines,
  type EmailFields,
  type EmailSettings,
  type EmailTemplate,
} from './types';

/**
 * First-run content of the welcome email, in the AB Entertainment voice (README, CONTENT FUNDAMENTALS): premium,
 * theatrical and reverent, formal but warm; the company in the third person, the audience in the second; Title Case
 * headings; no emoji; Australian English. The layout sets the eyebrow in gold uppercase and uppercases the
 * call-to-action label, so both are written as short Title Case phrases.
 */
export const SEED_WELCOME_FIELDS: EmailFields = {
  subject: 'Welcome to AB Entertainment',
  preheader: 'Thank you for joining. Indian and Marathi performing arts, presented with meticulous care.',
  eyebrow: 'Welcome to',
  heading: 'The AB Entertainment Community',
  body: [
    'Thank you for joining the AB Entertainment community. Your place in this audience is a privilege, and it is warmly welcomed.',
    'AB Entertainment presents the performing arts of India and Maharashtra to Melbourne with meticulous care: theatre, music, dance and storytelling that carry a living heritage to the stage. Each production is crafted so that you, and those who join you, may experience an evening like no other.',
    'As a member of the community, you will receive:',
    [
      '- Early word of upcoming productions and festivals',
      '- Stories from the artists and teams behind each performance',
      '- Invitations to the occasions that gather the audience together',
    ].join('\n'),
    'AB Entertainment looks forward to welcoming you in person. Until then, thank you for being part of the story.',
  ].join('\n\n'),
  ctaLabel: 'View All Events',
  ctaUrl: 'https://abentertainment.com.au/events/',
};

const SEED_TIME = '2026-10-13T00:00:00.000Z';

/** The welcome template exactly as it exists before an admin touches it (a fixed time keeps it stable). */
export function seedWelcomeTemplate(): EmailTemplate {
  return {
    id: 'tpl-newsletter-welcome',
    key: WELCOME_TEMPLATE_KEY,
    name: 'Welcome email',
    enabled: true,
    activeVersion: null,
    versions: [
      {
        version: 1,
        fields: { ...SEED_WELCOME_FIELDS },
        hash: contentHash(SEED_WELCOME_FIELDS),
        createdAt: SEED_TIME,
        createdBy: 'seed',
        note: 'Initial welcome copy',
      },
    ],
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  };
}

export const DEFAULT_SETTINGS: EmailSettings = {
  maxFixRounds: 3,
  qualityThreshold: 85,
  hourlyCap: 30,
  allowedLinkDomains: ['abentertainment.com.au', 'instagram.com', 'facebook.com'],
  reviewModel: '',
  updatedAt: SEED_TIME,
};

/**
 * The voice rules the AI reviewer judges every email against (administrators can edit them in the admin panel).
 * They open with the README's CONTENT FUNDAMENTALS of the AB Entertainment Design System, verbatim, followed by an
 * addendum on applying them to email and the scoring rubric.
 */
export const DEFAULT_GUIDELINES_TEXT = `${CONTENT_FUNDAMENTALS}

---

## APPLYING THE FUNDAMENTALS TO EMAIL

The email layout is supplied by code from the same design system, so write only the words. Each email has an eyebrow (the small label above the heading), a subject, a preheader, a heading, a body and one call to action.

- The company is AB Entertainment, in the third person ("AB Entertainment presents..."); the reader is "you" and "your". Do not use "we", "our" or "us" for the company.
- Subject: honest, dignified and specific, about 30 to 60 characters, with no emoji and no exclamation mark. It is not written in capitals.
- Preheader: continues the subject, never repeats it.
- Eyebrow: one to four words in Title Case, such as "Welcome to", "Celebrating" or "Discover". The layout sets it in gold uppercase with ultra-wide tracking.
- Heading: Title Case (ALL CAPS is kept for hero displays). One heading per email.
- Body: sentence case, composed paragraphs, formal but warm. Never shout. Marathi and Hindi names are used verbatim.
- Call to action: one action, a short Title Case label such as "View All Events" or "Contact Us" (the layout renders it in ALL CAPS). Never "Click here" or "Learn more".
- Never invent details: dates, venues, prices, guests and availability appear only when they are supplied.
- Never use hype, clickbait or manufactured urgency, and never more than one exclamation mark in a whole email.
- Every email carries a one-click way to unsubscribe and the sender's identity, supplied by the layout.

## HOW THE REVIEW SCORES

Score each dimension from 0 to 100. The pass mark is set by the administrators (85 by default); anything below it must be fixed before the email can be sent.

- content: accurate, useful, complete and honest, with a clear purpose.
- brand: feels like AB Entertainment, in the voice described above.
- tone: the right register: premium, theatrical and reverent, formal yet warm; never pushy, never flat, never casual.
- language: Australian English, correct spelling and grammar, composed sentences.
- quality: overall polish, structure and readability as a professional communication piece.`;

export function defaultGuidelines(): BrandGuidelines {
  return { text: DEFAULT_GUIDELINES_TEXT, version: 1, updatedAt: SEED_TIME, updatedBy: 'seed' };
}
