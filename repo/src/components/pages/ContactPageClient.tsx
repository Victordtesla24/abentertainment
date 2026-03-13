"use client";

import { motion } from "framer-motion";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageHero } from "@/components/layout/PageHero";
import { ANIMATION } from "@/lib/constants";
import type { ContactChannel, SitePage } from "@/types";

export function ContactPageClient({
  page,
  channels,
}: {
  page: SitePage;
  channels: ContactChannel[];
}) {
  return (
    <section className="min-h-screen">
      <PageHero
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
      />

      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 lg:grid-cols-[0.76fr_1.24fr] lg:px-8">
        <motion.aside
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
          }}
          className="space-y-6"
        >
          <div className="luxury-panel rounded-[2rem] p-7">
            <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/72">
              Concierge Desk
            </p>
            <h2 className="mt-5 font-display text-3xl leading-tight text-ivory">
              Partnerships, private events, media, and audience enquiries.
            </h2>
            <p className="mt-5 font-body text-sm leading-relaxed text-ivory/56">
              This page needs to feel like a premium concierge interface, not a form dropped next to stock contact cards.
            </p>
          </div>

          {channels.map((channel) => (
            <article
              key={channel.label}
              className="luxury-panel rounded-[2rem] p-6"
            >
              <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/72">
                {channel.label}
              </p>
              {channel.href ? (
                <a
                  href={channel.href}
                  className="mt-4 inline-block font-display text-2xl leading-tight text-ivory transition-colors hover:text-gold"
                >
                  {channel.value}
                </a>
              ) : (
                <p className="mt-4 font-display text-2xl leading-tight text-ivory">
                  {channel.value}
                </p>
              )}
              <p className="mt-4 font-body text-sm leading-relaxed text-ivory/55">
                {channel.detail}
              </p>
            </article>
          ))}
        </motion.aside>

        <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: 0.06,
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
          }}
          className="luxury-panel rounded-[2.2rem] p-2 md:p-3"
        >
          <div className="rounded-[1.8rem] border border-ivory/8 bg-charcoal-deep/72 p-2">
            <ContactForm />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
