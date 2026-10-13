import { contentHash } from './hash';
import {
  WELCOME_TEMPLATE_KEY,
  type BrandGuidelines,
  type EmailFields,
  type EmailSettings,
  type EmailTemplate,
} from './types';

/**
 * First-run content of the welcome email, written in the AB Entertainment voice (premium, theatrical, reverent,
 * formal but warm; see DEFAULT_GUIDELINES_TEXT). The layout sets the heading's eyebrow and uppercases the
 * call-to-action label, so the label is written as a short Title Case phrase.
 */
export const SEED_WELCOME_FIELDS: EmailFields = {
  subject: 'Welcome to AB Entertainment',
  preheader: 'The curtain rises on Indian and Marathi performing arts in Melbourne. Thank you for joining us.',
  heading: 'Welcome to the AB Entertainment Family',
  body: [
    'Thank you for joining AB Entertainment. It is an honour to welcome you to an audience that treasures the performing arts of India and Maharashtra.',
    'Every performance we present is an offering: artists, families and friends gathered in celebration of music, dance, theatre and storytelling carried through generations. We are privileged to bring that heritage to the Melbourne stage, and we are grateful to share it with you.',
    'As a member of our community, you will receive:',
    [
      '- Early word of upcoming performances and festivals',
      '- Stories from the artists and teams who bring each production to life',
      '- Invitations to the celebrations that gather our community together',
    ].join('\n'),
    'We look forward to welcoming you in person. Until then, thank you for taking your place in our audience.',
  ].join('\n\n'),
  ctaLabel: 'Explore Upcoming Events',
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
 * They follow the AB Entertainment Design System's content fundamentals: premium, theatrical, reverent, formal
 * but warm; no emoji; Australian English; ALL CAPS calls to action; gold uppercase eyebrows; Title Case headings.
 */
export const DEFAULT_GUIDELINES_TEXT = `AB ENTERTAINMENT: CONTENT FUNDAMENTALS FOR EMAIL

Voice and tone
AB Entertainment speaks like a great theatre house: premium, theatrical, reverent and formal, yet warm. We treat the performing arts of India and Maharashtra as a heritage to be honoured, and our audience as guests of honour. Sentences are composed, unhurried and dignified. Warmth comes from sincerity and gratitude, never from slang, hype or over-familiarity. We address the reader as "you" and ourselves as "we" or "AB Entertainment".

Casing
- Section headings use Title Case (for example, Welcome to the AB Entertainment Family).
- Eyebrows, the small labels above a heading, are set in gold uppercase by the layout. Do not write them into the body.
- Calls to action are ALL CAPS. The layout applies this to the button, so write the label as a short Title Case phrase (for example, Explore Upcoming Events).
- Body text uses ordinary sentence case. Never write whole sentences in capitals.

Language
- Australian English (en-AU): colour, centre, organise, theatre, honour, favourite. Use "programme" only for a printed programme.
- Marathi, Hindi and other cultural terms are spelt correctly and, where a newcomer may need it, introduced with a few plain words of context.
- Full, formal sentences and short paragraphs, one idea each.
- State dates, times, venues and prices only when they are supplied in the content. Never invent details.

No emoji
- No emoji, emoticons or decorative symbols in any field. The layout supplies the brand's ornaments.

Call to action
- One clear action per email, described by what it does and led by a verb: Explore Upcoming Events, Meet the Artists, Visit Our Gallery. Never "Click here", "Learn more" or "Don't miss out".

What we never do
- No hype, clickbait or manufactured urgency ("last chance", "act now", "you won't believe").
- No excessive punctuation: at most one exclamation mark in a whole email, and none in the subject.
- No superlatives we cannot support, and no comparison with other organisations.
- No stereotypes, jokes at anyone's expense, or political or religious statements.
- No promises about availability, pricing, discounts or guests that are not in the supplied content.
- No placeholder text and no unfinished sentences.

An email should
- Have an honest, dignified subject line that says what the email is (aim for 30 to 60 characters).
- Have a preheader that continues the subject instead of repeating it.
- Be gracious to the reader's inbox: it says who we are and why they are hearing from us. Every message carries a one-click way to unsubscribe, supplied by the layout.

How the review scores
Score each dimension from 0 to 100. The pass mark is set by the administrators (85 by default); anything below it must be fixed before the email can be sent.
- content: accurate, useful, complete and honest, with a clear purpose.
- brand: feels like AB Entertainment, in the voice described above.
- tone: the right emotional register: reverent and formal, yet warm and sincere; never pushy, never flat.
- language: Australian English, correct spelling and grammar, composed sentences.
- quality: overall polish, structure and readability as a professional communication piece.`;

export function defaultGuidelines(): BrandGuidelines {
  return { text: DEFAULT_GUIDELINES_TEXT, version: 1, updatedAt: SEED_TIME, updatedBy: 'seed' };
}
