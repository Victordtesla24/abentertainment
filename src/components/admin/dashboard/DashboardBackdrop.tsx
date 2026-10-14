'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { GOLD_A } from './brand';

interface Orb {
  id: string;
  left: string;
  top: string;
  size: number;
  color: string;
  /** One slow loop, in seconds (never under 20). */
  duration: number;
  x: number[];
  y: number[];
  scale: number[];
}

/** Three large, soft gold lights that drift very slowly behind the glass: the brand's radial glow (3 to 8 percent gold), never solid. */
const ORBS: readonly Orb[] = [
  { id: 'a', left: '10%', top: '5%', size: 640, color: GOLD_A.a08, duration: 34, x: [0, 90, -30, 0], y: [0, 60, 120, 0], scale: [1, 1.08, 0.96, 1] },
  { id: 'b', left: '82%', top: '38%', size: 760, color: GOLD_A.a08, duration: 42, x: [0, -80, 40, 0], y: [0, 90, -60, 0], scale: [1, 0.95, 1.06, 1] },
  { id: 'c', left: '24%', top: '76%', size: 600, color: GOLD_A.a08, duration: 38, x: [0, 70, -50, 0], y: [0, -80, 40, 0], scale: [1, 1.05, 0.97, 1] },
];

/**
 * The Dashboard's backdrop: it sits behind the content only (absolute, behind it, never catching the pointer), moves with
 * transform only, and is not drawn at all for an admin whose device asks for reduced motion.
 */
export function DashboardBackdrop() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div aria-hidden="true" data-testid="dashboard-backdrop" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {ORBS.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full"
          style={{
            left: orb.left,
            top: orb.top,
            width: orb.size,
            height: orb.size,
            marginLeft: -orb.size / 2,
            marginTop: -orb.size / 2,
            background: `radial-gradient(closest-side, ${orb.color}, rgba(201,168,76,0))`,
            willChange: 'transform',
          }}
          animate={{ x: orb.x, y: orb.y, scale: orb.scale }}
          transition={{ duration: orb.duration, ease: 'easeInOut', repeat: Infinity }}
        />
      ))}
    </div>
  );
}
