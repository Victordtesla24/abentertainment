"use client";

import { motion } from "framer-motion";
import { ANIMATION } from "@/lib/constants";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: ANIMATION.duration.normal, 
        ease: ANIMATION.ease.luxury 
      }}
      className="origin-top"
    >
      {children}
    </motion.div>
  );
}
