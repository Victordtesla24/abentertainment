"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { NewsletterSignupForm } from "@/components/forms/NewsletterSignupForm";
import { ANIMATION } from "@/lib/constants";

export function CTASection() {
  return (
    <section
      className="relative overflow-hidden bg-charcoal-deep py-24 md:py-32 lg:py-40"
      aria-labelledby="cta-heading"
    >
      {/* Gold gradient border at top */}
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
        aria-hidden="true"
      />

      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 opacity-20"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(201, 168, 76, 0.08) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
        {/* Section label */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: ANIMATION.duration.normal }}
          className="font-body text-xs uppercase tracking-[0.3em] text-gold/70"
        >
          The Curtain Call
        </motion.p>

        {/* Heading */}
        <motion.h2
          id="cta-heading"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{
            delay: 0.1,
            duration: ANIMATION.duration.slow,
            ease: ANIMATION.ease.luxury,
          }}
          className="mt-6 font-display text-3xl font-medium leading-tight text-ivory md:text-4xl lg:text-5xl"
        >
          Ready to Experience
          <br />
          the Extraordinary?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: ANIMATION.duration.normal }}
          className="mx-auto mt-6 max-w-xl font-body text-base leading-relaxed text-ivory/50 md:text-lg"
        >
          Join thousands who have witnessed the magic of live cultural
          performances. Your next unforgettable experience awaits.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            delay: 0.4,
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
          }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="/events"
            className="inline-flex items-center gap-3 rounded-full bg-gold px-8 py-4 font-body text-sm uppercase tracking-widest text-charcoal transition-all duration-500 hover:bg-gold-light hover:shadow-lg hover:shadow-gold/20"
          >
            Explore Upcoming Events
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>

          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-ivory/20 px-8 py-4 font-body text-sm uppercase tracking-widest text-ivory/70 transition-all duration-500 hover:border-ivory/50 hover:text-ivory"
          >
            Get in Touch
          </Link>
        </motion.div>

        {/* Newsletter signup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            delay: 0.6,
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
          }}
          className="mt-16"
        >
          <div className="mx-auto h-px w-16 bg-ivory/10" aria-hidden="true" />

          <p className="mt-8 font-body text-sm text-ivory/40">
            Stay in the loop — get early access to events and exclusive updates.
          </p>

          <NewsletterSignupForm />

          <p className="mt-3 font-body text-xs text-ivory/20">
            No spam, ever. Unsubscribe at any time.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
