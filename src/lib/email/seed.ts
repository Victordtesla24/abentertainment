import { contentHash } from './hash';
import {
  WELCOME_TEMPLATE_KEY,
  type BrandGuidelines,
  type EmailFields,
  type EmailSettings,
  type EmailTemplate,
} from './types';

/** First-run content of the welcome email, written in the brand voice (see DEFAULT_GUIDELINES_TEXT). */
export const SEED_WELCOME_FIELDS: EmailFields = {
  subject: 'Welcome to AB Entertainment',
  preheader: 'Thank you for joining us. Here is what to expect from our stage, our stories and our community.',
  heading: 'Welcome to the AB Entertainment community',
  body: [
    'Thank you for joining the AB Entertainment community. We are delighted to welcome you.',
    'AB Entertainment brings the richness of Indian and Marathi performing arts to audiences across Melbourne, through music, theatre, dance and storytelling that celebrate our shared heritage.',
    'As a subscriber, you will hear from us about:',
    [
      '- Upcoming performances and festivals, with news of new events as they are announced',
      '- Stories from the artists and teams who bring each production to life',
      '- Ways to take part in our community, whether these art forms are new to you or have been loved for a lifetime',
    ].join('\n'),
    'We would love to see you at an event soon. Everyone is warmly welcome.',
  ].join('\n\n'),
  ctaLabel: 'See upcoming events',
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

export const DEFAULT_GUIDELINES_TEXT = `AB ENTERTAINMENT: BRAND VOICE AND EMAIL GUIDELINES

Who we are
AB Entertainment is a Melbourne company that brings Indian and Marathi performing arts to audiences across Victoria: music, theatre, dance and storytelling that celebrate shared heritage and bring communities together. Our audience includes families, long-time lovers of these art forms, newcomers who are curious, and Melbourne's wider multicultural community.

How we sound
1. Warm. We write the way a gracious host speaks: welcoming, personal and sincere. We thank people, and we mean it.
2. Celebratory. We take quiet pride in the artists, the heritage and the occasions. Joy comes from the subject, never from loud punctuation.
3. Culturally rich. We speak about the arts with knowledge and respect. Marathi, Hindi and other cultural terms are spelt correctly and used naturally, with context where a newcomer might need it.
4. Professional. Clear, accurate, well organised and polished. No slang, no filler, no carelessness.
5. Inclusive. Everyone is welcome: every background, age and level of familiarity. Never assume prior knowledge, religion, language or identity.

Language
- Australian English spelling and usage (colour, centre, organise, theatre, favourite).
- Short sentences and short paragraphs. Plain words. One idea per paragraph.
- Address the reader as "you". Refer to ourselves as "we" or "AB Entertainment".
- State dates, times and prices only when they are given in the content. Never invent details.
- At most one exclamation mark in a whole email, and none in a subject line.

What we never do
- No hype, clickbait or manufactured urgency ("don't miss out", "last chance", "act now", "you won't believe").
- No ALL CAPS, no excessive punctuation, no emoji in headings or subject lines.
- No superlatives we cannot support, and no comparison with other organisations.
- No stereotypes, jokes at anyone's expense, or political or religious statements.
- No promises about ticket availability, pricing, discounts or guests unless they are supplied in the content.
- No placeholder text and no unfinished sentences.

An email should
- Have a clear, honest subject line that says what the email is (aim for 30 to 60 characters).
- Have a preheader that adds to the subject instead of repeating it.
- Have one clear call to action, described by what it does ("See upcoming events"), never "Click here".
- Be easy to read on a phone in under a minute.
- Respect the reader's inbox: say who we are and why they are hearing from us. Every email carries a one-click way to unsubscribe, supplied by the layout.

How the review scores
Score each dimension from 0 to 100. The pass mark is set by the administrators (85 by default); anything below it must be fixed before the email can be sent.
- content: accurate, useful, complete and honest, with a clear purpose.
- brand: feels like AB Entertainment, in the voice described above.
- tone: the right emotional register: warm and sincere, never pushy, never flat.
- language: Australian English, correct spelling and grammar, clear sentences.
- quality: overall polish, structure and readability as a professional communication piece.
`.trim();

export function defaultGuidelines(): BrandGuidelines {
  return { text: DEFAULT_GUIDELINES_TEXT, version: 1, updatedAt: SEED_TIME, updatedBy: 'seed' };
}
