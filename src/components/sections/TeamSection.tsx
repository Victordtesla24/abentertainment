"use client";

import { motion } from "framer-motion";
import { ANIMATION } from "@/lib/constants";

interface TeamMember {
  name: string;
  role: string;
  description: string;
}

const FOUNDERS: TeamMember[] = [
  {
    name: "Abhijeet Kadam",
    role: "Co-Founder & Creative Director",
    description:
      "With a deep-rooted passion for Marathi and Indian performing arts, Abhijeet has been the driving force behind AB Entertainment's vision since 2007 — bringing world-class talent to Australian stages.",
  },
  {
    name: "Vrushali Deshpande",
    role: "Co-Founder & Operations Director",
    description:
      "Vrushali's meticulous attention to detail and dedication to community engagement have shaped AB Entertainment into Melbourne's most trusted name in Indian cultural events.",
  },
];

const memberVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.2,
      duration: ANIMATION.duration.slow,
      ease: ANIMATION.ease.luxury,
    },
  }),
};

export function TeamSection() {
  return (
    <section
      className="relative bg-charcoal py-24 md:py-32 lg:py-40"
      aria-labelledby="team-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: ANIMATION.duration.normal }}
            className="font-body text-xs uppercase tracking-[0.3em] text-gold/70"
          >
            The Ensemble
          </motion.p>

          <motion.h2
            id="team-heading"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{
              delay: 0.1,
              duration: ANIMATION.duration.slow,
              ease: ANIMATION.ease.luxury,
            }}
            className="mt-4 font-display text-3xl font-medium text-ivory md:text-4xl lg:text-5xl"
          >
            Meet the Founders
          </motion.h2>

          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: 64 }}
            viewport={{ once: true }}
            transition={{
              delay: 0.3,
              duration: ANIMATION.duration.normal,
              ease: ANIMATION.ease.luxury,
            }}
            className="mx-auto mt-6 h-px bg-gold"
            aria-hidden="true"
          />
        </div>

        {/* Founders grid */}
        <div className="mx-auto mt-16 grid max-w-4xl gap-12 md:grid-cols-2 md:gap-16">
          {FOUNDERS.map((member, i) => (
            <motion.article
              key={member.name}
              custom={i}
              variants={memberVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              {/* Circular avatar placeholder */}
              <div className="relative" aria-hidden="true">
                <div className="h-36 w-36 overflow-hidden rounded-full border-2 border-gold/30 md:h-44 md:w-44">
                  <div className="h-full w-full bg-gradient-to-br from-charcoal-light via-charcoal-deep to-burgundy/20" />
                </div>
                {/* Gold ring accent */}
                <div className="absolute -inset-1 rounded-full border border-gold/10" />
              </div>

              <h3 className="mt-6 font-display text-xl font-medium text-ivory md:text-2xl">
                {member.name}
              </h3>

              <p className="mt-1 font-body text-sm uppercase tracking-widest text-gold/60">
                {member.role}
              </p>

              <p className="mt-4 max-w-sm font-body text-sm leading-relaxed text-ivory/50">
                {member.description}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
