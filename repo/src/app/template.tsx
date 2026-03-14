"use client";

import { motion } from "framer-motion";
import { ANIMATION } from "@/lib/constants";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ 
        duration: ANIMATION.duration.slow, 
        ease: ANIMATION.ease.luxury 
      }}
      className="origin-top"
    >
      {children}
    </motion.div>
  );
}
