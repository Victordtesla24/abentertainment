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
    <section className="min-h-screen bg-charcoal">
      <PageHero
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
      />

      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-24 lg:grid-cols-[0.9fr,1.1fr] lg:px-8">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
          }}
          className="space-y-6"
        >
          {channels.map((channel) => (
            <article
              key={channel.label}
              className="rounded-[2rem] border border-ivory/10 bg-charcoal-deep/70 p-6"
            >
              <p className="font-body text-xs uppercase tracking-[0.3em] text-gold/70">
                {channel.label}
              </p>
              {channel.href ? (
                <a
                  href={channel.href}
                  className="mt-4 inline-block font-display text-2xl text-ivory transition-colors hover:text-gold"
                >
                  {channel.value}
                </a>
              ) : (
                <p className="mt-4 font-display text-2xl text-ivory">
                  {channel.value}
                </p>
              )}
              <p className="mt-3 font-body text-sm leading-relaxed text-ivory/55">
                {channel.detail}
              </p>
            </article>
          ))}
        </motion.aside>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: 0.06,
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
          }}
        >
          <ContactForm />
        </motion.div>
      </div>
    </section>
  );
}
