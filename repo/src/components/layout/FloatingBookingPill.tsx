"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Ticket } from "lucide-react";

export function FloatingBookingPill() {
  return (
    <motion.div
      initial={false}
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 5.2, ease: "easeInOut", repeat: Infinity }}
      className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 md:bottom-8 md:left-8 md:translate-x-0"
    >
      <Link
        href="/contact"
        data-magnetic
        className="group glow-on-hover gold-shimmer flex items-center gap-3 rounded-full border border-gold/24 bg-charcoal-deep/86 px-3 py-3 text-ivory shadow-[0_26px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-gold/38"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/18 bg-gold text-charcoal shadow-[0_12px_32px_rgba(201,168,76,0.38)]">
          <Ticket className="h-4 w-4" strokeWidth={1.8} />
        </span>

        <span className="min-w-[10rem]">
          <span className="flex items-center gap-2 font-body text-[0.58rem] uppercase tracking-[0.32em] text-gold/70">
            AB Concierge
            <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_12px_rgba(201,168,76,0.8)]" />
          </span>
          <span className="mt-1 block font-body text-sm uppercase tracking-[0.18em] text-ivory">
            Reserve Your Experience
          </span>
        </span>

        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-gold transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          strokeWidth={1.8}
        />
      </Link>
    </motion.div>
  );
}
