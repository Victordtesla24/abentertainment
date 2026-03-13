"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Mail, Users } from "lucide-react";
import { NewsletterSignupForm } from "@/components/forms/NewsletterSignupForm";
import { ANIMATION } from "@/lib/constants";

export function CTASection() {
  return (
    <section
      className="relative overflow-hidden py-24 md:py-32 lg:py-36"
      aria-labelledby="cta-heading"
    >
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at top, rgba(201, 168, 76, 0.16), transparent 25%), radial-gradient(circle at bottom left, rgba(107, 29, 58, 0.18), transparent 24%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="luxury-panel rounded-[2.3rem] p-8 md:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <motion.p
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: ANIMATION.duration.normal }}
                className="eyebrow-label"
              >
                The Curtain Call
              </motion.p>

              <motion.h2
                id="cta-heading"
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: ANIMATION.duration.slow, ease: ANIMATION.ease.luxury }}
                className="mt-8 max-w-xl font-display text-4xl leading-tight text-ivory md:text-5xl lg:text-6xl"
              >
                Ready to experience something worthy of the stage?
              </motion.h2>

              <motion.p
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: ANIMATION.duration.normal }}
                className="mt-6 max-w-xl font-body text-base leading-relaxed text-ivory/58 md:text-lg"
              >
                Join the audience, brief the team on a private production, or open a sponsor conversation. The closing section should feel composed and persuasive, not like a generic footer CTA.
              </motion.p>

              <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row">
                <Link
                  href="/events"
                  className="group inline-flex items-center gap-3 rounded-full bg-gold px-7 py-4 font-body text-sm uppercase tracking-[0.22em] text-charcoal transition-colors duration-300 hover:bg-gold-light"
                >
                  Explore Events
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={1.8}
                  />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-3 rounded-full border border-ivory/12 bg-ivory/5 px-7 py-4 font-body text-sm uppercase tracking-[0.22em] text-ivory/70 transition-colors duration-300 hover:border-ivory/30 hover:text-ivory"
                >
                  Speak to the Team
                </Link>
              </div>
            </div>

            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: ANIMATION.duration.normal }}
              className="grid gap-5"
            >
              <div className="rounded-[1.8rem] border border-gold/15 bg-gold/10 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-charcoal">
                    <Mail className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/72">
                      Stay in the Loop
                    </p>
                    <p className="mt-1 font-display text-2xl text-ivory">
                      Early access and exclusive updates
                    </p>
                  </div>
                </div>
                <p className="mt-5 font-body text-sm leading-relaxed text-ivory/56">
                  Subscribe for event announcements, premium seating updates, and curated cultural programming notes.
                </p>
                <NewsletterSignupForm />
                <p className="mt-3 font-body text-xs text-ivory/28">
                  No spam. Only considered updates.
                </p>
              </div>

              <div className="rounded-[1.8rem] border border-ivory/10 bg-ivory/5 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-ivory/14 bg-charcoal text-gold">
                    <Users className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/72">
                      Sponsor & Private Bookings
                    </p>
                    <p className="mt-1 font-display text-2xl text-ivory">
                      Built for premium partnerships
                    </p>
                  </div>
                </div>
                <p className="mt-5 font-body text-sm leading-relaxed text-ivory/54">
                  Enquire about sponsorship, branded hospitality, or private cultural productions with the AB Entertainment team.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
