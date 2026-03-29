import { Metadata } from 'next';
import { ABOUT_CONTENT, SITE_CONFIG, FOUR_PILLARS, TEAM_MEMBERS } from '@/lib/constants';
import PageHero from '@/components/ui/PageHero';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about AB Entertainment, Melbourne\'s premier Indian & Marathi cultural events company.',
};

export default function AboutPage() {
  return (
    <main className="bg-[#0A0A0A]">
      <PageHero
        image="/images/heroes/about-hero.png"
        badge="About Us"
        title="About"
        highlight="AB Entertainment"
        subtitle="Where every detail is meticulously crafted to create unforgettable experiences"
      />

      {/* Legacy content below hero - keeping existing sections */}
      <section className="relative py-20 md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.05)_0%,transparent_60%)]" />
        <div className="container-eu relative z-10">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6">
            {ABOUT_CONTENT.title}
          </h2>
          <p className="text-white/40 font-body text-lg max-w-2xl mx-auto leading-relaxed">
            {ABOUT_CONTENT.tagline}
          </p>
        </div>
      </section>

      {/* Description */}
      <section className="py-16">
        <div className="container-eu max-w-3xl">
          <p className="text-white/60 font-body text-lg leading-relaxed text-center">
            {ABOUT_CONTENT.description}
          </p>
        </div>
      </section>

      {/* Team Section — Abhijit & Vrushali */}
      <section className="py-16 border-t border-[#C9A84C]/10">
        <div className="container-eu">
          <div className="text-center mb-14">
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.25em] font-body font-semibold mb-3 block">
              Leadership
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Meet Our <span className="text-[#C9A84C]">Team</span>
            </h2>
            <p className="text-white/40 font-body text-base max-w-xl mx-auto">
              {ABOUT_CONTENT.team}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mx-auto">
            {TEAM_MEMBERS.map((member) => (
              <div
                key={member.name}
                className="bg-white/[0.02] border border-[#C9A84C]/10 overflow-hidden group hover:border-[#C9A84C]/25 transition-all duration-500"
              >
                <div className="relative h-80 overflow-hidden bg-[#111]">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-80" />
                </div>
                <div className="p-7">
                  <h3 className="text-xl font-display font-bold text-white mb-1">
                    {member.name}
                  </h3>
                  <p className="text-[#C9A84C] text-sm font-body font-medium uppercase tracking-wider mb-4">
                    {member.role}
                  </p>
                  <p className="text-white/40 font-body text-sm leading-relaxed">
                    {member.bio}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story sections */}
      <section className="py-16 border-t border-[#C9A84C]/10">
        <div className="container-eu">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {ABOUT_CONTENT.sections.map((section, idx) => (
              <div
                key={idx}
                className="bg-white/[0.02] border border-[#C9A84C]/8 p-8 hover:border-[#C9A84C]/20 transition-all duration-500"
              >
                <h2 className="text-2xl font-display font-bold text-[#C9A84C] mb-4">
                  {section.heading}
                </h2>
                <div className="space-y-4">
                  {section.body.map((paragraph, i) => (
                    <p
                      key={i}
                      className="text-white/50 font-body text-base leading-relaxed"
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
      <section className="py-16 border-t border-[#C9A84C]/10">
        <div className="container-eu">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white text-center mb-12">
            Our Four <span className="text-[#C9A84C]">Pillars</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FOUR_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="bg-white/[0.02] border border-[#C9A84C]/8 p-6 text-center hover:border-[#C9A84C]/20 transition-all duration-500"
              >
                <h3 className="text-lg font-display font-bold text-[#C9A84C] mb-2">
                  {pillar.title}
                </h3>
                <p className="text-white/40 font-body text-sm leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 border-t border-[#C9A84C]/10">
        <div className="container-eu">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-lg mx-auto">
            <div>
              <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] font-body mb-1">
                Phone
              </p>
              <a
                href={`tel:${SITE_CONFIG.contact.phone}`}
                className="text-white/70 hover:text-[#C9A84C] transition-colors font-body"
              >
                {SITE_CONFIG.contact.phone}
              </a>
            </div>
            <div>
              <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] font-body mb-1">
                Email
              </p>
              <a
                href={`mailto:${SITE_CONFIG.contact.email}`}
                className="text-white/70 hover:text-[#C9A84C] transition-colors font-body"
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
