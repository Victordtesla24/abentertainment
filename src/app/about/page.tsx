import { Metadata } from 'next';
import { ABOUT_CONTENT, SITE_CONFIG, FOUR_PILLARS } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about AB Entertainment, Melbourne\'s premier Indian & Marathi cultural events company.',
};

export default function AboutPage() {
  return (
    <main className="bg-[#062434]">
      {/* Hero banner */}
      <section className="relative py-24 md:py-32">
        <div className="container-eu text-center">
          <span className="inline-block px-4 py-2 bg-[#CC8A1C] text-white text-xs font-semibold font-body uppercase tracking-[0.2em] mb-6">
            About Us
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6">
            {ABOUT_CONTENT.title}
          </h1>
          <p className="text-[#7E7180] font-body text-lg max-w-2xl mx-auto leading-relaxed">
            {ABOUT_CONTENT.tagline}
          </p>
        </div>
      </section>

      {/* Description */}
      <section className="py-16">
        <div className="container-eu max-w-3xl">
          <p className="text-[#FDF8F1] font-body text-lg leading-relaxed text-center">
            {ABOUT_CONTENT.description}
          </p>
        </div>
      </section>

      {/* Story sections */}
      <section className="py-16">
        <div className="container-eu">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {ABOUT_CONTENT.sections.map((section, idx) => (
              <div
                key={idx}
                className="bg-[#0a3a52]/40 border border-[#CC8A1C]/10 p-8"
              >
                <h2 className="text-2xl font-display font-bold text-[#CC8A1C] mb-4">
                  {section.heading}
                </h2>
                <div className="space-y-4">
                  {section.body.map((paragraph, i) => (
                    <p
                      key={i}
                      className="text-[#FDF8F1]/80 font-body text-base leading-relaxed"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Four Pillars */}
      <section className="py-16 border-t border-[#CC8A1C]/10">
        <div className="container-eu">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white text-center mb-12">
            Our Four <span className="text-[#CC8A1C]">Pillars</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FOUR_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="bg-[#0a3a52]/40 border border-[#CC8A1C]/10 p-6 text-center"
              >
                <h3 className="text-lg font-display font-bold text-[#CC8A1C] mb-2">
                  {pillar.title}
                </h3>
                <p className="text-[#7E7180] font-body text-sm leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 border-t border-[#CC8A1C]/10">
        <div className="container-eu">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-lg mx-auto">
            <div>
              <p className="text-xs text-[#7E7180] uppercase tracking-wider font-body mb-1">
                Phone
              </p>
              <a
                href={`tel:${SITE_CONFIG.contact.phone}`}
                className="text-[#FDF8F1] hover:text-[#CC8A1C] transition-colors font-body"
              >
                {SITE_CONFIG.contact.phone}
              </a>
            </div>
            <div>
              <p className="text-xs text-[#7E7180] uppercase tracking-wider font-body mb-1">
                Email
              </p>
              <a
                href={`mailto:${SITE_CONFIG.contact.email}`}
                className="text-[#FDF8F1] hover:text-[#CC8A1C] transition-colors font-body"
              >
                {SITE_CONFIG.contact.email}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
