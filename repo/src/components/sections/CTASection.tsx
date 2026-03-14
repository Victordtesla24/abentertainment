"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Mail, Users } from "lucide-react";
import { NewsletterSignupForm } from "@/components/forms/NewsletterSignupForm";
import { ANIMATION } from "@/lib/constants";

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: ANIMATION.duration.normal,
      delay,
      ease: ANIMATION.ease.luxury,
    },
  }),
};

export function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const blobY1 = useTransform(scrollYProgress, [0, 1], [0, -45]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], [0, 35]);

  return (
    <section
      ref={sectionRef}
      className="stage-shell relative overflow-hidden bg-charcoal-deep py-24 md:py-32 lg:py-36"
      aria-labelledby="cta-heading"
    >
      {/* Parallax decorative blobs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(107,29,58,0.2),transparent_26%)]" />
        <motion.div
          className="absolute right-0 top-12 h-96 w-96 rounded-full bg-gold/10 blur-3xl"
          style={{ y: blobY1 }}
        />
        <motion.div
          className="absolute -left-20 bottom-24 h-72 w-72 rounded-full bg-burgundy/12 blur-3xl"
          style={{ y: blobY2 }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="stage-card-dark rounded-[2.8rem] p-6 md:p-8 lg:p-10">
          <div className="grid gap-8 xl:grid-cols-[1fr_0.92fr]">
            <div className="flex flex-col justify-between">
              <div>
                <motion.span
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
                  variants={fadeUp}
                  className="eyebrow-label"
                >
                  The Curtain Call
                </motion.span>

                <motion.h2
                  id="cta-heading"
                  initial="hidden"
                  whileInView="visible"
                  custom={0.08}
                  viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
                  variants={fadeUp}
                  className="mt-8 max-w-3xl font-display text-[clamp(2.9rem,5vw,5.2rem)] leading-[0.94] text-ivory"
                >
                  Ready to attend, partner, or commission something worthy of the stage?
                </motion.h2>

                <motion.p
                  initial="hidden"
                  whileInView="visible"
                  custom={0.14}
                  viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
                  variants={fadeUp}
                  className="mt-6 max-w-2xl font-body text-base leading-relaxed text-ivory/58 md:text-lg"
                >
                  Whether you&apos;re looking for premium tickets, exploring sponsorship opportunities, or planning a private cultural production — we&apos;d love to hear from you.
                </motion.p>

                {/* Animated gold divider */}
                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }}
                  whileInView={{ scaleX: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-8 h-[1px] origin-left bg-gradient-to-r from-gold/40 via-gold/20 to-transparent"
                />

                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  custom={0.2}
                  viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
                  variants={fadeUp}
                  className="mt-10 flex flex-col items-start gap-4 sm:flex-row"
                >
                  <Link
                    href="/events"
                    className="button-primary glow-on-hover gold-shimmer px-6 py-4 text-[0.68rem]"
                    data-magnetic
                  >
                    Explore Events
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </Link>
                  <Link
                    href="/contact"
                    className="button-secondary px-6 py-4 text-[0.68rem]"
                    data-magnetic
                  >
                    Speak To The Team
                  </Link>
                </motion.div>
              </div>

              {/* Staggered stat chips */}
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {[
                  { label: "Audience", text: "Tickets, premium seating, and live program updates." },
                  { label: "Sponsors", text: "Partnership conversations with a premium hospitality lens." },
                  { label: "Private Productions", text: "Cultural evenings designed for brands, communities, and institutions." },
                ].map((chip, idx) => (
                  <motion.div
                    key={chip.label}
                    initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.26 + idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -3, boxShadow: "0 16px 48px rgba(201,168,76,0.12)", transition: { duration: 0.25 } }}
                    className="stat-chip rounded-[1.6rem] p-5"
                  >
                    <p className="numeric-label !text-gold/66">{chip.label}</p>
                    <p className="mt-3 font-display text-2xl leading-tight text-ivory">
                      {chip.text}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right column – newsletter + sponsor cards */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              custom={0.12}
              viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
              variants={fadeUp}
              className="grid gap-5"
            >
              {/* Newsletter card */}
              <motion.div
                whileHover={{ y: -4, boxShadow: "0 28px 70px rgba(0,0,0,0.15)", transition: { duration: 0.3 } }}
                className="stage-card rounded-[2rem] p-6 md:p-7"
              >
                <div className="flex items-center gap-3">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.6 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/18 bg-gold/10 text-gold"
                  >
                    <Mail className="h-4 w-4" strokeWidth={1.8} />
                  </motion.span>
                  <div>
                    <p className="numeric-label !text-gold/66">Guest List</p>
                    <p className="mt-1 font-display text-2xl text-charcoal dark:text-ivory">
                      Early access and curated updates
                    </p>
                  </div>
                </div>
                <p className="mt-5 font-body text-sm leading-relaxed text-charcoal/62 dark:text-ivory/56">
                  Subscribe for event announcements, premium seating updates, and considered cultural notes from the AB Entertainment team.
                </p>
                <NewsletterSignupForm />
                <p className="mt-3 font-body text-xs text-charcoal/46 dark:text-ivory/34">
                  Only thoughtful updates. Never noise.
                </p>
              </motion.div>

              {/* Sponsor card */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4, boxShadow: "0 28px 70px rgba(0,0,0,0.35)", transition: { duration: 0.3 } }}
                className="stage-card-dark rounded-[2rem] p-6 md:p-7"
              >
                <div className="flex items-center gap-3">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.6 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/18 bg-gold/10 text-gold"
                  >
                    <Users className="h-4 w-4" strokeWidth={1.8} />
                  </motion.span>
                  <div>
                    <p className="numeric-label !text-gold/66">Sponsor & Private Bookings</p>
                    <p className="mt-1 font-display text-2xl text-ivory">
                      Built for premium partnerships
                    </p>
                  </div>
                </div>
                <p className="mt-5 font-body text-sm leading-relaxed text-ivory/56">
                  Enquire about sponsorship tiers, branded hospitality, or private cultural productions with a team that understands both stagecraft and guest care.
                </p>

                {/* Animated gold divider */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-5 h-[1px] origin-left bg-gradient-to-r from-gold/30 via-gold/15 to-transparent"
                />

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/contact"
                    className="button-primary glow-on-hover gold-shimmer px-5 py-3 text-[0.68rem]"
                    data-magnetic
                  >
                    Start An Enquiry
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </Link>
                  <Link
                    href="/sponsor-dashboard"
                    className="button-secondary px-5 py-3 text-[0.68rem]"
                    data-magnetic
                  >
                    Sponsor Portal
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
