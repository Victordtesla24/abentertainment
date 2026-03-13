"use client";

import { motion } from "framer-motion";
import { ANIMATION } from "@/lib/constants";

interface TeamMember {
  name: string;
  role: string;
  description: string;
  signature: string;
}

const FOUNDERS: TeamMember[] = [
  {
    name: "Abhijeet Kadam",
    role: "Co-Founder & Creative Director",
    description:
      "Abhijeet leads artistic direction with a deep commitment to Marathi and Indian performing arts, shaping programs that feel emotionally authentic and production-ready.",
    signature: "Programming · Stagecraft · Cultural narrative",
  },
  {
    name: "Vrushali Deshpande",
    role: "Co-Founder & Operations Director",
    description:
      "Vrushali drives operational clarity, hospitality, and community trust, ensuring every public-facing detail supports a premium guest and partner experience.",
    signature: "Hospitality · Partnerships · Audience care",
  },
];

export function TeamSection() {
  return (
    <section
      className="relative py-24 md:py-32 lg:py-36"
      aria-labelledby="team-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <motion.div
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: ANIMATION.duration.normal }}
            className="luxury-panel rounded-[2rem] p-8"
          >
            <p className="eyebrow-label">The Ensemble</p>
            <h2
              id="team-heading"
              className="mt-8 max-w-sm font-display text-4xl leading-tight text-ivory md:text-5xl"
            >
              Meet the founders behind the production standard.
            </h2>
            <p className="mt-6 font-body text-base leading-relaxed text-ivory/56">
              The website should carry the same calm authority as the people shaping the program. That means fewer generic founder blurbs and more editorial presence.
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2">
            {FOUNDERS.map((member, index) => (
              <motion.article
                key={member.name}
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: ANIMATION.duration.normal,
                  delay: index * ANIMATION.stagger.normal,
                }}
                className="luxury-panel rounded-[2rem] p-7 md:p-8"
              >
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/72">
                      Founder 0{index + 1}
                    </p>
                    <h3 className="mt-5 font-display text-3xl leading-tight text-ivory">
                      {member.name}
                    </h3>
                    <p className="mt-3 font-body text-xs uppercase tracking-[0.24em] text-ivory/42">
                      {member.role}
                    </p>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/25 bg-gold/10 font-display text-2xl text-gold">
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                </div>

                <div className="section-divider mt-8" />

                <p className="mt-8 font-body text-base leading-relaxed text-ivory/56">
                  {member.description}
                </p>

                <div className="mt-8 rounded-[1.4rem] border border-ivory/10 bg-ivory/5 p-4">
                  <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/68">
                    Signature
                  </p>
                  <p className="mt-3 font-body text-sm leading-relaxed text-ivory/58">
                    {member.signature}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
