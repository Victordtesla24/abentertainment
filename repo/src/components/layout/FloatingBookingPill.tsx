"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Ticket } from "lucide-react";

export function FloatingBookingPill() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 md:bottom-8 md:left-auto md:right-8 md:translate-x-0"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 5, ease: "easeInOut", repeat: Infinity }}
      >
        <Link
          href="/contact"
          className="group gold-shimmer flex items-center gap-3 rounded-full border border-gold/25 bg-charcoal-deep/90 px-4 py-3 text-ivory shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_1px_rgba(201,168,76,0.2)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_20px_rgba(201,168,76,0.15)]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-charcoal transition-transform duration-300 group-hover:scale-110">
            <Ticket className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <span className="min-w-[7rem]">
            <span className="block font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/65">
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
    </motion.div>
  );
}
