import { Metadata } from 'next';
import { SITE_CONFIG } from '@/config/site';

export const metadata: Metadata = {
  title: 'Privacy Policy | AB Entertainment',
  description: 'Privacy policy for AB Entertainment — how we collect, use, and protect your personal information.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-charcoal">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h1 className="text-4xl sm:text-5xl font-playfair font-bold text-gold mb-4">
          Privacy Policy
        </h1>
        <p className="text-bronze text-sm mb-12">
          Last updated: 28 March 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section className="border-l-4 border-gold pl-6">
            <h2 className="text-2xl font-playfair text-gold mb-4">1. Information We Collect</h2>
            <p className="text-cream leading-relaxed mb-3">
              When you interact with {SITE_CONFIG.name}, we may collect personal information including your name, email address, phone number, and event preferences. This information is collected when you submit a contact form, purchase tickets, subscribe to our newsletter, or engage with our AI concierge.
            </p>
            <p className="text-cream leading-relaxed">
              We also collect technical data such as browser type, device information, and usage patterns to improve your experience and ensure site security.
            </p>
          </section>

          <section className="border-l-4 border-gold pl-6">
            <h2 className="text-2xl font-playfair text-gold mb-4">2. How We Use Your Information</h2>
            <p className="text-cream leading-relaxed mb-3">
              We use collected information to process event bookings, respond to inquiries, send event updates and marketing communications (with your consent), improve our services, and maintain the security of our platform.
            </p>
            <p className="text-cream leading-relaxed">
              We do not sell, rent, or share your personal information with third parties except as necessary to provide our services (such as payment processing through Stripe) or as required by Australian law.
            </p>
          </section>

          <section className="border-l-4 border-gold pl-6">
            <h2 className="text-2xl font-playfair text-gold mb-4">3. Australian Privacy Principles</h2>
            <p className="text-cream leading-relaxed mb-3">
              {SITE_CONFIG.name} is an Australian business operating from Melbourne, Victoria. We are committed to complying with the Australian Privacy Principles (APPs) under the Privacy Act 1988 (Cth) and the Notifiable Data Breaches (NDB) scheme.
            </p>
            <p className="text-cream leading-relaxed">
              We collect personal information only for purposes directly related to our business activities and only where it is reasonably necessary. We take reasonable steps to ensure accuracy and protect information from misuse, loss, and unauthorised access.
            </p>
          </section>

          <section className="border-l-4 border-gold pl-6">
            <h2 className="text-2xl font-playfair text-gold mb-4">4. Data Storage and Security</h2>
            <p className="text-cream leading-relaxed">
              Your data is stored securely using industry-standard encryption and access controls. We use trusted service providers including Stripe (payments), Clerk (authentication), Upstash (rate limiting), and Resend (email). All data transmission is encrypted via TLS/HTTPS with HSTS preloading enforced.
            </p>
          </section>

          <section className="border-l-4 border-gold pl-6">
            <h2 className="text-2xl font-playfair text-gold mb-4">5. Your Rights</h2>
            <p className="text-cream leading-relaxed mb-3">
              Under Australian privacy law, you have the right to access, correct, and request deletion of your personal information. You may also opt out of marketing communications at any time.
            </p>
            <p className="text-cream leading-relaxed">
              To exercise these rights, please contact us at{' '}
              <a href={`mailto:${SITE_CONFIG.email}`} className="text-gold hover:underline">
                {SITE_CONFIG.email}
              </a>.
            </p>
          </section>

          <section className="border-l-4 border-gold pl-6">
            <h2 className="text-2xl font-playfair text-gold mb-4">6. Cookies and Tracking</h2>
            <p className="text-cream leading-relaxed">
              We use essential cookies for authentication and site functionality. We do not use third-party advertising trackers. Analytics data is collected in aggregate to improve the site experience. AI bot crawlers (GPTBot, ChatGPT-User, CCBot, Google-Extended) are explicitly blocked via our robots.txt policy.
            </p>
          </section>

          <section className="border-l-4 border-gold pl-6">
            <h2 className="text-2xl font-playfair text-gold mb-4">7. Contact Us</h2>
            <p className="text-cream leading-relaxed">
              If you have questions about this privacy policy or wish to make a privacy-related request, please contact:
            </p>
            <address className="not-italic text-cream mt-4 leading-relaxed">
              <strong className="text-gold">{SITE_CONFIG.name}</strong>
              <br />
              Email:{' '}
              <a href={`mailto:${SITE_CONFIG.email}`} className="text-gold hover:underline">
                {SITE_CONFIG.email}
              </a>
              <br />
              Phone:{' '}
              <a href={`tel:${SITE_CONFIG.phone}`} className="text-gold hover:underline">
                {SITE_CONFIG.phone}
              </a>
            </address>
          </section>
        </div>
      </div>
    </main>
  );
}
