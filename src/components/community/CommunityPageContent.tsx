'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { SITE_CONFIG, telHref } from '@/lib/constants';
import PageHero from '@/components/ui/PageHero';
import TestimonialsSection from '@/components/TestimonialsSection';
import ContactDetails from '@/components/ContactDetails';
import CTASection from '@/components/CTASection';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: 'blur(4px)' },
  visible: (delay = 0) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.85, delay, ease: EASE },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 35 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

// ─── Community Pillars ────────────────────────────────────────────────────────

type PillarIconName = 'gathering' | 'heritage' | 'applause' | 'connection';

interface CommunityPillar {
  title: string;
  description: string;
  icon: PillarIconName;
}

const COMMUNITY_PILLARS: CommunityPillar[] = [
  {
    title: 'Meet at the Shows',
    description:
      'Every production doubles as a meeting place — foyer conversations, interval chai, and after-show catch-ups where new friendships begin.',
    icon: 'gathering',
  },
  {
    title: 'Pass It Forward',
    description:
      'Bring the next generation along and let them experience Marathi language, music, and theatre live — heritage is best handed down in person.',
    icon: 'heritage',
  },
  {
    title: 'Champion the Artists',
    description:
      'Be the front-row support for homegrown and touring performers who keep Indian performing arts thriving on Melbourne stages.',
    icon: 'applause',
  },
  {
    title: 'Network & Grow',
    description:
      'From business meets to family celebrations, the connections made around our events last well beyond the final bow.',
    icon: 'connection',
  },
];

function PillarIcon({ name }: { name: PillarIconName }) {
  switch (name) {
    case 'gathering':
      return (
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
        </svg>
      );
    case 'heritage':
      return (
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      );
    case 'applause':
      return (
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
        </svg>
      );
    case 'connection':
      return (
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.902 4.098a3.75 3.75 0 00-5.304 0l-4.5 4.5a3.75 3.75 0 001.035 6.037.75.75 0 00.646-1.353 2.25 2.25 0 01-.621-3.622l4.5-4.5a2.25 2.25 0 013.182 3.182l-1.62 1.62a.75.75 0 101.06 1.06l1.622-1.62a3.75 3.75 0 000-5.304zM8.867 9.365a.75.75 0 00-.646 1.353 2.25 2.25 0 01.621 3.622l-4.5 4.5a2.25 2.25 0 01-3.182-3.182l1.62-1.62a.75.75 0 00-1.06-1.06l-1.622 1.62a3.75 3.75 0 105.304 5.304l4.5-4.5a3.75 3.75 0 00-1.035-6.037z" transform="translate(2.5 0)" />
        </svg>
      );
  }
}

// ─── Connect Channels ─────────────────────────────────────────────────────────

type ChannelIconName = 'instagram' | 'facebook' | 'mail' | 'phone';

interface ConnectChannel {
  label: string;
  description: string;
  href: string;
  external: boolean;
  icon: ChannelIconName;
  ariaLabel: string;
}

const CONNECT_CHANNELS: ConnectChannel[] = [
  {
    label: 'Instagram',
    description: 'Follow along for rehearsal glimpses, event announcements, and behind-the-scenes moments from the AB Entertainment family.',
    href: SITE_CONFIG.social.instagram,
    external: true,
    icon: 'instagram',
    ariaLabel: 'Follow AB Entertainment on Instagram (opens in a new tab)',
  },
  {
    label: 'Facebook',
    description: 'Join the conversation, see who else is attending, and connect with fellow patrons between shows.',
    href: SITE_CONFIG.social.facebook,
    external: true,
    icon: 'facebook',
    ariaLabel: 'Follow AB Entertainment on Facebook (opens in a new tab)',
  },
  {
    label: 'Email Us',
    description: 'Send a question, feedback, or an idea for a future collaboration — we read every message.',
    href: `mailto:${SITE_CONFIG.contact.email}`,
    external: false,
    icon: 'mail',
    ariaLabel: `Email AB Entertainment at ${SITE_CONFIG.contact.email}`,
  },
  {
    label: 'Call Us',
    description: 'Prefer to talk it through? Give us a call during office hours and we will be glad to help.',
    href: telHref(SITE_CONFIG.contact.phone),
    external: false,
    icon: 'phone',
    ariaLabel: `Call AB Entertainment at ${SITE_CONFIG.contact.phone}`,
  },
];

