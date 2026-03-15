"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ANIMATION } from "@/lib/constants";

interface TeamMember {
  name: string;
  role: string;
  description: string;
  signature: string;
  photo: string;
  initials: string;
}

const FOUNDERS: TeamMember[] = [
  {
    name: "Abhijeet Kadam",
    role: "President & CEO",
    description:
      "Abhijeet leads artistic direction with a deep commitment to Marathi and Indian performing arts, shaping programs that feel emotionally authentic and production-ready.",
    signature: "Programming · Stagecraft · Cultural narrative",
    photo: "/images/team/abhijit-kadam.jpg",
    initials: "AK",
  },
  {
    name: "Vrushali Deshpande",
    role: "Founder & Director",
    description:
      "Vrushali drives operational clarity, hospitality, and community trust, ensuring every public-facing detail supports a premium guest and partner experience.",
    signature: "Hospitality · Partnerships · Audience care",
    photo: "/images/team/vrushali-deshpande.jpg",
    initials: "VD",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: ANIMATION.duration.normal, delay, ease: ANIMATION.ease.luxury },
  }),
};

export function TeamSection() {
  return (
    <section
      className="relative bg-white py-24 dark:bg-charcoal md:py-32 lg:py-36"
      aria-labelledby="team-heading"
    >
      {/* Decorative blob */}
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-gold/5 blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-burgundy/5 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -60px 0px" }}
          variants={fadeUp}
          className="mb-14 text-center"
        >
          <p className="eyebrow-label !text-gold/70">The Ensemble</p>
          <h2
            id="team-heading"
            className="mt-5 font-display text-4xl leading-tight text-charcoal dark:text-ivory md:text-5xl"
          >
            The creative minds
            <span className="block text-gold"> behind the curtain.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-body text-base leading-relaxed text-charcoal/78 dark:text-ivory/75">
            AB Entertainment is led by a team with deep roots in Indian and Marathi performing arts, decades of production experience, and an unwavering commitment to cultural excellence in Australia.
          </p>
        </motion.div>

        {/* Team grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {FOUNDERS.map((member, index) => (
            <motion.article
              key={member.name}
              initial="hidden"
              whileInView="visible"
              custom={index * 0.14}
              viewport={{ once: true, amount: 0.05, margin: "0px 0px -60px 0px" }}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.3 } }}
              className="group overflow-hidden rounded-[2rem] border border-border bg-ivory-warm shadow-sm transition-shadow duration-300 hover:shadow-lg dark:border-gold/12 dark:bg-charcoal-light"
            >
              {/* Photo area */}
              <div className="relative h-72 w-full overflow-hidden bg-charcoal-deep dark:bg-black md:h-80">
                <Image
                  src={member.photo}
                  alt={`${member.name} – ${member.role}`}
                  fill
                  className="object-contain object-bottom transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={90}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent" />
                {/* Floating name badge */}
                <div className="absolute bottom-5 left-5">
                  <p className="font-body text-[0.6rem] uppercase tracking-[0.3em] text-gold/80">
                    Founder 0{index + 1}
                  </p>
                  <h3 className="mt-1 font-display text-2xl text-ivory">{member.name}</h3>
                </div>
              </div>

              {/* Content area */}
              <div className="p-7">
                <p className="font-body text-xs uppercase tracking-[0.24em] text-gold">{member.role}</p>

                <p className="mt-4 font-body text-base leading-relaxed text-charcoal/80 dark:text-ivory/75">
                  {member.description}
                </p>

                <div className="mt-6 rounded-[1.2rem] border border-gold/15 bg-gold/5 p-4 dark:bg-gold/8">
                  <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/70">Signature</p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/78">
                    {member.signature}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
