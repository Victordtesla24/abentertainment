"use client";

import { motion } from "framer-motion";
import { ContactForm } from "@/components/forms/ContactForm";
import { ANIMATION } from "@/lib/constants";
import type { ContactChannel, SitePage } from "@/types";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: ANIMATION.duration.normal, delay, ease: ANIMATION.ease.luxury },
  }),
};

export function ContactPageClient({
  page,
  channels,
}: {
  page: SitePage;
  channels: ContactChannel[];
}) {
  return (
    <section className="min-h-screen bg-charcoal-deep">
      {/* Page header */}
      <div className="relative overflow-hidden bg-charcoal-deep px-6 pb-12 pt-32 md:pt-40">
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle at top, rgba(201, 168, 76, 0.14), transparent 28%), radial-gradient(circle at 80% 20%, rgba(107, 29, 58, 0.18), transparent 24%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

        <div className="relative mx-auto max-w-7xl">
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="eyebrow-label"
          >
            {page.eyebrow}
          </motion.p>
          <motion.h1
            initial="hidden"
            animate="visible"
            custom={0.08}
            variants={fadeUp}
            className="mt-8 max-w-3xl font-display text-5xl font-medium leading-[0.94] text-ivory md:text-6xl lg:text-[5.15rem]"
          >
            {page.title}
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            custom={0.16}
            variants={fadeUp}
            className="mt-7 max-w-2xl font-body text-base leading-relaxed text-ivory/78 md:text-lg"
          >
            {page.description}
          </motion.p>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 lg:grid-cols-[0.76fr_1.24fr] lg:px-8">
        <motion.aside
          initial="hidden"
          animate="visible"
          custom={0.1}
          variants={fadeUp}
          className="space-y-6"
        >
          <div className="luxury-panel-dark rounded-[2rem] p-7">
            <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/72">
              Concierge Desk
            </p>
            <h2 className="mt-5 font-display text-3xl leading-tight text-ivory">
              Partnerships, private events, media, and audience enquiries.
            </h2>
            <p className="mt-5 font-body text-sm leading-relaxed text-ivory/75">
              Every inquiry is handled personally. Whether you are planning a corporate event, exploring a partnership, or simply wish to attend — our team responds within one business day.
            </p>
          </div>

          {channels.map((channel) => (
            <article
              key={channel.label}
              className="luxury-panel-dark rounded-[2rem] p-6"
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
              <p className="mt-4 font-body text-sm leading-relaxed text-ivory/75">
                {channel.detail}
              </p>
            </article>
          ))}
        </motion.aside>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={0.16}
          variants={fadeUp}
          className="luxury-panel-dark rounded-[2.2rem] p-2 md:p-3"
        >
          <div className="rounded-[1.8rem] border border-ivory/8 bg-charcoal-deep/72 p-2">
            <ContactForm />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