function ChannelIcon({ name }: { name: ChannelIconName }) {
  switch (name) {
    case 'instagram':
      return (
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'mail':
      return (
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
          <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
        </svg>
      );
    case 'phone':
      return (
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
        </svg>
      );
  }
}

// ─── Ornamental Divider ───────────────────────────────────────────────────────

function GoldDivider() {
  return (
    <div className="flex items-center justify-center gap-3 my-2">
      <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
      <div className="w-2 h-2 rotate-45 border border-[#C9A84C]/50" />
      <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
    </div>
  );
}

// ─── Section Reveal Wrapper ───────────────────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      custom={delay}
      variants={fadeUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommunityPageContent() {
  return (
    <div className="bg-[#0A0A0A]">

      {/* ── 1. Hero ─────────────────────────────────────────────────────────── */}
      <PageHero
        image="/images/heroes/community-hero.png"
        badge="Community"
        title="Join Our"
        highlight="Community"
        subtitle="Connecting Melbourne's Indian & Marathi cultural family — on stage, and off"
      />

      {/* ── 2. Intro ────────────────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C9A84C 0.5px, transparent 0)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.04),transparent_60%)] pointer-events-none" />
        <div className="container-eu relative z-10 max-w-4xl">
          <Reveal className="text-center">
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block">
              Belong With Us
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              More Than <span className="gold-shimmer">An Audience</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <GoldDivider />
          </Reveal>
          <Reveal delay={0.2} className="mt-8 space-y-5">
            <p className="text-white/55 font-body text-lg leading-relaxed text-center">
              Every AB Entertainment production is built around a simple idea — culture is best experienced together. From the first ripple of applause in a packed theatre to the quiet conversations that continue long after the final bow, our events exist to bring Melbourne&apos;s Indian and Marathi community closer, to each other and to the traditions that shape who we are.
            </p>
            <p className="text-white/55 font-body text-lg leading-relaxed text-center">
              Whether you&apos;ve followed us since our earliest productions or just discovered AB Entertainment through a friend, you&apos;re part of a growing circle of artists, families, volunteers, and cultural enthusiasts who show up for one another as readily as they show up for the stage.
            </p>
            <p className="text-white/55 font-body text-lg leading-relaxed text-center">
              Staying connected is simple. Follow along for behind-the-scenes moments, reach out with a question or an idea, or join us in person at our next production — however you choose to connect, there is a place for you in the AB Entertainment family.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 3. Connect & Socialise ─────────────────────────────────────────── */}
      <section className="relative py-20 md:py-28 border-t border-[#C9A84C]/8 bg-[#0D0D0D] overflow-hidden">
        <div className="section-divider-top" />
        <div className="film-grain" />
        <div className="container-eu relative z-10">
          <Reveal className="text-center mb-16">
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block">
              Stay In Touch
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              Connect &amp; <span className="gold-shimmer">Socialise</span>
            </h2>
            <GoldDivider />
          </Reveal>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-7"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
          >
            {CONNECT_CHANNELS.map((channel) => (
              <motion.div key={channel.label} variants={staggerItem}>
                <a
                  href={channel.href}
                  {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  aria-label={channel.ariaLabel}
                  className="glass-card hover-shine group block h-full p-8"
                >
                  <div className="relative text-[#C9A84C]/60 mb-6 group-hover:text-[#C9A84C] transition-all duration-500 w-fit">
                    <div className="absolute -inset-2 bg-[#C9A84C]/[0.04] rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative">
                      <ChannelIcon name={channel.icon} />
                    </div>
                  </div>
                  <div className="w-8 h-[1px] bg-[#C9A84C]/25 mb-5 group-hover:w-14 group-hover:bg-[#C9A84C]/50 transition-all duration-700" />
                  <h3 className="text-lg font-display font-bold text-white mb-3 group-hover:text-[#C9A84C] transition-colors duration-500">
                    {channel.label}
                  </h3>
                  <p className="text-white/50 font-body text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-500">
                    {channel.description}
                  </p>
                </a>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 4. Community Pillars ───────────────────────────────────────────── */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="section-divider-top" />
        <div className="container-eu relative z-10">
          <Reveal className="text-center mb-16">
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block">
              Why Belong
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              The Heart of <span className="gold-shimmer">Our Community</span>
            </h2>
            <GoldDivider />
          </Reveal>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-7"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
          >
            {COMMUNITY_PILLARS.map((pillar, index) => (
              <motion.div key={pillar.title} variants={staggerItem}>
                <div className="glass-card hover-shine group h-full p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="relative text-[#C9A84C]/60 group-hover:text-[#C9A84C] transition-all duration-500 w-fit">
                      <div className="absolute -inset-2 bg-[#C9A84C]/[0.04] rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="relative">
                        <PillarIcon name={pillar.icon} />
                      </div>
                    </div>
                    <span className="text-[#C9A84C]/25 font-display text-2xl font-bold group-hover:text-[#C9A84C]/50 transition-colors duration-500">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="w-8 h-[1px] bg-[#C9A84C]/25 mb-5 group-hover:w-14 group-hover:bg-[#C9A84C]/50 transition-all duration-700" />
                  <h3 className="text-lg font-display font-bold text-white mb-3 group-hover:text-[#C9A84C] transition-colors duration-500">
                    {pillar.title}
                  </h3>
                  <p className="text-white/50 font-body text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-500">
                    {pillar.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 5. Community Voices ────────────────────────────────────────────── */}
      <TestimonialsSection />

      {/* ── 6. Contacts Block ──────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 border-t border-[#C9A84C]/8 overflow-hidden">
        <div className="section-divider-top" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.04)_0%,transparent_60%)]" />
        <div className="container-eu relative z-10">
          <Reveal className="text-center mb-16">
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block">
              Reach Out
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              Let&apos;s Stay <span className="gold-shimmer">Connected</span>
            </h2>
            <GoldDivider />
            <p className="text-white/50 font-body text-base max-w-2xl mx-auto mt-6 leading-relaxed">
              Have a question, a story idea, or want to get involved? Our team is always glad to hear from members of the community.
            </p>
          </Reveal>

          <div className="max-w-md mx-auto">
            <Reveal delay={0.1}>
              <ContactDetails />
            </Reveal>
            <Reveal delay={0.2} className="text-center mt-8">
              <Link href="/contact" className="btn-accent inline-block px-10 py-4 text-sm">
                Send Us a Message
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 7. Closing CTA ──────────────────────────────────────────────────── */}
      <CTASection />

    </div>
  );
}
