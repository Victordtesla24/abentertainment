"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Ticket } from "lucide-react";

export function FloatingBookingPill() {
  return (
    <motion.div
      initial={false}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4.6, ease: "easeInOut", repeat: Infinity }}
      className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 md:bottom-8 md:left-auto md:right-8 md:translate-x-0"
    >
      <Link
        href="/contact"
        className="group gold-shimmer luxury-panel flex items-center gap-3 rounded-full border border-gold/30 bg-charcoal-deep/85 px-4 py-3 text-ivory shadow-[0_22px_48px_rgba(0,0,0,0.45)] transition-transform duration-300 hover:-translate-y-1"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-charcoal">
          <Ticket className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <span className="min-w-[7rem]">
          <span className="block font-body text-[0.62rem] uppercase tracking-[0.3em] text-gold/70">
            Concierge
          </span>
          <span className="block font-body text-sm uppercase tracking-[0.18em] text-ivory">
            Book Now
          </span>
        </span>
        <ArrowUpRight
          className="h-4 w-4 text-gold transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          strokeWidth={1.8}
        />
      </Link>
    </motion.div>
  );
}
