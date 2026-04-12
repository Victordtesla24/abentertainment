import { Metadata } from 'next';
import { SITE_CONFIG } from '@/lib/constants';
import PageHero from '@/components/ui/PageHero';
import ContactForm from '@/components/ui/ContactForm';
import ContactDetails from '@/components/ContactDetails';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with AB Entertainment — event inquiries, sponsorship opportunities, and booking requests for premium Indian cultural events in Melbourne.',
  alternates: {
    canonical: 'https://abentertainment.com.au/contact/',
  },
  openGraph: {
    title: 'Contact | AB Entertainment',
    description:
      'Get in touch with AB Entertainment — event inquiries, sponsorship opportunities, and booking requests for premium Indian cultural events in Melbourne.',
    url: 'https://abentertainment.com.au/contact/',
  },
};

export default function ContactPage() {
  return (
    <main className="bg-[#0A0A0A] min-h-screen-dynamic">
      <PageHero
        image="/images/heroes/contact-hero.png"
        badge="Contact"
        title="Get in"
        highlight="Touch"
        subtitle="Whether you're interested in attending an event, exploring sponsorship opportunities, or simply want to connect"
      />

      {/* Intro text — server-rendered for SEO */}
      <section className="py-16 md:py-20">
        <div className="container-eu">
          <p className="text-white/40 text-lg font-body max-w-2xl mb-8">
            We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Form + Sidebar */}
      <section className="pb-24">
        <div className="container-eu">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            {/* Client-side contact form */}
            <ContactForm />

            {/* Contact Info Sidebar — server-rendered for SEO */}
            <aside className="lg:col-span-2 space-y-8">
              <ContactDetails />

              <div className="bg-[#111111]/40 border border-[#C9A84C]/40 p-8">
                <h3 className="text-xl font-display text-[#C9A84C] mb-4">
                  Office Hours
                </h3>
                <div className="space-y-2 text-sm font-body">
                  <div className="flex justify-between">
                    <span className="text-white/40">Monday - Friday</span>
                    <span className="text-white">9:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Saturday</span>
                    <span className="text-white">10:00 AM - 4:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Sunday</span>
                    <span className="text-white">Closed</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#111111]/40 border border-[#C9A84C]/40 p-8">
                <h3 className="text-xl font-display text-[#C9A84C] mb-4">
                  Follow Us
                </h3>
                <div className="flex gap-3">
                  <a
                    href={SITE_CONFIG.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 flex items-center justify-center border border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C] hover:text-white transition-all duration-300"
                    aria-label="Instagram"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </a>
                  <a
                    href={SITE_CONFIG.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 flex items-center justify-center border border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C] hover:text-white transition-all duration-300"
                    aria-label="Facebook"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
