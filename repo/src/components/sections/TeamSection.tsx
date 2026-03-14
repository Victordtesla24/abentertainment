"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ANIMATION } from "@/lib/constants";

interface TeamMember {
  name: string;
  role: string;
  description: string;
  signature: string;
  photo: string;
  initials: string;
  focusAreas: string[];
}

const FOUNDERS: TeamMember[] = [
  {
    name: "Abhijeet Kadam",
    role: "President & CEO",
    description:
      "Abhijeet leads artistic direction with a deep commitment to Marathi and Indian performing arts, shaping programming that feels emotionally authentic, operationally polished, and ready for premium public presentation.",
    signature: "Programming · Stagecraft · Cultural narrative",
    photo: "/images/team/abhijeet-kadam.jpg",
    initials: "AK",
    focusAreas: ["Programming", "Stagecraft", "Cultural narrative"],
  },
  {
    name: "Vrushali Deshpande",
    role: "Founder & Director",
    description:
      "Vrushali brings clarity to hospitality, partnerships, and community trust, ensuring every public-facing detail supports the calm authority and care expected from a flagship cultural brand.",
    signature: "Hospitality · Partnerships · Audience care",
    photo: "/images/team/vrushali-deshpande.jpg",
    initials: "VD",
    focusAreas: ["Hospitality", "Partnerships", "Audience care"],
  },
];

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

/* ------------------------------------------------------------------ */
/*  FounderCard – per-member parallax portrait + staggered details     */
/* ------------------------------------------------------------------ */
function FounderCard({ member, index }: { member: TeamMember; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.06, 1, 1.02]);

  return (
    <motion.article
      ref={ref}
      initial="hidden"
      whileInView="visible"
      custom={index * 0.1}
      viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
      variants={fadeUp}
      whileHover={{ y: -4, boxShadow: "0 32px 80px rgba(0,0,0,0.18)", transition: { duration: 0.3 } }}
      className="stage-card overflow-hidden rounded-[2.4rem] p-3 md:p-4"
    >
      <div className="grid gap-4 md:grid-cols-[0.72fr_1.28fr]">
        {/* Portrait with parallax */}
        <div className="relative overflow-hidden rounded-[2rem] bg-charcoal">
          <div className="relative h-[23rem] overflow-hidden md:h-full md:min-h-[28rem]">
            <motion.div className="absolute inset-0" style={{ y: imageY, scale: imageScale }}>
              <Image
                src={member.photo}
                alt={`${member.name} – ${member.role}`}
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/86 via-transparent to-transparent" />
          </div>
          <motion.div
            initial={{ opacity: 0, x: -12, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            className="absolute left-5 top-5 rounded-full border border-gold/16 bg-gold/12 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold"
          >
            Founder 0{index + 1}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.35 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full border border-ivory/12 bg-charcoal/55 font-display text-xl text-ivory backdrop-blur-sm"
          >
            {member.initials}
          </motion.div>
        </div>

        {/* Details panel */}
        <div className="flex flex-col justify-between rounded-[2rem] border border-black/5 bg-white/78 p-6 dark:border-gold/10 dark:bg-charcoal-light/72 md:p-8">
          <div>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.15 + index * 0.1 }}
              className="numeric-label !text-gold/66"
            >
              {member.role}
            </motion.p>
            <motion.h3
              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.22 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 font-display text-4xl leading-tight text-charcoal dark:text-ivory md:text-[3rem]"
            >
              {member.name}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              className="mt-5 max-w-2xl font-body text-base leading-relaxed text-charcoal/64 dark:text-ivory/56"
            >
              {member.description}
            </motion.p>
          </div>

          <div className="mt-8 space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.38 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(201,168,76,0.12)", transition: { duration: 0.25 } }}
              className="rounded-[1.6rem] border border-gold/12 bg-gold/8 p-5"
            >
              <p className="numeric-label !text-gold/66">Signature</p>
              <p className="mt-3 font-display text-2xl leading-tight text-charcoal dark:text-ivory">
                {member.signature}
              </p>
            </motion.div>

            {/* Staggered focus area tags */}
            <div className="flex flex-wrap gap-3">
              {member.focusAreas.map((area, areaIdx) => (
                <motion.span
                  key={area}
                  initial={{ opacity: 0, y: 8, scale: 0.92 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.45 + index * 0.1 + areaIdx * 0.06 }}
                  whileHover={{ scale: 1.08, transition: { duration: 0.2 } }}
                  className="rounded-full border border-black/8 bg-white/75 px-4 py-2 font-body text-[0.62rem] uppercase tracking-[0.26em] text-charcoal/66 dark:border-gold/10 dark:bg-charcoal/70 dark:text-ivory/60"
                >
                  {area}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/*  Main section                                                       */
/* ------------------------------------------------------------------ */
export function TeamSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const blobY1 = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], [0, 40]);

  return (
    <section
      ref={sectionRef}
      className="stage-shell-light relative overflow-hidden py-24 md:py-32 lg:py-36"
      aria-labelledby="team-heading"
    >
      {/* Parallax decorative blobs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <motion.div
          className="absolute right-0 top-0 h-96 w-96 rounded-full bg-gold/10 blur-3xl"
          style={{ y: blobY1 }}
        />
        <motion.div
          className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-burgundy/8 blur-3xl"
          style={{ y: blobY2 }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
          {/* Sticky sidebar */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.06, margin: "0px 0px -70px 0px" }}
            variants={fadeUp}
            className="stage-card rounded-[2.4rem] p-8 md:sticky md:top-28 md:p-9"
          >
            <span className="eyebrow-label">The Ensemble</span>
            <h2
              id="team-heading"
              className="mt-8 max-w-lg font-display text-[clamp(2.75rem,5vw,4.6rem)] leading-[0.94] text-charcoal dark:text-ivory"
            >
              The people who bring the curtain up.
            </h2>
            <p className="mt-6 font-body text-base leading-relaxed text-charcoal/62 dark:text-ivory/56 md:text-lg">
              AB Entertainment is led by a team with deep roots in Indian and Marathi performing arts, decades of production experience, and an unwavering commitment to cultural excellence in Australia.
            </p>

            {/* Staggered info chips */}
            <div className="mt-8 grid gap-4">
              <motion.div
                initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(0,0,0,0.08)", transition: { duration: 0.25 } }}
                className="stat-chip rounded-[1.6rem] p-5"
              >
                <p className="numeric-label !text-gold/66">Since 2007</p>
                <p className="mt-3 font-display text-2xl leading-tight text-charcoal dark:text-ivory">
                  Nearly two decades of delivering premium cultural experiences across Australia.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(0,0,0,0.08)", transition: { duration: 0.25 } }}
                className="rounded-[1.6rem] border border-gold/16 bg-gold/10 p-5"
              >
                <p className="numeric-label !text-gold/70">Trusted By Partners</p>
                <p className="mt-3 font-body text-sm leading-relaxed text-charcoal/62 dark:text-ivory/56">
                  Sponsors and venue partners choose AB Entertainment for our track record of sold-out productions, meticulous event management, and deep audience connection.
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* Founder cards */}
          <div className="grid gap-6">
            {FOUNDERS.map((member, index) => (
              <FounderCard key={member.name} member={member} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
