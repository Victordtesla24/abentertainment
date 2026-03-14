"use client";

import { motion } from "framer-motion";
import { ContactForm } from "@/components/forms/ContactForm";
import { ANIMATION } from "@/lib/constants";
import type { ContactChannel, SitePage } from "@/types";

const SERVICE_PILLARS = [
  "Event bookings and premium seating",
  "Sponsor and partnership conversations",
  "Private productions and branded hospitality",
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION.duration.normal,
      delay,
      ease: ANIMATION.ease.luxury,
    },
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
    <section className="stage-shell min-h-screen bg-charcoal-deep">
      <div className="relative overflow-hidden px-6 pb-14 pt-32 md:pt-40">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.16),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(107,29,58,0.2),transparent_24%)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_0.92fr]">
          <div>
            <motion.span initial="hidden" animate="visible" variants={fadeUp} className="eyebrow-label">
              {page.eyebrow}
            </motion.span>
            <motion.h1
              initial="hidden"
              animate="visible"
              custom={0.08}
              variants={fadeUp}
              className="mt-8 max-w-4xl font-display text-[clamp(3rem,6vw,5.4rem)] leading-[0.94] text-ivory"
            >
              {page.title}
            </motion.h1>
            <motion.p
              initial="hidden"
              animate="visible"
              custom={0.16}
              variants={fadeUp}
              className="mt-7 max-w-2xl font-body text-base leading-relaxed text-ivory/58 md:text-lg"
            >
              {page.description}
            </motion.p>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            custom={0.22}
            variants={fadeUp}
            className="stage-card-dark rounded-[2.2rem] p-6 md:p-8"
          >
            <p className="eyebrow-label">Concierge Desk</p>
            <p className="mt-7 font-display text-3xl leading-tight text-ivory">
              Partnerships, private events, media, and audience enquiries handled with calm precision.
            </p>
            <p className="mt-5 font-body text-sm leading-relaxed text-ivory/52">
              Every message should feel like an assisted luxury touchpoint, not a generic support inbox. The form routes the enquiry and the page provides immediate confidence around response quality.
            </p>
            <div className="mt-7 grid gap-3 md:grid-cols-3">
              <div className="stat-chip rounded-[1.35rem] p-4 text-center">
                <p className="numeric-label">Response</p>
                <p className="mt-2 font-display text-2xl text-gold">1 Day</p>
              </div>
              <div className="stat-chip rounded-[1.35rem] p-4 text-center">
                <p className="numeric-label">Modes</p>
                <p className="mt-2 font-display text-2xl text-gold">Live</p>
              </div>
              <div className="stat-chip rounded-[1.35rem] p-4 text-center">
                <p className="numeric-label">Route</p>
                <p className="mt-2 font-display text-2xl text-gold">AI</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
        <motion.aside
          initial="hidden"
          whileInView="visible"
          custom={0.08}
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
          variants={fadeUp}
          className="space-y-6"
        >
          <div className="stage-card-dark rounded-[2rem] p-6 md:p-7">
            <p className="numeric-label !text-gold/66">What We Handle</p>
            <div className="mt-5 space-y-3">
              {SERVICE_PILLARS.map((pillar, index) => (
                <div
                  key={pillar}
                  className="rounded-[1.4rem] border border-ivory/10 bg-ivory/5 px-4 py-4"
                >
                  <p className="numeric-label !text-gold/66">0{index + 1}</p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-ivory/56">
                    {pillar}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {channels.map((channel) => (
              <article key={channel.label} className="stage-card-dark rounded-[1.8rem] p-5">
                <p className="numeric-label !text-gold/66">{channel.label}</p>
                {channel.href ? (
                  <a
                    href={channel.href}
                    className="mt-3 inline-block font-display text-2xl leading-tight text-ivory transition-colors hover:text-gold"
                  >
                    {channel.value}
                  </a>
                ) : (
                  <p className="mt-3 font-display text-2xl leading-tight text-ivory">
                    {channel.value}
                  </p>
                )}
                <p className="mt-3 font-body text-sm leading-relaxed text-ivory/52">
                  {channel.detail}
                </p>
              </article>
            ))}
          </div>
        </motion.aside>

        <motion.div
          initial="hidden"
          whileInView="visible"
          custom={0.14}
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
          variants={fadeUp}
          className="stage-card-dark rounded-[2.4rem] p-3 md:p-4"
        >
          <ContactForm />
        </motion.div>
      </div>
    </section>
  );
}
